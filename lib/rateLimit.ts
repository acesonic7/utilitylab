// A small sliding-window limiter keyed by client address. Serverless instances do not share
// memory, so this is a per-instance brake on bursts, not a global quota; the hosting firewall
// should carry the global limit.

export type RateLimiter = {
  check: (key: string, now?: number) => { ok: true } | { ok: false; retryAfterSeconds: number }
}

export function createRateLimiter(limit: number, windowMs: number, maxKeys = 5000): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    check(key, now = Date.now()) {
      const since = now - windowMs
      const recent = (hits.get(key) ?? []).filter((t) => t > since)
      if (recent.length >= limit) {
        hits.set(key, recent)
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) }
      }
      recent.push(now)
      hits.delete(key)
      hits.set(key, recent)
      // Forget the least recently seen clients so the map cannot grow without bound.
      while (hits.size > maxKeys) hits.delete(hits.keys().next().value as string)
      return { ok: true }
    },
  }
}

// The client address as the platform reports it: the first x-forwarded-for entry, else x-real-ip.
export function clientKey(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}
