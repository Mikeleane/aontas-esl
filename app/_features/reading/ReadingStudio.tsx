"use client";

import CefrTextTypeControls from "../../_components/CefrTextTypeControls";
import React, { useCallback, useState } from "react";
import TeacherInputsPanel, { TeacherInputsPayload } from "./TeacherInputsPanel";
import ReadingPackApp from "./ReadingPackApp";
import type { ReadingPackData } from "./readingPackTypes";
import { normalizeReadingPack } from "@/lib/contracts/reading";
import type { CefrLevel, TextType } from "@/lib/cefr";
import { DEMO_READING_PACK } from "./demoReadingPack";

type FailedPackReport = {
  reportType: "aontas-reading-pack-failed-qa";
  reportVersion: 1;
  exportedAt: string;
  modelRequested: string;
  cefrLevel: CefrLevel;
  textType: TextType;
  qualityIssues: string[];
  rejectedPack: ReadingPackData;
};

class GenerationRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly qualityIssues: string[] = [],
    readonly rejectedPack?: ReadingPackData
  ) {
    super(message);
    this.name = "GenerationRequestError";
  }
}

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
    const issues = Array.isArray(obj.qualityIssues)
      ? obj.qualityIssues.filter((issue): issue is string => typeof issue === "string")
      : [];
    const rejectedPack = res.status === 422 && obj.rejectedPack && typeof obj.rejectedPack === "object"
      ? normalizeReadingPack(obj.rejectedPack)
      : undefined;
    throw new GenerationRequestError(`${msg}${dbg}`, res.status, issues, rejectedPack);
  }

  return (data ?? {}) as T;
}

export default function ReadingStudio() {
  const [pack, setPack] = useState<ReadingPackData | null>(null);
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [qualityIssues, setQualityIssues] = useState<string[]>([]);
  const [failedPackReport, setFailedPackReport] = useState<FailedPackReport | null>(null);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("B1");
  const [textType, setTextType] = useState<TextType>("article");
  const [demoMode, setDemoMode] = useState(false);
  const [qaModel, setQaModel] = useState("default");
  const [qaCustomModel, setQaCustomModel] = useState("");

  const generateFromInputs = useCallback(async (payload: TeacherInputsPayload) => {
    setDemoMode(false);
    setBusy("generating");
    setError("");
    setQualityIssues([]);
    setFailedPackReport(null);
    try {
      const body = {
        cefrLevel,
        textType,
        ...(process.env.NODE_ENV !== "production" && qaModel !== "default" ? { qaModel: qaModel === "custom" ? qaCustomModel.trim() : qaModel } : {}),
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

      // Do not log lesson sources or teacher-provided information to the browser console.

      const data = await postJson<{ pack: ReadingPackData }>("/api/reading/generate-pack", body);
      const got = normalizeReadingPack(data);
      setPack(got);

      try {
        localStorage.setItem("a10_lastReadingPack", JSON.stringify(got));
      } catch {
        // ignore
      }
    } catch (e: unknown) {
      if (e instanceof GenerationRequestError) {
        setError(e.message);
        setQualityIssues(e.qualityIssues);
        if (e.rejectedPack && process.env.NODE_ENV !== "production") {
          setFailedPackReport({
            reportType: "aontas-reading-pack-failed-qa",
            reportVersion: 1,
            exportedAt: new Date().toISOString(),
            modelRequested: qaModel === "custom" ? qaCustomModel.trim() : qaModel,
            cefrLevel,
            textType,
            qualityIssues: e.qualityIssues,
            rejectedPack: e.rejectedPack,
          });
        }
        // A quality rejection is an expected application response, not a Next.js console crash.
      } else {
        console.error("Unexpected reading generation error", e);
        setError(e instanceof Error ? e.message : "Generate failed");
      }
    } finally {
      setBusy("");
    }
  }, [cefrLevel, textType, qaModel, qaCustomModel]);

  const loadDemoLesson = useCallback(() => {
    setCefrLevel("B1");
    setTextType("article");
    setError("");
    setQualityIssues([]);
    setFailedPackReport(null);
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

  const downloadFailedQaReport = useCallback(() => {
    if (!failedPackReport) return;
    const file = new Blob([JSON.stringify(failedPackReport, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "aontas-reading-failed-qa-report.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [failedPackReport]);

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

      {process.env.NODE_ENV !== "production" && (
        <section style={card}>
          <div style={{ fontWeight: 950, fontSize: 18, color: "#0f172a" }}>Developer · Model Testing</div>
          <p style={{ color: "#64748b", fontSize: 13 }}>Local development only. Select a model before generating. API charges apply.</p>
          <select aria-label="Model for QA generation" value={qaModel} onChange={(e) => setQaModel(e.target.value)} style={{ padding: 10, borderRadius: 10, maxWidth: "100%", border: "1px solid #cbd5e1" }}>
            <option value="default">Default (OPENAI_MODEL or gpt-4.1-mini)</option>
            <option value="gpt-4.1-mini">gpt-4.1-mini (control)</option>
            <option value="gpt-5-mini">gpt-5-mini</option>
            <option value="custom">Other model ID (check API availability)</option>
          </select>
          {qaModel === "custom" && <input aria-label="Custom API model ID" value={qaCustomModel} onChange={(e) => setQaCustomModel(e.target.value)} placeholder="Exact OpenAI model ID" style={{ display: "block", marginTop: 10, padding: 10, borderRadius: 10, border: "1px solid #cbd5e1", maxWidth: "100%" }} />}
        </section>
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
          <div>{error}</div>
          {qualityIssues.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Quality checks that failed:</div>
              <ul style={{ paddingLeft: 22, margin: 0 }}>
                {qualityIssues.map((issue, index) => <li key={index}>{issue}</li>)}
              </ul>
            </div>
          )}
          {failedPackReport && (
            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={downloadFailedQaReport} style={{ background: "#fff", color: "#9a3412", border: "1px solid #fdba74", borderRadius: 10, padding: "9px 12px", fontWeight: 900, cursor: "pointer" }}>
                Download rejected QA report (JSON)
              </button>
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 400 }}>
                This developer-only report contains the rejected generated text and possibly teacher-provided information. Review before sharing.
              </div>
            </div>
          )}
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
