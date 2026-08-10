import { NextResponse } from "next/server";
import { checkRateLimit } from "./rateLimit";

export type ApiErrorPayload = {
  error: string;
  code?: string;
};

export function jsonError(message: string, status: number, code?: string, headers?: HeadersInit) {
  const payload: ApiErrorPayload = { error: message };
  if (code) payload.code = code;
  return NextResponse.json(payload, { status, headers });
}

export function enforceRateLimit(
  request: Request,
  options: { bucket: string; limit?: number; windowMs?: number }
): NextResponse | null {
  const rate = checkRateLimit(request, options);
  if (rate.allowed) return null;

  return jsonError(
    "Too many requests. Please try again shortly.",
    429,
    "RATE_LIMITED",
    { "Retry-After": String(rate.retryAfterSeconds) }
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return asRecord(value);
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
