import { lookup } from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import type { LookupFunction } from 'node:net'
import { isBlockedAddress } from './limesurveyTarget'

// LimeSurvey RemoteControl 2 (RC2) JSON-RPC client for the push route. Server only.
// Method calls are positional-arg arrays, not named params.
//
// The hostname is resolved once, every address is checked, and all calls then
// connect to those addresses only (a pinned lookup). A name that resolves to a
// public address for the check cannot resolve to a private one for the
// connection (DNS rebinding). Redirects are never followed, replies are capped
// in size, and each call has a timeout.

const MAX_REPLY_BYTES = 256 * 1024
const DNS_TIMEOUT_MS = 5_000

export type PinnedAddress = { address: string; family: number }

export type Resolution =
  | { ok: true; addresses: PinnedAddress[] }
  | { ok: false; reason: 'unresolved' | 'private' }

/**
 * Resolves `hostname` (as URL.hostname gives it) to the addresses the push may
 * connect to. Fails with 'private' if any address is in a blocked range, so a
 * name with one public and one private record is refused.
 */
export async function resolveTarget(hostname: string, allowPrivate: boolean): Promise<Resolution> {
  const host = hostname.replace(/^\[|\]$/g, '')
  let timer: ReturnType<typeof setTimeout> | undefined
  let found: PinnedAddress[]
  try {
    found = await Promise.race([
      lookup(host, { all: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('DNS lookup timed out')), DNS_TIMEOUT_MS)
      }),
    ])
  } catch {
    return { ok: false, reason: 'unresolved' }
  } finally {
    clearTimeout(timer)
  }
  if (found.length === 0) return { ok: false, reason: 'unresolved' }
  if (!allowPrivate && found.some((a) => isBlockedAddress(a.address))) {
    return { ok: false, reason: 'private' }
  }
  // IPv4 first: some hosts (Vercel among them) have no outbound IPv6.
  const addresses = [...found].sort((a, b) => a.family - b.family)
  return { ok: true, addresses }
}

function pinnedLookup(addresses: PinnedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) callback(null, addresses)
    else callback(null, addresses[0].address, addresses[0].family)
  }
}

// Why a call failed, in terms the route can word for a researcher. The text
// LimeSurvey or any other server sent back is never passed on, so the route
// cannot be used to read responses from hosts it can reach.
export type Rc2Failure =
  | 'unreachable' // no answer: DNS, refused, timed out, TLS
  | 'not-limesurvey' // answered, but not as RC2: redirect, HTTP error, not JSON, too large
  | 'credentials'
  | 'locked-out'
  | 'session'
  | 'permission'
  | 'survey'
  | 'active'
  | 'rejected'

export type Rc2Result = { ok: true; result: unknown } | { ok: false; failure: Rc2Failure }

function classifyStatus(text: string): Rc2Failure {
  const t = text.toLowerCase()
  if (/user ?name or password/.test(t)) return 'credentials'
  if (/login attempts/.test(t)) return 'locked-out'
  if (/session key/.test(t)) return 'session'
  if (/permission/.test(t)) return 'permission'
  if (/survey ?id|survey does not exist/.test(t)) return 'survey'
  if (/survey is active/.test(t)) return 'active'
  return 'rejected'
}

/** Reads a parsed RC2 reply body. Exported for tests. */
export function readRc2Reply(body: unknown): Rc2Result {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, failure: 'not-limesurvey' }
  }
  const { result, error } = body as { result?: unknown; error?: unknown }
  // RC2 puts errors in `error`, but successful sessions can also return objects
  // with a `status` field embedding errors (e.g. { status: 'Invalid session key' }).
  if (error) {
    return { ok: false, failure: classifyStatus(typeof error === 'string' ? error : JSON.stringify(error)) }
  }
  if (result && typeof result === 'object' && 'status' in result) {
    const status = (result as { status: unknown }).status
    if (typeof status === 'string' && status !== 'OK') {
      return { ok: false, failure: classifyStatus(status) }
    }
  }
  return { ok: true, result: result ?? null }
}

export type Rc2Client = {
  call(method: string, params: unknown[], timeoutMs: number): Promise<Rc2Result>
  close(): void
}

/** Opens a client for one push. `addresses` must come from resolveTarget. */
export function openRc2(endpoint: URL, addresses: PinnedAddress[]): Rc2Client {
  const secure = endpoint.protocol === 'https:'
  // One connection for the whole push; it stays on the pinned address.
  const agent = secure
    ? new https.Agent({ keepAlive: true, maxSockets: 1 })
    : new http.Agent({ keepAlive: true, maxSockets: 1 })
  const request = secure ? https.request : http.request
  const lookupFn = pinnedLookup(addresses)
  let rpcId = 0

  const call = (method: string, params: unknown[], timeoutMs: number): Promise<Rc2Result> =>
    new Promise((resolve) => {
      const fail = (failure: Rc2Failure) => resolve({ ok: false, failure })
      const payload = Buffer.from(JSON.stringify({ method, params, id: ++rpcId }), 'utf8')
      const req = request(
        endpoint,
        {
          method: 'POST',
          agent,
          lookup: lookupFn,
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Content-Length': payload.length,
            'User-Agent': 'UtilityLab',
          },
        },
        (res) => {
          const status = res.statusCode ?? 0
          // Node does not follow redirects; a 3xx lands here with every other non-2xx.
          if (status < 200 || status >= 300) {
            req.destroy()
            fail('not-limesurvey')
            return
          }
          const chunks: Buffer[] = []
          let size = 0
          res.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > MAX_REPLY_BYTES) {
              req.destroy()
              fail('not-limesurvey')
              return
            }
            chunks.push(chunk)
          })
          res.on('end', () => {
            let body: unknown
            try {
              body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            } catch {
              fail('not-limesurvey')
              return
            }
            resolve(readRc2Reply(body))
          })
          // A reply cut short by the timeout or a dropped connection. No-ops once resolved.
          res.on('error', () => fail('unreachable'))
          res.on('close', () => fail('unreachable'))
        },
      )
      req.on('error', () => fail('unreachable'))
      req.end(payload)
    })

  return { call, close: () => agent.destroy() }
}
