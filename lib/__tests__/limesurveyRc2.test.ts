import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openRc2, readRc2Reply, resolveTarget } from '../limesurveyRc2'

describe('RC2 replies', () => {
  it('passes results through', () => {
    expect(readRc2Reply({ id: 1, result: 'abc123', error: null })).toEqual({ ok: true, result: 'abc123' })
    expect(readRc2Reply({ id: 1, result: 42, error: null })).toEqual({ ok: true, result: 42 })
    expect(readRc2Reply({ id: 1, result: { status: 'OK' }, error: null })).toEqual({ ok: true, result: { status: 'OK' } })
    expect(readRc2Reply({ id: 1, error: null })).toEqual({ ok: true, result: null })
  })

  it.each([
    ['Invalid user name or password', 'credentials'],
    ['Invalid username or password', 'credentials'],
    ['You have exceeded the number of maximum login attempts. Please wait 10 minutes before trying again.', 'locked-out'],
    ['Invalid session key', 'session'],
    ['Invalid Session Key', 'session'],
    ['No permission', 'permission'],
    ['Error: Invalid survey ID', 'survey'],
    ['Error:Survey is active and not editable', 'active'],
    ['Error: Invalid extension', 'rejected'],
    ['<script>anything at all</script>', 'rejected'],
  ])('reads the status "%s" as %s', (status, failure) => {
    expect(readRc2Reply({ id: 1, result: { status }, error: null })).toEqual({ ok: false, failure })
    expect(readRc2Reply({ id: 1, result: null, error: status })).toEqual({ ok: false, failure })
  })

  it('never returns the upstream text', () => {
    const replies = [
      { result: { status: 'secret internal detail' } },
      { error: { code: -32601, message: 'secret internal detail' } },
      { error: 'secret internal detail' },
    ]
    for (const reply of replies) {
      expect(JSON.stringify(readRc2Reply(reply))).not.toContain('secret')
    }
  })

  it('treats a body that is not a JSON-RPC object as not LimeSurvey', () => {
    for (const body of [null, 'ok', 7, [1, 2]]) {
      expect(readRc2Reply(body)).toEqual({ ok: false, failure: 'not-limesurvey' })
    }
  })
})

describe('resolving the target', () => {
  it('refuses names and literals on private or local addresses', async () => {
    expect(await resolveTarget('127.0.0.1', false)).toEqual({ ok: false, reason: 'private' })
    expect(await resolveTarget('169.254.169.254', false)).toEqual({ ok: false, reason: 'private' })
    expect(await resolveTarget('[::1]', false)).toEqual({ ok: false, reason: 'private' })
    expect(await resolveTarget('localhost', false)).toEqual({ ok: false, reason: 'private' })
  })

  it('returns the addresses to pin to', async () => {
    expect(await resolveTarget('93.184.216.34', false)).toEqual({
      ok: true,
      addresses: [{ address: '93.184.216.34', family: 4 }],
    })
    expect(await resolveTarget('127.0.0.1', true)).toEqual({ ok: true, addresses: [{ address: '127.0.0.1', family: 4 }] })
  })

  it('reports a name that does not resolve', async () => {
    expect(await resolveTarget('no-such-host.invalid', false)).toEqual({ ok: false, reason: 'unresolved' })
  })
})

describe('RC2 client', () => {
  let server: http.Server
  let port: number
  const seen: { host?: string; url?: string; body: string }[] = []

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        seen.push({ host: req.headers.host, url: req.url, body })
        const json = (value: unknown) => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(value))
        }
        switch (req.url) {
          case '/ok':
            return json({ id: JSON.parse(body).id, result: 'session-key', error: null })
          case '/denied':
            return json({ id: 1, result: { status: 'Invalid user name or password' }, error: null })
          case '/redirect':
            res.writeHead(302, { Location: `http://127.0.0.1:${port}/ok` })
            return res.end()
          case '/redirect-308':
            res.writeHead(308, { Location: `http://127.0.0.1:${port}/ok` })
            return res.end()
          case '/error':
            res.writeHead(500, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ result: 'should not be read' }))
          case '/html':
            res.writeHead(200, { 'Content-Type': 'text/html' })
            return res.end('<html>login</html>')
          case '/huge':
            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ result: 'x'.repeat(300 * 1024) }))
          case '/slow':
            return // never answers
          case '/stall':
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.write('{"result":')
            return // never finishes
        }
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  })

  const LOOPBACK = [{ address: '127.0.0.1', family: 4 }]
  const callPath = async (path: string, timeoutMs = 2_000) => {
    const client = openRc2(new URL(`http://127.0.0.1:${port}${path}`), LOOPBACK)
    try {
      return await client.call('get_session_key', ['user', 'pass'], timeoutMs)
    } finally {
      client.close()
    }
  }

  it('posts a positional JSON-RPC call and reads the result', async () => {
    seen.length = 0
    expect(await callPath('/ok')).toEqual({ ok: true, result: 'session-key' })
    expect(JSON.parse(seen[0].body)).toEqual({ method: 'get_session_key', params: ['user', 'pass'], id: 1 })
  })

  it('connects to the pinned address, not to whatever the name resolves to', async () => {
    seen.length = 0
    // This name does not resolve; the call only succeeds because the lookup is pinned.
    const client = openRc2(new URL(`http://survey.pinned.invalid:${port}/ok`), LOOPBACK)
    try {
      expect(await client.call('get_session_key', [], 2_000)).toEqual({ ok: true, result: 'session-key' })
      expect(await client.call('release_session_key', [], 2_000)).toEqual({ ok: true, result: 'session-key' })
    } finally {
      client.close()
    }
    expect(seen.map((s) => s.host)).toEqual([`survey.pinned.invalid:${port}`, `survey.pinned.invalid:${port}`])
    expect(seen.map((s) => JSON.parse(s.body).id)).toEqual([1, 2])
  })

  it('classifies a LimeSurvey refusal', async () => {
    expect(await callPath('/denied')).toEqual({ ok: false, failure: 'credentials' })
  })

  it('does not follow redirects', async () => {
    seen.length = 0
    expect(await callPath('/redirect')).toEqual({ ok: false, failure: 'not-limesurvey' })
    expect(await callPath('/redirect-308')).toEqual({ ok: false, failure: 'not-limesurvey' })
    expect(seen.map((s) => s.url)).toEqual(['/redirect', '/redirect-308'])
  })

  it('reports HTTP errors, non-JSON and oversized replies without their content', async () => {
    expect(await callPath('/error')).toEqual({ ok: false, failure: 'not-limesurvey' })
    expect(await callPath('/html')).toEqual({ ok: false, failure: 'not-limesurvey' })
    expect(await callPath('/huge')).toEqual({ ok: false, failure: 'not-limesurvey' })
  })

  it('times out a server that never answers or never finishes', async () => {
    const started = Date.now()
    expect(await callPath('/slow', 200)).toEqual({ ok: false, failure: 'unreachable' })
    expect(await callPath('/stall', 200)).toEqual({ ok: false, failure: 'unreachable' })
    expect(Date.now() - started).toBeLessThan(1_500)
  })

  it('reports a closed port as unreachable', async () => {
    const closed = http.createServer()
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve))
    const closedPort = (closed.address() as AddressInfo).port
    await new Promise((resolve) => closed.close(resolve))
    const client = openRc2(new URL(`http://127.0.0.1:${closedPort}/ok`), LOOPBACK)
    try {
      expect(await client.call('get_session_key', [], 2_000)).toEqual({ ok: false, failure: 'unreachable' })
    } finally {
      client.close()
    }
  })
})
