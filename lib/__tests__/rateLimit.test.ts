import { describe, expect, it } from 'vitest'
import { clientKey, createRateLimiter } from '../rateLimit'

describe('rate limiter', () => {
  it('allows up to the limit in a window, then refuses with a retry time', () => {
    const l = createRateLimiter(3, 60_000)
    expect([0, 1, 2].map((t) => l.check('a', t).ok)).toEqual([true, true, true])
    const r = l.check('a', 10_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.retryAfterSeconds).toBe(50)
    expect(l.check('b', 10_000).ok).toBe(true)
  })
  it('frees capacity as the window slides', () => {
    const l = createRateLimiter(2, 1000)
    l.check('a', 0)
    l.check('a', 500)
    expect(l.check('a', 900).ok).toBe(false)
    expect(l.check('a', 1001).ok).toBe(true)
  })
  it('caps how many clients it remembers', () => {
    const l = createRateLimiter(1, 60_000, 2)
    l.check('a', 0)
    l.check('b', 0)
    l.check('c', 0)
    expect(l.check('a', 1).ok).toBe(true)
  })
  it('reads the client from forwarding headers', () => {
    const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null })
    expect(clientKey(h({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
    expect(clientKey(h({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientKey(h({}))).toBe('unknown')
  })
})
