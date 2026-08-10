import { lookup } from "node:dns/promises";
import net from "node:net";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_REDIRECTS = 4;

export type ExternalTextResult = {
  finalUrl: string;
  contentType: string;
  text: string;
  status: number;
};

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function inV4Range(ip: number, base: string, prefix: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt == null) return true;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) === (baseInt & mask);
}

function isBlockedIp(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const ip = ipv4ToInt(address);
    if (ip == null) return true;
    const blocked: Array<[string, number]> = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return blocked.some(([base, prefix]) => inV4Range(ip, base, prefix));
  }

  if (version === 6) {
    const ip = address.toLowerCase();
    if (ip === "::" || ip === "::1") return true;
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true;
    if (ip.startsWith("ff")) return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }

  return true;
}

async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not allowed.");
  if (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))) {
    throw new Error("Only standard HTTP/HTTPS ports are allowed.");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Local or internal URLs are not allowed.");
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error("Private or reserved network addresses are not allowed.");
    return url;
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve the URL hostname.");
  }
  if (!addresses.length || addresses.some((entry) => isBlockedIp(entry.address))) {
    throw new Error("URL resolves to a private or reserved network address.");
  }

  return url;
}

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const declared = Number(lengthHeader);
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Remote response is too large.");
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response too large").catch(() => undefined);
        throw new Error("Remote response is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function fetchExternalText(
  rawUrl: string,
  options: {
    headers?: HeadersInit;
    maxBytes?: number;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<ExternalTextResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let current = await assertPublicHttpUrl(rawUrl);

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: options.headers,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects === maxRedirects) throw new Error("Too many redirects.");
        const location = response.headers.get("location");
        if (!location) throw new Error("Remote redirect did not include a destination.");
        current = await assertPublicHttpUrl(new URL(location, current).toString());
        continue;
      }

      const text = await readBodyWithLimit(response, maxBytes);
      return {
        finalUrl: current.toString(),
        contentType: response.headers.get("content-type") || "",
        text,
        status: response.status,
      };
    } catch (error: any) {
      if (error?.name === "AbortError") throw new Error("Remote request timed out.");
      if (error instanceof Error && !/^fetch failed$/i.test(error.message)) throw error;
      throw new Error("Could not fetch the remote URL.");
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Too many redirects.");
}
