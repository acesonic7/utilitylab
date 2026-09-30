// Where the LimeSurvey push may connect, and who may ask it to.
//
// The push route makes server-side requests to a URL the caller supplies, so
// without these checks it could be pointed at the host's own loopback, private
// network or cloud metadata service (server-side request forgery). Everything
// here is pure: no DNS, no network, no Node imports. The route resolves the
// hostname and runs isBlockedAddress over every address it gets back.

export type TargetPolicy = {
  /** Accept http: as well as https:. Off on the public deployment. */
  allowHttp: boolean
  /** Accept loopback, private and other non-public addresses. Off unless the host opts in. */
  allowPrivate: boolean
}

export type TargetRejection = 'not-a-url' | 'scheme' | 'credentials' | 'private'

export type TargetCheck =
  | { ok: true; endpoint: URL }
  | { ok: false; reason: TargetRejection; error: string }

const MAX_URL_LENGTH = 2048

export const PRIVATE_ADDRESS_MESSAGE =
  'That address is on a private or local network, which this app does not connect to. Use a LimeSurvey server with a public address, or download the LSS file instead.'

export const PRIVATE_NAME_MESSAGE =
  'That server name points to a private or local network address, which this app does not connect to. Use a LimeSurvey server with a public address, or download the LSS file instead.'

// ── addresses ─────────────────────────────────────────────────────────────

function parseIpv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (!m) return null
  const octets = m.slice(1).map(Number)
  return octets.every((o) => o <= 255) ? octets : null
}

// Eight 16-bit groups, or null. Accepts "::" compression, a dotted IPv4 tail
// (::ffff:10.0.0.1) and a zone suffix (fe80::1%en0).
function parseIpv6(s: string): number[] | null {
  let text = s
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone)
  if (text.includes('.')) {
    const lastColon = text.lastIndexOf(':')
    const v4 = lastColon === -1 ? null : parseIpv4(text.slice(lastColon + 1))
    if (!v4) return null
    const hi = ((v4[0] << 8) | v4[1]).toString(16)
    const lo = ((v4[2] << 8) | v4[3]).toString(16)
    text = `${text.slice(0, lastColon + 1)}${hi}:${lo}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const groupsOf = (h: string) => (h === '' ? [] : h.split(':'))
  const head = groupsOf(halves[0])
  const tail = halves.length === 2 ? groupsOf(halves[1]) : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  const out: number[] = []
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
    out.push(parseInt(g, 16))
  }
  return out
}

// Everything that is not ordinary public unicast space (IANA special-purpose registry).
function blockedV4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // "this network", unspecified
    a === 10 || // private
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // protocol assignments, documentation
    (a === 192 && b === 88 && c === 99) || // 6to4 relay
    (a === 192 && b === 168) || // private
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51 && c === 100) || // documentation
    (a === 203 && b === 0 && c === 113) || // documentation
    a >= 224 // multicast, reserved, broadcast
  )
}

function blockedV6(h: number[]): boolean {
  const embeddedV4 = (i: number) => [h[i] >> 8, h[i] & 0xff, h[i + 1] >> 8, h[i + 1] & 0xff]
  const zero = (from: number, to: number) => h.slice(from, to).every((g) => g === 0)
  // Addresses that carry an IPv4 address are judged by it:
  // IPv4-mapped (::ffff:a.b.c.d), NAT64 (64:ff9b::/96) and 6to4 (2002::/16).
  if (zero(0, 5) && h[5] === 0xffff) return blockedV4(embeddedV4(6))
  if (h[0] === 0x64 && h[1] === 0xff9b && zero(2, 6)) return blockedV4(embeddedV4(6))
  if (h[0] === 0x2002) return blockedV4(embeddedV4(1))
  // Only global unicast (2000::/3) is public. That rules out unspecified (::),
  // loopback (::1), unique-local (fc00::/7), link-local (fe80::/10) and multicast (ff00::/8).
  if ((h[0] & 0xe000) !== 0x2000) return true
  if (h[0] === 0x2001 && h[1] < 0x200) return true // IETF protocol assignments, Teredo
  if (h[0] === 0x2001 && h[1] === 0xdb8) return true // documentation
  if (h[0] === 0x3fff && h[1] < 0x1000) return true // documentation
  return false
}

/** Whether `host` (as URL.hostname gives it, brackets optional) is an IP address rather than a name. */
export function isIpLiteral(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '')
  return parseIpv4(bare) !== null || parseIpv6(bare) !== null
}

/**
 * True for any address the push must not connect to: loopback, private,
 * link-local, unique-local, unspecified and other non-public ranges, in IPv4
 * and IPv6 (including IPv4-mapped IPv6). Anything that does not parse as an IP
 * address is blocked too.
 */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '')
  const v4 = parseIpv4(bare)
  if (v4) return blockedV4(v4)
  const v6 = parseIpv6(bare)
  if (v6) return blockedV6(v6)
  return true
}

function isLocalName(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost')
}

// ── URL ───────────────────────────────────────────────────────────────────

// Accept both `https://example.com` and `https://example.com/`. Append the
// standard RC2 path. Users can also pass the full endpoint; we don't double-up.
function endpointFor(url: string): string {
  const trimmed = url.replace(/\/+$/, '')
  if (trimmed.endsWith('/admin/remotecontrol')) return trimmed
  if (trimmed.includes('/index.php')) return `${trimmed}/admin/remotecontrol`
  return `${trimmed}/index.php/admin/remotecontrol`
}

/**
 * Checks the LimeSurvey URL a researcher entered and returns the RemoteControl 2
 * endpoint to call. Rejections carry a message for the push panel. A hostname
 * that passes here still has to be resolved and its addresses checked with
 * isBlockedAddress before anything connects to it.
 */
export function checkPushUrl(raw: unknown, policy: TargetPolicy): TargetCheck {
  const notAUrl: TargetCheck = {
    ok: false,
    reason: 'not-a-url',
    error: 'Enter the full address of your LimeSurvey server, for example https://survey.example.com.',
  }
  if (typeof raw !== 'string') return notAUrl
  const text = raw.trim()
  if (!text || text.length > MAX_URL_LENGTH) return notAUrl
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return notAUrl
  }

  if (url.protocol === 'http:' && !policy.allowHttp) {
    return {
      ok: false,
      reason: 'scheme',
      error:
        'The LimeSurvey URL must start with https://. This app does not send a password over an unencrypted http connection.',
    }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      ok: false,
      reason: 'scheme',
      error: policy.allowHttp
        ? 'The LimeSurvey URL must start with https:// or http://.'
        : 'The LimeSurvey URL must start with https://.',
    }
  }
  if (url.username || url.password) {
    return {
      ok: false,
      reason: 'credentials',
      error: 'Remove the username and password from the URL and enter them in their own fields.',
    }
  }

  // URL.hostname is already lower-case, with numeric IPv4 forms (0x7f.1, 2130706433)
  // rewritten as dotted decimal and IPv6 compressed, so the checks see one spelling.
  const host = url.hostname.replace(/\.$/, '')
  if (!host) return notAUrl
  if (!policy.allowPrivate && (isLocalName(host) || (isIpLiteral(host) && isBlockedAddress(host)))) {
    return { ok: false, reason: 'private', error: PRIVATE_ADDRESS_MESSAGE }
  }

  return { ok: true, endpoint: new URL(endpointFor(`${url.origin}${url.pathname}${url.search}`)) }
}

// ── caller ────────────────────────────────────────────────────────────────

/**
 * Whether a request came from a page of this app, so another site cannot drive
 * the push from a visitor's browser. Browsers set Sec-Fetch-Site and Origin
 * themselves; page scripts cannot forge them. This is not authentication: a
 * caller outside a browser can send any headers it likes.
 */
export function isSameOriginRequest(headers: {
  secFetchSite?: string | null
  origin?: string | null
  /** The Host header, and X-Forwarded-Host when a proxy sets it. */
  hosts: (string | null | undefined)[]
}): boolean {
  if (headers.secFetchSite) return headers.secFetchSite === 'same-origin'
  if (!headers.origin) return false
  let originHost: string
  try {
    originHost = new URL(headers.origin).host
  } catch {
    return false
  }
  return headers.hosts.some((h) => !!h && h.trim().toLowerCase() === originHost)
}
