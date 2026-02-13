"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";

// Keep these re-exports so any existing imports don't break
export type { ReadingMode, ReadingPackData, ExerciseItem, ExerciseSide } from "./readingPackTypes";

// If your real helper lives somewhere else, adjust this ONE import.
// (Your error was from using "./wordiness/..." which doesn't exist under /reading)
import { buildWordinessSeedFromText } from "../wordiness/buildWordinessSeed";

// If you already have exporters wired up, keep these imports.
// If you don't, comment them out + the export buttons below.
import {
  buildInteractiveHtml,
  buildPrintablesHtml,
  buildTeacherKeyHtml,
  buildPrintablesPdfBytes,
  buildPrintablesDocxBlob,
} from "@/lib/exporters";

type Props = {
  pack: any | null;
  crestFallbackPath?: string;
  onPackChange?: React.Dispatch<React.SetStateAction<any | null>>;
};

function safeText(v: any): string {
  return typeof v === "string" ? v : "";
}

function slugify(s: string): string {
  return (s || "reading-pack")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// Robustly pull reading text out of whatever shape the pack currently has.
function extractReadingText(pack: any, variant: "standard" | "SUPPORTED"): string {
  if (!pack) return "";

  const pick = (v: any) => (typeof v === "string" ? v : "");
  const src = variant === "SUPPORTED" ? "SUPPORTED" : "standard";

  // Common field names across Aontas variants
  const candidates: any[] = [
    pack?.[`${src}Text`],
    pack?.[`${src.toLowerCase()}Text`],
    pack?.[src],
    pack?.text,
    pack?.primaryText,
    pack?.articleText,
    pack?.readingText,
    pack?.passage,
    pack?.content,

    // Sometimes nested
    pack?.reading?.[`${src}Text`],
    pack?.reading?.[src],
    pack?.reading?.text,

    // Sometimes inside meta
    pack?.meta?.[`${src}Text`],
    pack?.meta?.[src],
  ];

  for (const c of candidates) {
    const s = pick(c);
    if (s.trim()) return s;
  }

  return "";
}

function getExercises(pack: any): any[] {
  if (!pack) return [];
  // Different shapes seen in different repos/patches:
  const a = pack?.exercises?.items;
  const b = pack?.exercises;
  const c = pack?.items;
  const d = pack?.exerciseItems;

  const raw = Array.isArray(a) ? a : Array.isArray(b) ? b : Array.isArray(c) ? c : Array.isArray(d) ? d : [];
  return raw.filter(Boolean);
}

function renderParagraphs(text: string) {
  const t = (text || "").trim();
  if (!t) return <div style={{ color: "#64748b" }}>No reading text found in this pack yet.</div>;

  const parts = t.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {parts.map((p, i) => (
        <p key={i} style={{ margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {p}
        </p>
      ))}
    </div>
  );
}

export default function ReadingPackApp({ pack, crestFallbackPath = "/kns-crest.jpg", onPackChange }: Props) {
  const packAny = pack as any;

  const [view, setView] = useState<"reading" | "exercises" | "exports">("reading");
  const [busy, setBusy] = useState<"" | "exporting">("");

  const readingStandard = useMemo(() => extractReadingText(packAny, "standard"), [packAny]);
  const readingSupported = useMemo(() => extractReadingText(packAny, "SUPPORTED"), [packAny]);
  const exercises = useMemo(() => getExercises(packAny), [packAny]);

  const packSummary = useMemo(() => {
    if (!packAny) return "No pack loaded yet. Generate a pack to see the reading text + exercises.";

    const lvl =
      safeText(packAny.cefrLevel) ||
      safeText(packAny.level) ||
      safeText(packAny.meta?.cefrLevel) ||
      safeText(packAny.meta?.level) ||
      "";

    const textType =
      safeText(packAny.textType) ||
      safeText(packAny.meta?.textType) ||
      safeText(packAny.kind) ||
      "";

    const topic =
      safeText(packAny.topic) ||
      safeText(packAny.meta?.topic) ||
      safeText(packAny.title) ||
      "";

    const bits = [lvl && `CEFR ${lvl}`, textType && `Text type: ${textType}`, topic && `Topic: ${topic}`].filter(Boolean);
    return bits.length ? bits.join(" | ") : "Reading pack generated.";
  }, [packAny]);

  // Persist pack locally so refresh doesn't wipe it.
  useEffect(() => {
    if (!packAny) return;
    try {
      localStorage.setItem("aontas_esl_last_pack_json", JSON.stringify(packAny));
    } catch {}
  }, [packAny]);

  // Restore on first mount if parent didn't pass a pack yet.
  useEffect(() => {
    if (packAny) return;
    try {
      const raw = localStorage.getItem("aontas_esl_last_pack_json");
      if (raw) onPackChange?.(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wordiness seed derived from reading text so Wordiness is always "about this pack".
  useEffect(() => {
    try {
      if (!packAny) return;
      const textForSeed = readingStandard || readingSupported || "";
      if (!textForSeed.trim()) return;
      const seed = buildWordinessSeedFromText(textForSeed, "reading-pack");
      localStorage.setItem("wordiness_seed_json", JSON.stringify(seed));
    } catch {}
  }, [packAny, readingStandard, readingSupported]);

  const nameBase = useMemo(() => slugify(packAny?.title || packAny?.topic || "reading-pack"), [packAny]);

  const doExportInteractive = useCallback(async () => {
    if (!packAny) return;
    setBusy("exporting");
    try {
      const html = await buildInteractiveHtml({ pack: packAny, crestFallbackPath, mode: "standard" });
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${nameBase}-interactive.html`);
    } finally {
      setBusy("");
    }
  }, [packAny, crestFallbackPath, nameBase]);

  const doExportPrintHtml = useCallback(async () => {
    if (!packAny) return;
    setBusy("exporting");
    try {
      const html = await buildPrintablesHtml({ pack: packAny, crestFallbackPath, mode: "standard" });
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${nameBase}-print.html`);
    } finally {
      setBusy("");
    }
  }, [packAny, crestFallbackPath, nameBase]);

  const doExportTeacherKey = useCallback(async () => {
    if (!packAny) return;
    setBusy("exporting");
    try {
      const html = await buildTeacherKeyHtml({ pack: packAny, crestFallbackPath });
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${nameBase}-teacher-key.html`);
    } finally {
      setBusy("");
    }
  }, [packAny, crestFallbackPath, nameBase]);

  const doExportPdf = useCallback(async () => {
    if (!packAny) return;
    setBusy("exporting");
    try {
      const bytes = await buildPrintablesPdfBytes({ pack: packAny, crestFallbackPath, mode: "standard" });
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), `${nameBase}.pdf`);
    } finally {
      setBusy("");
    }
  }, [packAny, crestFallbackPath, nameBase]);

  const doExportDocx = useCallback(async () => {
    if (!packAny) return;
    setBusy("exporting");
    try {
      const blob = await buildPrintablesDocxBlob({ pack: packAny, crestFallbackPath, mode: "standard" });
      downloadBlob(blob, `${nameBase}.docx`);
    } finally {
      setBusy("");
    }
  }, [packAny, crestFallbackPath, nameBase]);

  const pillBtn = (key: typeof view, label: string) => (
    <button
      onClick={() => setView(key)}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: "1px solid rgba(15,23,42,.16)",
        background: view === key ? "#0f172a" : "white",
        color: view === key ? "white" : "#0f172a",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(15,23,42,.10)", background: "white" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 22, color: "#0f172a" }}>Reading Pack</div>
            <div style={{ color: "#64748b", marginTop: 6, fontSize: 13 }}>{packSummary}</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {pillBtn("reading", "Reading")}
            {pillBtn("exercises", "Exercises")}
            {pillBtn("exports", "Exports")}
            <button
              onClick={() => window.open("/wordiness", "_blank")}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,.16)",
                background: "white",
                color: "#0f172a",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Wordiness
            </button>
            <button
              onClick={() => window.open("/social", "_blank")}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,.16)",
                background: "white",
                color: "#0f172a",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Social
            </button>
            <button
              onClick={() => window.open("/h5p", "_blank")}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid rgba(15,23,42,.16)",
                background: "white",
                color: "#0f172a",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              H5P
            </button>
          </div>
        </div>
      </div>

      {view === "reading" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(15,23,42,.10)", background: "white" }}>
              <div style={{ fontWeight: 1000, marginBottom: 10 }}>STANDARD</div>
              {renderParagraphs(readingStandard)}
            </div>
            <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(15,23,42,.10)", background: "white" }}>
              <div style={{ fontWeight: 1000, marginBottom: 10 }}>SUPPORTED</div>
              {renderParagraphs(readingSupported)}
            </div>
          </div>
        </div>
      )}

      {view === "exercises" && (
        <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(15,23,42,.10)", background: "white" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Exercises</div>

          {!exercises.length ? (
            <div style={{ color: "#64748b" }}>No exercises found in this pack yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {exercises.map((it: any, idx: number) => {
                const id = it?.id ?? idx + 1;
                const type = safeText(it?.type) || safeText(it?.skill) || "exercise";

                const stdPrompt = safeText(it?.standard?.prompt) || safeText(it?.prompt) || "";
                const supPrompt = safeText(it?.adapted?.prompt) || safeText(it?.supported?.prompt) || "";

                const stdOptions: string[] = Array.isArray(it?.standard?.options) ? it.standard.options : [];
                const supOptions: string[] = Array.isArray(it?.adapted?.options)
                  ? it.adapted.options
                  : Array.isArray(it?.supported?.options)
                    ? it.supported.options
                    : [];

                const answer = safeText(it?.answer);

                return (
                  <div key={id} style={{ border: "1px solid rgba(15,23,42,.10)", borderRadius: 16, padding: 14 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 1000 }}>#{id}</span>
                      <span style={{ color: "#64748b", fontWeight: 800 }}>{type}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <div style={{ background: "rgba(2,6,23,.03)", borderRadius: 14, padding: 12 }}>
                        <div style={{ fontWeight: 1000, marginBottom: 8 }}>STANDARD</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{stdPrompt || "No prompt."}</div>
                        {stdOptions.length > 0 && (
                          <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18 }}>
                            {stdOptions.map((o, i) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div style={{ background: "rgba(2,6,23,.03)", borderRadius: 14, padding: 12 }}>
                        <div style={{ fontWeight: 1000, marginBottom: 8 }}>SUPPORTED</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{supPrompt || "No prompt."}</div>
                        {supOptions.length > 0 && (
                          <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18 }}>
                            {supOptions.map((o, i) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {answer && (
                      <div style={{ marginTop: 10, color: "#0f172a" }}>
                        <span style={{ fontWeight: 1000 }}>Answer: </span>
                        {answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "exports" && (
        <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(15,23,42,.10)", background: "white" }}>
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Exports</div>
          <div style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
            Interactive export is separate. Printables can export as HTML (quick print), PDF, or DOCX.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button disabled={!packAny || busy === "exporting"} onClick={doExportInteractive} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}>
              Export interactive HTML
            </button>
            <button disabled={!packAny || busy === "exporting"} onClick={doExportPrintHtml} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}>
              Export print HTML
            </button>
            <button disabled={!packAny || busy === "exporting"} onClick={doExportTeacherKey} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}>
              Export teacher key HTML
            </button>
            <button disabled={!packAny || busy === "exporting"} onClick={doExportPdf} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}>
              Export PDF
            </button>
            <button disabled={!packAny || busy === "exporting"} onClick={doExportDocx} style={{ padding: "10px 14px", borderRadius: 12, fontWeight: 900, cursor: "pointer" }}>
              Export DOCX
            </button>
          </div>

          {busy === "exporting" && <div style={{ marginTop: 10, color: "#64748b" }}>Exporting...</div>}
        </div>
      )}
    </div>
  );
}
