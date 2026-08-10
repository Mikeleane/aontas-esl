
"use client";

import CefrTextTypeControls from "../../_components/CefrTextTypeControls";
import React, { useCallback, useState } from "react";
import TeacherInputsPanel, { TeacherInputsPayload } from "./TeacherInputsPanel";
import ReadingPackApp from "./ReadingPackApp";
import type { ReadingPackData } from "./readingPackTypes";
import { normalizeReadingPack } from "@/lib/contracts/reading";
import type { CefrLevel, TextType } from "@/lib/cefr";

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const text = await res.text().catch(() => "");
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-json
  }

  if (!res.ok) {
    const obj = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const msg = typeof obj.error === "string" ? obj.error : `HTTP ${res.status}`;
    const dbg = obj.debug ? `\n\nDebug:\n${JSON.stringify(obj.debug, null, 2)}` : "";
    throw new Error(`${msg}${dbg}`);
  }

  return (data ?? {}) as T;
}

export default function ReadingStudio() {
  const [pack, setPack] = useState<ReadingPackData | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("B1");
  const [textType, setTextType] = useState<TextType>("article");
  const generateFromInputs = useCallback(async (payload: TeacherInputsPayload) => {
    setBusy("generating");
    setError("");
    try {
      // IMPORTANT: forward what TeacherInputsPanel collected
      // (materials, primaryMaterialId, teacherContext, etc.)
      const body = {
        cefrLevel,
        textType,
        title: payload.title,

        // Allow direct primary fields too (optional)
        primaryText: payload.primaryText,
        materials: payload.materials.map((material) => ({
          id: material.id,
          type: material.kind === "file"
            ? (material.mimeType === "application/pdf" ? "pdf" : material.fileName?.toLowerCase().endsWith(".docx") ? "docx" : "other")
            : material.kind,
          title: material.title,
          url: material.url,
          rawText: material.text,
          fileName: material.fileName,
          mimeType: material.mimeType,
          fileDataUrl: material.dataUrl,
          extractedText: material.extractedText,
          extractionStatus: material.extractedText?.trim() ? "done" : "none",
          useAsPrimaryText: Boolean(material.isPrimary),
        })),
        primaryMaterialId: payload.primaryMaterialId,
        teacherContext: {
          contextTags: payload.enrichment.contextTags,
          crossCurricularLinks: payload.enrichment.crossCurricularLinks,
          authenticMaterialTypes: payload.enrichment.authenticMaterialTypes,
          localVocab: payload.enrichment.localVocabPreferred.join("\n"),
          localGlossary: payload.enrichment.glossary.map((entry) => ({ term: entry.term, note: entry.definition })),
          useLocalContextExactly: payload.enrichment.useLocalContextExactly,
          onlyUseProvidedFacts: payload.enrichment.onlyUseProvidedFacts,
        },

        // PLC / curriculum-ish
        strand: payload.curriculum.strand,
        element: payload.curriculum.element,
        outcomeLabel: payload.curriculum.outcome,
        purpose: payload.curriculum.purpose,
        genre: payload.curriculum.genre,
        form: payload.curriculum.form,
        pilotMode: payload.enrichment.pilotMode ?? payload.curriculum.pilotMode,
      };

      // Debug: open DevTools console and confirm materials/text are here
      console.log("GENERATE payload (client -> API):", body);

      const data = await postJson<{ pack: ReadingPackData }>(
        "/api/reading/generate-pack",
        body
      );

      const got = normalizeReadingPack(data);
      setPack(got);

      try {
        localStorage.setItem("a10_lastReadingPack", JSON.stringify(got));
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy("");
    }
  }, [cefrLevel, textType]);

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>

        <CefrTextTypeControls cefrLevel={cefrLevel} setCefrLevel={setCefrLevel} textType={textType} setTextType={setTextType} />

      </div>

      <TeacherInputsPanel onGenerate={generateFromInputs} />

      <div style={{ height: 12 }} />

      {error && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid rgba(251,146,60,.45)",
            color: "#7c2d12",
            padding: 12,
            borderRadius: 14,
            whiteSpace: "pre-wrap",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ height: 16 }} />

      <div
        style={{
          background: "white",
          border: "1px solid rgba(15,23,42,.12)",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 6px 20px rgba(2,6,23,.06)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Exports</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
              Generate a pack from Teacher Inputs above, then export Interactive HTML / Printables (HTML/PDF/DOCX) here.
            </div>
          </div>

          {busy && (
            <div style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
              {busy === "generating" ? "Generating pack..." : busy}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <ReadingPackApp pack={pack} onPackChange={setPack} />
        </div>
      </div>
    </div>
  );
}
