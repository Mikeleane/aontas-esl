"use client";

import React, { useMemo, useRef, useState } from "react";

type ExerciseSide = { prompt: string; options?: string[] | null };
type ExerciseItem = {
  id: number;
  type: string;
  skill: string;
  standard: ExerciseSide;
  adapted?: ExerciseSide; // API uses "adapted" (we treat it as Supported)
  SUPPORTED?: ExerciseSide; // just in case
  answer: any;
};

async function postJson<T>(url: string, body: any, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const txt = await res.text().catch(() => "");
  if (!res.ok) throw new Error(txt || res.statusText);
  return (txt ? JSON.parse(txt) : {}) as T;
}

const BRAND = {
  ink: "#0f172a",
  muted: "#475569",
  muted2: "#64748b",
  line: "rgba(15,23,42,.14)",
  panel: "rgba(255,255,255,.88)",
  accent: "#2d7d4f",
  warnBg: "#fff7ed",
  warnInk: "#7c2d12",
};

function card(): React.CSSProperties {
  return {
    background: BRAND.panel,
    border: `1px solid ${BRAND.line}`,
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 30px rgba(2,6,23,.07)",
    backdropFilter: "blur(6px)",
  };
}

function btn(kind: "primary" | "secondary", disabled?: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900,
    fontSize: 13,
    border: `1px solid ${BRAND.line}`,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    whiteSpace: "nowrap",
  };
  if (kind === "primary") return { ...base, background: BRAND.accent, color: "white", borderColor: "rgba(45,125,79,.35)" };
  return { ...base, background: "white", color: BRAND.ink };
}

export default function ExercisesPage() {
  const [cefrLevel, setCefrLevel] = useState("B2");
  const [textType, setTextType] = useState("report");
  const [topic, setTopic] = useState("School phone policy");
  const [inputText, setInputText] = useState("");

  const [items, setItems] = useState<ExerciseItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const supportedLabel = useMemo(() => "Supported", []);

  async function generate() {
    setErr("");
    setItems([]);
    const txt = String(inputText || "").trim();
    if (!txt) {
      setErr("Paste some inputText first.");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setBusy(true);
    try {
      const res = await postJson<{ items: ExerciseItem[] }>("/api/exercises", {
        cefrLevel,
        textType,
        topic,
        inputText: txt,
      }, abortRef.current.signal);

      const got = (res?.items || []).map((it) => ({
        ...it,
        SUPPORTED: (it as any).SUPPORTED || (it as any).adapted,
      })) as ExerciseItem[];

      setItems(got);
    } catch (e: any) {
      setErr(String(e?.message || e || "Unknown error"));
    } finally {
      setBusy(false);
    }
  }

  function fillSample() {
    setInputText(
`INTRODUCTION
This report summarises a survey of 200 students aged 13-16 about reading for pleasure.

FINDINGS
- 65% said they read for pleasure at least once a week.
- Novels were the most popular choice, followed by online articles.
- The most common reason for reading less was lack of time due to other activities.

RECOMMENDATIONS
Schools should offer short daily reading slots and promote book clubs with student choice.`
    );
  }

  return (
    <div style={{ padding: 18, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ fontWeight: 1000, fontSize: 20, color: BRAND.ink }}>CEFR / Cambridge Exercises</div>
      <div style={{ color: BRAND.muted2, marginTop: 8, fontSize: 12, lineHeight: 1.45 }}>
        Generates Standard + {supportedLabel} questions (shared answer key). This hits <b>/api/exercises</b>.
      </div>

      <div style={{ marginTop: 14, ...card() }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 10, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 6, fontSize: 12, color: BRAND.muted }}>
            <span style={{ fontWeight: 900, color: BRAND.ink }}>CEFR level</span>
            <select value={cefrLevel} onChange={(e) => setCefrLevel(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 14, border: `1px solid ${BRAND.line}`, fontWeight: 900 }}>
              {["A1","A2","B1","B2","C1","C2"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 12, color: BRAND.muted }}>
            <span style={{ fontWeight: 900, color: BRAND.ink }}>Text type</span>
            <select value={textType} onChange={(e) => setTextType(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 14, border: `1px solid ${BRAND.line}`, fontWeight: 900 }}>
              {["article","report","email","review","story","opinion","news","notice"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: 12, color: BRAND.muted }}>
            <span style={{ fontWeight: 900, color: BRAND.ink }}>Topic</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 14, border: `1px solid ${BRAND.line}`, fontWeight: 800 }} />
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, color: BRAND.ink }}>inputText</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={fillSample} style={btn("secondary")}>Paste sample</button>
              <button type="button" onClick={() => setShowAnswers((v) => !v)} style={btn("secondary")}>
                {showAnswers ? "Hide answers" : "Show answers"}
              </button>
              <button type="button" onClick={generate} disabled={busy} style={btn("primary", busy)}>
                {busy ? "Generating..." : "Generate"}
              </button>
              <button type="button" onClick={() => abortRef.current?.abort()} style={btn("secondary", !busy)} disabled={!busy}>
                Cancel
              </button>
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste the text you want questions for..."
            style={{
              marginTop: 10,
              width: "100%",
              minHeight: 220,
              padding: 12,
              borderRadius: 16,
              border: `1px solid ${BRAND.line}`,
              outline: "none",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          />

          {err && (
            <div style={{ marginTop: 12, background: BRAND.warnBg, border: "1px solid rgba(180,83,9,.25)", color: BRAND.warnInk,
              padding: 12, borderRadius: 14, whiteSpace: "pre-wrap", fontSize: 12, fontWeight: 800 }}>
              {err}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, ...card() }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 1000, color: BRAND.ink }}>Results</div>
            <div style={{ marginTop: 6, fontSize: 12, color: BRAND.muted2 }}>{items.length ? `${items.length} items` : "No items yet."}</div>
          </div>

          <button
            type="button"
            disabled={!items.length}
            style={btn("secondary", !items.length)}
            onClick={() => {
              const json = JSON.stringify({ items }, null, 2);
              navigator.clipboard?.writeText(json);
            }}
          >
            Copy JSON
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {items.map((it) => {
            const sup = it.SUPPORTED || it.adapted;
            return (
              <div key={it.id} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 14, background: "white" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 1000, color: BRAND.ink }}>
                    #{it.id} • {it.type} • <span style={{ color: BRAND.muted }}>{it.skill}</span>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: BRAND.muted }}>Standard</div>
                    <div style={{ marginTop: 6, fontWeight: 900 }}>{it.standard?.prompt}</div>
                    {Array.isArray(it.standard?.options) && (
                      <ul style={{ marginTop: 8, paddingLeft: 18, color: BRAND.ink }}>
                        {it.standard.options.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: BRAND.muted }}>{supportedLabel}</div>
                    <div style={{ marginTop: 6, fontWeight: 900 }}>{sup?.prompt}</div>
                    {Array.isArray(sup?.options) && (
                      <ul style={{ marginTop: 8, paddingLeft: 18, color: BRAND.ink }}>
                        {sup.options.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    )}
                  </div>
                </div>

                {showAnswers && (
                  <div style={{ marginTop: 10, fontSize: 12, color: BRAND.muted2 }}>
                    <span style={{ fontWeight: 1000, color: BRAND.ink }}>Answer: </span>
                    <span>{typeof it.answer === "string" ? it.answer : JSON.stringify(it.answer)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}