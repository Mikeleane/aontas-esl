// lib/exporters.ts
// Central export barrel used by ReadingPackApp.tsx.
// Provides "compat" wrappers so UI can pass { pack, ... } while core builders may expect (pack, opts).

import type { ReadingPackData } from "@/lib/contracts/reading";

import { buildInteractiveHtml as coreBuildInteractiveHtml } from "@/app/_features/reading/exports/interactiveHtml";
import { buildPrintablesPdfBytes as coreBuildPrintablesPdfBytes } from "@/app/_features/reading/exports/printablesPdf";
import { buildPrintablesDocxBlob as coreBuildPrintablesDocxBlob } from "@/app/_features/reading/exports/printablesDocx";
import { exportSocialThreadHtml } from "@/app/_features/social/exports/socialThreadExport";

export { exportSocialThreadHtml };

type PackArg =
  | { pack: ReadingPackData; [k: string]: any }
  | ReadingPackData
  | any;

function splitPackArg(arg: PackArg) {
  const hasPack = arg && typeof arg === "object" && "pack" in arg;
  const pack = hasPack ? (arg as any).pack : arg;
  const opts = hasPack ? { ...(arg as any) } : undefined;
  if (opts) delete (opts as any).pack;
  return { pack, opts, hasPack };
}

function inferPackFromArgs(args: any[]) {
  const firstObj = args.find(a => a && typeof a === "object");
  const pack = firstObj?.pack ?? firstObj?.readingPack ?? args[0] ?? null;
  const title =
    firstObj?.title ??
    firstObj?.meta?.title ??
    pack?.title ??
    "Reading Pack";
  return { pack, title, opts: firstObj };
}

function toArrayBuffer(x: any): ArrayBuffer {
  if (x instanceof ArrayBuffer) return x;

  if (x && typeof x === "object" && x.buffer && typeof x.byteLength === "number") {
    const u8 = x instanceof Uint8Array ? x : new Uint8Array(x);
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  }

  const B: any = (globalThis as any).Buffer;
  if (B && B.isBuffer?.(x)) {
    return x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength);
  }

  throw new Error("Unsupported PDF bytes type");
}
function fallbackHtml(kind: string, title: string, pack: any) {
  const safeJson = (() => {
    try { return JSON.stringify(pack ?? null, null, 2); } catch { return String(pack); }
  })();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} – ${kind}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.35;padding:24px}
    h1{margin:0 0 8px 0;font-size:20px}
    .note{margin:0 0 16px 0;color:#555}
    pre{white-space:pre-wrap;word-wrap:break-word;background:#f6f6f6;padding:12px;border-radius:10px}
  </style>
</head>
<body>
  <h1>${title} – ${kind}</h1>
  <p class="note">Fallback HTML: the dedicated ${kind} builder isn’t wired yet in this repo.</p>
  <pre>${safeJson}</pre>
</body>
</html>`;
}

/** ✅ Wrapper: UI calls buildInteractiveHtml({ pack, ... }) */
export async function buildInteractiveHtml(arg: PackArg): Promise<string> {
  const { pack, opts, hasPack } = splitPackArg(arg);

  try {
    return await (coreBuildInteractiveHtml as any)(pack, opts);
  } catch (e1) {
    try {
      return await (coreBuildInteractiveHtml as any)(pack);
    } catch (e2) {
      return hasPack
        ? fallbackHtml("Interactive", pack?.title ?? "Reading Pack", pack)
        : await (coreBuildInteractiveHtml as any)(arg);
    }
  }
}

/** ✅ Wrapper: UI calls buildPrintablesPdfBytes({ pack, ... }) */
export async function buildPrintablesPdfBytes(arg: PackArg): Promise<ArrayBuffer> {
  const { pack, opts } = splitPackArg(arg);

  let out: any;
  try {
    out = await (coreBuildPrintablesPdfBytes as any)(pack, opts);
  } catch {
    try {
      out = await (coreBuildPrintablesPdfBytes as any)(pack);
    } catch {
      out = await (coreBuildPrintablesPdfBytes as any)(arg);
    }
  }

  return toArrayBuffer(out);
}
/** ✅ Wrapper: UI calls buildPrintablesDocxBlob({ pack, ... }) */
export async function buildPrintablesDocxBlob(arg: PackArg): Promise<Blob> {
  const { pack, opts } = splitPackArg(arg);

  try {
    return await (coreBuildPrintablesDocxBlob as any)(pack, opts);
  } catch (e1) {
    try {
      return await (coreBuildPrintablesDocxBlob as any)(pack);
    } catch (e2) {
      return await (coreBuildPrintablesDocxBlob as any)(arg);
    }
  }
}

/** Expected by ReadingPackApp.tsx. Currently a safe fallback HTML. */
export async function buildPrintablesHtml(...args: any[]): Promise<string> {
  const { pack, title } = inferPackFromArgs(args);
  return fallbackHtml("Printables", title, pack);
}

/** Expected by ReadingPackApp.tsx. Currently a safe fallback HTML. */
export async function buildTeacherKeyHtml(...args: any[]): Promise<string> {
  const { pack, title } = inferPackFromArgs(args);
  return fallbackHtml("Teacher Key", title, pack);
}

