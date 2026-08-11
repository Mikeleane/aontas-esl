"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { normalizeReadingPack } from "@/lib/contracts/reading";
import type { ReadingPackData } from "./readingPackTypes";

// Keep these re-exports so any existing imports don't break
export type { ReadingMode, ReadingPackData, ExerciseItem, ExerciseSide } from "./readingPackTypes";

// If your real helper lives somewhere else, adjust this ONE import.
// (Your error was from using "./wordiness/..." which doesn't exist under /reading)
import { buildWordinessSeedFromVariants } from "../wordiness/buildWordinessSeed";

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
  pack: ReadingPackData | null;
  crestFallbackPath?: string;
  onPackChange?: (pack: ReadingPackData | null) => void;
};

function safeText(v: unknown): string {
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

export default function ReadingPackApp({ pack, crestFallbackPath = "", onPackChange }: Props) {
  const packAny = useMemo(() => (pack ? normalizeReadingPack(pack) : null), [pack]);

  const [view, setView] = useState<"reading" | "exercises" | "exports">("reading");
  const [busy, setBusy] = useState<"" | "exporting">("");

  const readingStandard = packAny?.reading.standard ?? "";
  const readingSupported = packAny?.reading.supported ?? "";
  const exercises = packAny?.exercises ?? [];

  const packSummary = useMemo(() => {
    if (!packAny) return "No pack loaded yet. Generate a pack to see the reading text + exercises.";

    const bits = [
      `CEFR ${packAny.cefrLevel}`,
      `Text type: ${packAny.textType}`,
      packAny.title && `Topic: ${packAny.title}`,
    ].filter(Boolean);
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
      if (raw) onPackChange?.(normalizeReadingPack(JSON.parse(raw)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep Wordiness tied to this Reading Pack while preserving both CEFR routes.
  // The v2 seed bridge exposes a flat text/seedText view to legacy games at launch time.
  useEffect(() => {
    try {
      if (!packAny) return;
      if (!readingStandard.trim() && !readingSupported.trim()) return;
      const seed = buildWordinessSeedFromVariants({
        standard: readingStandard || readingSupported,
        supported: readingSupported || readingStandard,
        cefrLevel: packAny.cefrLevel,
        textType: packAny.textType,
        activeVariant: "standard",
        source: "reading-pack",
        title: packAny.title,
      });
      localStorage.setItem("wordiness_seed_json", JSON.stringify(seed));
    } catch {}
  }, [packAny, readingStandard, readingSupported]);

  const nameBase = useMemo(() => slugify(packAny?.title || "reading-pack"), [packAny]);

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
            {pillBtn("exports", "Downloads")}
          </div>
        </div>
      </div>

      {view === "reading" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 14 }}>
            <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(15,23,42,.10)", background: "white" }}>
              <div style={{ fontWeight: 1000, marginBottom: 4 }}>Standard version</div>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>Target-level reading for the class.</div>
              {renderParagraphs(readingStandard)}
            </div>
            <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(15,23,42,.10)", background: "white" }}>
              <div style={{ fontWeight: 1000, marginBottom: 4 }}>Supported version</div>
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>Same learning target with additional language support.</div>
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
              {exercises.map((it, idx: number) => {
                const id = it?.id ?? idx + 1;
                const type = safeText(it?.type) || safeText(it?.skill) || "exercise";

                const stdPrompt = it.standard.prompt;
                const supPrompt = it.supported.prompt;

                const stdOptions: string[] = it.standard.options ?? [];
                const supOptions: string[] = it.supported.options ?? [];

                const answer = Array.isArray(it.answer) ? it.answer.join("; ") : safeText(it.answer);

                return (
                  <div key={id} style={{ border: "1px solid rgba(15,23,42,.10)", borderRadius: 16, padding: 14 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 1000 }}>#{id}</span>
                      <span style={{ color: "#64748b", fontWeight: 800 }}>{type}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 12, marginTop: 12 }}>
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
          <div style={{ fontWeight: 1000, marginBottom: 10 }}>Downloads</div>
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

      {packAny && (
        <div style={{ padding: 16, borderRadius: 18, border: "1px solid rgba(15,23,42,.10)", background: "#f8fafc" }}>
          <div style={{ fontWeight: 1000, color: "#0f172a" }}>Continue with this pack</div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4, marginBottom: 10 }}>
            Use the same reading in another activity without starting again.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => window.open("/wordiness", "_blank")} style={{ padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(15,23,42,.16)", background: "white", fontWeight: 900, cursor: "pointer" }}>Wordiness</button>
            <button onClick={() => window.open("/social", "_blank")} style={{ padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(15,23,42,.16)", background: "white", fontWeight: 900, cursor: "pointer" }}>Social Thread</button>
            <button onClick={() => window.open("/h5p", "_blank")} style={{ padding: "9px 12px", borderRadius: 999, border: "1px solid rgba(15,23,42,.16)", background: "white", fontWeight: 900, cursor: "pointer" }}>H5P Word Order</button>
          </div>
        </div>
      )}
    </div>
  );
}
