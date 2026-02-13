
"use client";

import React, { useCallback, useState } from "react";
import TeacherInputsPanel, { TeacherInputsPayload } from "./TeacherInputsPanel";
import ReadingPackApp from "./ReadingPackApp";
import type { ReadingPackData } from "./readingPackTypes";

async function postJson<T>(url: string, body: any, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // non-json
  }

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const dbg = data?.debug ? `\n\nDebug:\n${JSON.stringify(data.debug, null, 2)}` : "";
    throw new Error(`${msg}${dbg}`);
  }

  return (data ?? {}) as T;
}

export default function ReadingStudio() {
  const [pack, setPack] = useState<ReadingPackData | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");

  const generateFromInputs = useCallback(async (payload: TeacherInputsPayload) => {
    setBusy("generating");
    setError("");
    try {
      // IMPORTANT: forward what TeacherInputsPanel collected
      // (materials, primaryMaterialId, teacherContext, etc.)
      const body = {
        title: payload.title,
        stage: payload.curriculum?.stage,
        schoolClass: payload.curriculum?.classLevel,

        // Allow direct primary fields too (optional)
        primaryText: (payload as any).primaryText,
        primaryUrl: (payload as any).primaryUrl,
        primaryImageDataUrl: (payload as any).primaryImageDataUrl,

        materials: (payload as any).materials,
        primaryMaterialId: (payload as any).primaryMaterialId,
        teacherContext: (payload as any).teacherContext,

        // PLC / curriculum-ish
        strand: (payload.curriculum as any)?.strand,
        element: (payload.curriculum as any)?.element,
        outcomeLabel: (payload.curriculum as any)?.outcomeLabel,
        mode: (payload.curriculum as any)?.mode,
        purpose: (payload.curriculum as any)?.purpose,
        genre: (payload.curriculum as any)?.genre,
        form: (payload.curriculum as any)?.form,

        exerciseBlocks: (payload as any).exerciseBlocks,
        pilotMode: (payload as any).pilotMode ?? payload.curriculum?.pilotMode,
      };

      // Debug: open DevTools console and confirm materials/text are here
      console.log("GENERATE payload (client -> API):", body);

      const data = await postJson<{ pack: ReadingPackData }>(
        "/api/reading/generate-pack",
        body
      );

      const got = (data as any).pack ?? (data as any);
      setPack(got);

      try {
        localStorage.setItem("a10_lastReadingPack", JSON.stringify(got));
      } catch {
        // ignore
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Generate failed");
    } finally {
      setBusy("");
    }
  }, []);

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
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
              {busy === "generating" ? "Generating pack…" : busy}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <ReadingPackApp pack={pack} crestFallbackPath="/kns-crest.jpg" onPackChange={setPack} />
        </div>
      </div>
    </div>
  );
}
