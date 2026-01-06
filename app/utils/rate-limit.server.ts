
// Simple in-memory rate limiter for MVP
const cache = new Map<string, { count: number; expires: number }>();

const LIMIT = 100; // requests
const WINDOW = 60 * 1000; // 1 minute in ms

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = cache.get(ip);

  if (!record || record.expires < now) {
    cache.set(ip, { count: 1, expires: now + WINDOW });
    return true;
  }

  if (record.count >= LIMIT) {
    return false;
  }

  record.count += 1;
  return true;
}

// Cleanup task every 5 minutes
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now();
        for (const [ip, record] of cache.entries()) {
            if (record.expires < now) {
                cache.delete(ip);
            }
        }
    }, 5 * 60 * 1000);
}
