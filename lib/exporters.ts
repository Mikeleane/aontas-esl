// lib/exporters.ts
// Typed export facade used by ReadingPackApp.tsx.
// Phase 3A removes the old try/catch compatibility maze so every button reaches
// the real canonical Reading export builder.

import type { ReadingMode, ReadingPackData } from "@/lib/contracts/reading";

import { buildInteractiveHtml as coreBuildInteractiveHtml } from "@/app/_features/reading/exports/interactiveHtml";
import {
  buildPrintablesHtml as coreBuildPrintablesHtml,
  buildTeacherKeyHtml as coreBuildTeacherKeyHtml,
} from "@/app/_features/reading/exports/printablesHtml";
import { buildPrintablesPdfBytes as coreBuildPrintablesPdfBytes } from "@/app/_features/reading/exports/printablesPdf";
import { buildPrintablesDocxBlob as coreBuildPrintablesDocxBlob } from "@/app/_features/reading/exports/printablesDocx";
import { exportSocialThreadHtml } from "@/app/_features/social/exports/socialThreadExport";

export { exportSocialThreadHtml };

type ReadingExportRequest = {
  pack: ReadingPackData;
  mode?: ReadingMode;
  includeAnswers?: boolean;
  // Retained for API compatibility with the UI. Canonical exporters read crest
  // data from the pack itself and therefore do not need this path.
  crestFallbackPath?: string;
};

function modeOf(request: ReadingExportRequest): ReadingMode {
  return request.mode === "supported" ? "supported" : "standard";
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function buildInteractiveHtml(request: ReadingExportRequest): Promise<string> {
  return coreBuildInteractiveHtml(request.pack);
}

export async function buildPrintablesHtml(request: ReadingExportRequest): Promise<string> {
  return coreBuildPrintablesHtml(request.pack, modeOf(request), request.includeAnswers ?? false);
}

export async function buildTeacherKeyHtml(request: Pick<ReadingExportRequest, "pack" | "crestFallbackPath">): Promise<string> {
  return coreBuildTeacherKeyHtml(request.pack);
}

export async function buildPrintablesPdfBytes(request: ReadingExportRequest): Promise<ArrayBuffer> {
  const bytes = await coreBuildPrintablesPdfBytes(request.pack, {
    mode: modeOf(request),
    includeAnswers: request.includeAnswers ?? false,
  });
  return asArrayBuffer(bytes);
}

export async function buildPrintablesDocxBlob(request: ReadingExportRequest): Promise<Blob> {
  return coreBuildPrintablesDocxBlob(request.pack, {
    mode: modeOf(request),
    includeAnswers: request.includeAnswers ?? false,
  });
}
