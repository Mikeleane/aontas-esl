"use client";

import CefrTextTypeControls from "../../_components/CefrTextTypeControls";
import React, { useCallback, useState } from "react";
import TeacherInputsPanel, { TeacherInputsPayload } from "./TeacherInputsPanel";
import ReadingPackApp from "./ReadingPackApp";
import type { ReadingPackData } from "./readingPackTypes";
import { normalizeReadingPack } from "@/lib/contracts/reading";
import type { CefrLevel, TextType } from "@/lib/cefr";
import { DEMO_READING_PACK } from "./demoReadingPack";

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
  const [demoMode, setDemoMode] = useState(false);

  const generateFromInputs = useCallback(async (payload: TeacherInputsPayload) => {
    setDemoMode(false);
    setBusy("generating");
    setError("");
    try {
      const body = {
        cefrLevel,
        textType,
        title: payload.title,
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
        purpose: payload.curriculum.purpose,
        outcomeLabel: [payload.curriculum.focusDetail, payload.curriculum.outcome].filter(Boolean).join("; ") || undefined,
        pilotMode: payload.enrichment.pilotMode ?? payload.curriculum.pilotMode,
      };

      console.log("GENERATE payload (client -> API):", body);

      const data = await postJson<{ pack: ReadingPackData }>("/api/reading/generate-pack", body);
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

  const loadDemoLesson = useCallback(() => {
    setCefrLevel("B1");
    setTextType("article");
    setError("");
    setBusy("");
    setDemoMode(true);
    setPack(DEMO_READING_PACK);
    window.setTimeout(() => {
      document.getElementById("reading-pack-output")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    try {
      localStorage.setItem("a10_lastReadingPack", JSON.stringify(DEMO_READING_PACK));
      localStorage.setItem("aontas_esl_last_pack_json", JSON.stringify(DEMO_READING_PACK));
    } catch {
      // localStorage is optional in development/test environments.
    }
  }, []);

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid rgba(15,23,42,.12)",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 8px 28px rgba(15,23,42,.06)",
  };

  return (
    <div style={{ padding: "18px 18px 40px", maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#166534", fontSize: 12, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" }}>Step 1</div>
            <div style={{ fontWeight: 1000, fontSize: 22, color: "#0f172a", marginTop: 4 }}>Choose the level and format</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 5, marginBottom: 14 }}>
              Set the target CEFR level and the kind of text you want students to work with.
            </div>
          </div>
          <button
            type="button"
            onClick={loadDemoLesson}
            style={{
              border: "1px solid #86efac",
              background: "#f0fdf4",
              color: "#166534",
              borderRadius: 14,
              padding: "10px 13px",
              fontWeight: 950,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Use demo lesson - no API
          </button>
        </div>
        <CefrTextTypeControls
          cefrLevel={cefrLevel}
          setCefrLevel={setCefrLevel}
          textType={textType}
          setTextType={setTextType}
        />
      </section>

      {demoMode && (
        <div style={{ ...card, padding: 14, background: "#eff6ff", borderColor: "#bfdbfe", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950, color: "#1e3a8a" }}>Demo lesson loaded</div>
            <div style={{ color: "#475569", fontSize: 12, marginTop: 3 }}>No OpenAI call was made. Use the Reading, Exercises, Downloads and Wordiness controls below to test the product.</div>
          </div>
          <button type="button" onClick={() => { setPack(null); setDemoMode(false); }} style={{ border: "1px solid #bfdbfe", background: "white", color: "#1e3a8a", borderRadius: 12, padding: "8px 10px", fontWeight: 900, cursor: "pointer" }}>Clear demo</button>
        </div>
      )}

      <TeacherInputsPanel onGenerate={generateFromInputs} busy={busy === "generating"} />

      {busy === "generating" && (
        <div style={{ ...card, background: "#f0fdf4", borderColor: "rgba(22,101,52,.22)", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: "#16a34a" }} />
          <div>
            <div style={{ fontWeight: 950, color: "#166534" }}>Generating your reading pack...</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Creating Standard and Supported routes with aligned exercises.</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ ...card, background: "#fff7ed", borderColor: "rgba(251,146,60,.45)", color: "#7c2d12", whiteSpace: "pre-wrap", fontSize: 13, fontWeight: 700 }}>
          <div style={{ fontWeight: 1000, marginBottom: 5 }}>Generation problem</div>
          {error}
        </div>
      )}

      {pack && (
        <section id="reading-pack-output" style={{ display: "grid", gap: 10, scrollMarginTop: 20 }}>
          <div>
            <div style={{ color: "#166534", fontSize: 12, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" }}>Step 4</div>
            <div style={{ fontWeight: 1000, fontSize: 22, color: "#0f172a", marginTop: 4 }}>Your reading pack</div>
          </div>
          <ReadingPackApp pack={pack} onPackChange={setPack} />
        </section>
      )}
    </div>
  );
}
