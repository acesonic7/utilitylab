import { describe, expect, it } from 'vitest'
import { checkPushUrl, isBlockedAddress, isIpLiteral, isSameOriginRequest } from '../limesurveyTarget'

const PUBLIC = { allowHttp: false, allowPrivate: false }
const SELF_HOSTED = { allowHttp: true, allowPrivate: false }
const OPTED_IN = { allowHttp: true, allowPrivate: true }

const endpoint = (raw: string, policy = PUBLIC) => {
  const r = checkPushUrl(raw, policy)
  return r.ok ? r.endpoint.href : `rejected: ${r.reason}`
}

describe('blocked addresses', () => {
  it.each([
    ['0.0.0.0', 'unspecified'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback'],
    ['10.0.0.1', 'private'],
    ['172.16.0.1', 'private'],
    ['172.31.255.255', 'private'],
    ['192.168.1.10', 'private'],
    ['169.254.169.254', 'link-local, cloud metadata'],
    ['100.64.0.1', 'carrier-grade NAT'],
    ['192.0.0.8', 'protocol assignments'],
    ['198.18.0.1', 'benchmarking'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['::', 'unspecified'],
    ['::1', 'loopback'],
    ['fe80::1', 'link-local'],
    ['fe80::1%en0', 'link-local with a zone'],
    ['fc00::1', 'unique-local'],
    ['fd12:3456:789a::1', 'unique-local'],
    ['fec0::1', 'site-local'],
    ['ff02::1', 'multicast'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:7f00:1', 'IPv4-mapped loopback, hex'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
    ['::ffff:a00:1', 'IPv4-mapped private, hex'],
    ['::127.0.0.1', 'IPv4-compatible'],
    ['64:ff9b::10.0.0.1', 'NAT64 to a private address'],
    ['2002:7f00:1::1', '6to4 to loopback'],
    ['2001:db8::1', 'documentation'],
    ['2001::1', 'Teredo'],
    ['[::1]', 'bracketed'],
  ])('blocks %s (%s)', (address) => {
    expect(isBlockedAddress(address)).toBe(true)
  })

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '172.15.255.255',
    '172.32.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '169.253.0.1',
    '192.167.0.1',
    '2606:4700:4700::1111',
    '2a00:1450:4001:81b::200e',
    '::ffff:8.8.8.8',
    '64:ff9b::8.8.8.8',
    '2002:808:808::1',
  ])('allows %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false)
  })

  it('blocks anything that is not an IP address', () => {
    for (const s of ['', 'example.com', '1.2.3', '1.2.3.4.5', '256.1.1.1', '1::2::3', ':::', '12345::1', 'g::1']) {
      expect(isBlockedAddress(s)).toBe(true)
    }
  })

  it('tells IP literals from names', () => {
    expect(isIpLiteral('8.8.8.8')).toBe(true)
    expect(isIpLiteral('[2606:4700::1111]')).toBe(true)
    expect(isIpLiteral('survey.example.com')).toBe(false)
    expect(isIpLiteral('1.example.com')).toBe(false)
  })
})

describe('push URL', () => {
  it('builds the RemoteControl 2 endpoint as before', () => {
    expect(endpoint('https://survey.example.com')).toBe('https://survey.example.com/index.php/admin/remotecontrol')
    expect(endpoint('https://survey.example.com/')).toBe('https://survey.example.com/index.php/admin/remotecontrol')
    expect(endpoint('  https://survey.example.com/ls///  ')).toBe(
      'https://survey.example.com/ls/index.php/admin/remotecontrol',
    )
    expect(endpoint('https://survey.example.com/index.php')).toBe(
      'https://survey.example.com/index.php/admin/remotecontrol',
    )
    expect(endpoint('https://survey.example.com/index.php/admin/remotecontrol')).toBe(
      'https://survey.example.com/index.php/admin/remotecontrol',
    )
    expect(endpoint('https://survey.example.com:8443')).toBe(
      'https://survey.example.com:8443/index.php/admin/remotecontrol',
    )
  })

  it('accepts a public IP literal', () => {
    expect(endpoint('https://93.184.216.34')).toBe('https://93.184.216.34/index.php/admin/remotecontrol')
    expect(endpoint('https://[2606:4700:4700::1111]/')).toBe(
      'https://[2606:4700:4700::1111]/index.php/admin/remotecontrol',
    )
  })

  it('drops a fragment', () => {
    expect(endpoint('https://survey.example.com/#/admin')).toBe(
      'https://survey.example.com/index.php/admin/remotecontrol',
    )
  })

  it('rejects text that is not a URL', () => {
    for (const raw of ['', '   ', 'survey.example.com', 'https://', '//survey.example.com', `https://a.example/${'x'.repeat(3000)}`]) {
      expect(endpoint(raw)).toBe('rejected: not-a-url')
    }
    for (const raw of [undefined, null, 42, {}, ['https://survey.example.com']]) {
      expect(checkPushUrl(raw, PUBLIC).ok).toBe(false)
    }
  })

  it('allows https only on the public deployment', () => {
    expect(endpoint('http://survey.example.com')).toBe('rejected: scheme')
    const r = checkPushUrl('http://survey.example.com', PUBLIC)
    expect(!r.ok && r.error).toMatch(/must start with https:\/\//)
  })

  it('allows http when self-hosted', () => {
    expect(endpoint('http://survey.example.com', SELF_HOSTED)).toBe(
      'http://survey.example.com/index.php/admin/remotecontrol',
    )
  })

  it('rejects other schemes under every policy', () => {
    for (const raw of ['ftp://survey.example.com', 'file:///etc/passwd', 'gopher://survey.example.com', 'javascript:alert(1)', 'data:text/plain,x']) {
      expect(endpoint(raw)).toBe('rejected: scheme')
      expect(endpoint(raw, OPTED_IN)).toBe('rejected: scheme')
    }
  })

  it('rejects credentials in the URL', () => {
    expect(endpoint('https://admin:secret@survey.example.com')).toBe('rejected: credentials')
    expect(endpoint('https://admin@survey.example.com')).toBe('rejected: credentials')
    // A public-looking name used as the username part does not hide the real host.
    expect(endpoint('https://survey.example.com@127.0.0.1/')).toBe('rejected: credentials')
  })

  it.each([
    'https://localhost',
    'https://LOCALHOST:8080',
    'https://localhost./',
    'https://ls.localhost',
    'https://127.0.0.1',
    'https://127.1',
    'https://2130706433',
    'https://0x7f.0.0.1',
    'https://0177.0.0.1',
    'https://0.0.0.0',
    'https://10.1.2.3',
    'https://172.20.0.5',
    'https://192.168.0.1:8443',
    'https://169.254.169.254/latest/meta-data/',
    'https://[::1]',
    'https://[::]',
    'https://[fe80::1]',
    'https://[fd00::1]',
    'https://[::ffff:127.0.0.1]',
    'https://[::ffff:a9fe:a9fe]',
    'https://[0:0:0:0:0:0:0:1]',
  ])('rejects %s as private', (raw) => {
    expect(endpoint(raw)).toBe('rejected: private')
    expect(endpoint(raw.replace('https:', 'http:'), SELF_HOSTED)).toBe('rejected: private')
  })

  it('says why in plain words', () => {
    const r = checkPushUrl('https://192.168.0.1', PUBLIC)
    expect(!r.ok && r.error).toMatch(/private or local network/)
    expect(!r.ok && r.error).toMatch(/LSS file/)
  })

  it('allows private targets only when the host opts in', () => {
    expect(endpoint('http://localhost:8080', OPTED_IN)).toBe('http://localhost:8080/index.php/admin/remotecontrol')
    expect(endpoint('http://192.168.0.1', OPTED_IN)).toBe('http://192.168.0.1/index.php/admin/remotecontrol')
  })
})

describe('same-origin check', () => {
  const hosts = ['utilitylab.example']

  it('trusts Sec-Fetch-Site when the browser sends it', () => {
    expect(isSameOriginRequest({ secFetchSite: 'same-origin', hosts })).toBe(true)
    for (const site of ['cross-site', 'same-site', 'none']) {
      expect(isSameOriginRequest({ secFetchSite: site, origin: 'https://utilitylab.example', hosts })).toBe(false)
    }
  })

  it('falls back to Origin against Host', () => {
    expect(isSameOriginRequest({ origin: 'https://utilitylab.example', hosts })).toBe(true)
    expect(isSameOriginRequest({ origin: 'http://localhost:3000', hosts: ['localhost:3000'] })).toBe(true)
    expect(isSameOriginRequest({ origin: 'https://app.example', hosts: ['internal:3000', 'app.example'] })).toBe(true)
    expect(isSameOriginRequest({ origin: 'https://evil.example', hosts })).toBe(false)
    expect(isSameOriginRequest({ origin: 'https://utilitylab.example.evil.example', hosts })).toBe(false)
    expect(isSameOriginRequest({ origin: 'http://localhost:4000', hosts: ['localhost:3000'] })).toBe(false)
    expect(isSameOriginRequest({ origin: 'null', hosts })).toBe(false)
  })

  it('refuses a request with neither header', () => {
    expect(isSameOriginRequest({ hosts })).toBe(false)
    expect(isSameOriginRequest({ secFetchSite: null, origin: null, hosts: [null, undefined] })).toBe(false)
  })
})
