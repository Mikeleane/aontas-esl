type Bucket = { count: number; resetAt: number };

type RateLimitOptions = {
  bucket: string;
  limit?: number;
  windowMs?: number;
};

const store = new Map<string, Bucket>();

function clientKey(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function checkRateLimit(request: Request, options: RateLimitOptions) {
  const limit = options.limit ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const key = `${options.bucket}:${clientKey(request)}`;
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - existing.count), retryAfterSeconds: 0 };
}
