"use client";

import React, { useRef, useState } from "react";
import CefrTextTypeControls from "@/app/_components/CefrTextTypeControls";
import { type CefrLevel, type TextType } from "@/lib/cefr";
import { normalizeExercisesPack, type ExercisesPackData } from "@/lib/contracts/exercises";

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(text || res.statusText);
  return (text ? JSON.parse(text) : {}) as T;
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
  if (kind === "primary") {
    return { ...base, background: BRAND.accent, color: "white", borderColor: "rgba(45,125,79,.35)" };
  }
  return { ...base, background: "white", color: BRAND.ink };
}

export default function ExercisesPage() {
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("B2");
  const [textType, setTextType] = useState<TextType>("report");
  const [topic, setTopic] = useState("School phone policy");
  const [inputText, setInputText] = useState("");
  const [pack, setPack] = useState<ExercisesPackData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const items = pack?.items ?? [];

  async function generate() {
    setErr("");
    setPack(null);
    const source = inputText.trim();
    if (!source) {
      setErr("Paste some source text first.");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setBusy(true);
    try {
      const response = await postJson<unknown>(
        "/api/exercises",
        { cefrLevel, textType, topic, inputText: source },
        abortRef.current.signal
      );
      setPack(normalizeExercisesPack(response, { cefrLevel, textType }));
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Exercises generation failed.");
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
      <div style={{ fontWeight: 1000, fontSize: 20, color: BRAND.ink }}>CEFR Exercises</div>
      <div style={{ color: BRAND.muted2, marginTop: 8, fontSize: 12, lineHeight: 1.45 }}>
        Generates Standard + Supported questions with one shared answer key.
      </div>

      <div style={{ marginTop: 14, ...card() }}>
        <CefrTextTypeControls
          cefrLevel={cefrLevel}
          setCefrLevel={setCefrLevel}
          textType={textType}
          setTextType={setTextType}
        />

        <label style={{ display: "grid", gap: 6, marginTop: 12, fontSize: 12, color: BRAND.muted }}>
          <span style={{ fontWeight: 900, color: BRAND.ink }}>Topic</span>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            style={{ padding: "10px 12px", borderRadius: 14, border: `1px solid ${BRAND.line}`, fontWeight: 800 }}
          />
        </label>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, color: BRAND.ink }}>Source text</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={fillSample} style={btn("secondary")}>Paste sample</button>
              <button type="button" onClick={() => setShowAnswers((value) => !value)} style={btn("secondary")}>
                {showAnswers ? "Hide answers" : "Show answers"}
              </button>
              <button type="button" onClick={generate} disabled={busy} style={btn("primary", busy)}>
                {busy ? "Generating..." : "Generate"}
              </button>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                style={btn("secondary", !busy)}
                disabled={!busy}
              >
                Cancel
              </button>
            </div>
          </div>

          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
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
            <div
              style={{
                marginTop: 12,
                background: BRAND.warnBg,
                border: "1px solid rgba(180,83,9,.25)",
                color: BRAND.warnInk,
                padding: 12,
                borderRadius: 14,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {err}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, ...card() }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 1000, color: BRAND.ink }}>Results</div>
            <div style={{ marginTop: 6, fontSize: 12, color: BRAND.muted2 }}>
              {pack ? `${items.length} items - ${pack.cefrLevel} - ${pack.textType}` : "No items yet."}
            </div>
          </div>

          <button
            type="button"
            disabled={!pack}
            style={btn("secondary", !pack)}
            onClick={() => {
              if (!pack) return;
              navigator.clipboard?.writeText(JSON.stringify(pack, null, 2));
            }}
          >
            Copy canonical JSON
          </button>
        </div>

        {pack?.warning && (
          <div style={{ marginTop: 10, fontSize: 12, color: BRAND.muted2 }}>
            Mode: {pack.warning}
          </div>
        )}

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {items.map((item) => (
            <div key={item.id} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 14, background: "white" }}>
              <div style={{ fontWeight: 1000, color: BRAND.ink }}>
                #{item.id} • {item.type} • <span style={{ color: BRAND.muted }}>{item.skill ?? "Exercise"}</span>
              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: BRAND.muted }}>Standard</div>
                  <div style={{ marginTop: 6, fontWeight: 900 }}>{item.standard.prompt}</div>
                  {item.standard.options && (
                    <ul style={{ marginTop: 8, paddingLeft: 18, color: BRAND.ink }}>
                      {item.standard.options.map((option, index) => <li key={index}>{option}</li>)}
                    </ul>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: BRAND.muted }}>Supported</div>
                  <div style={{ marginTop: 6, fontWeight: 900 }}>{item.supported.prompt}</div>
                  {item.supported.options && (
                    <ul style={{ marginTop: 8, paddingLeft: 18, color: BRAND.ink }}>
                      {item.supported.options.map((option, index) => <li key={index}>{option}</li>)}
                    </ul>
                  )}
                </div>
              </div>

              {showAnswers && (
                <div style={{ marginTop: 10, fontSize: 12, color: BRAND.muted2 }}>
                  <span style={{ fontWeight: 1000, color: BRAND.ink }}>Shared answer: </span>
                  <span>{typeof item.answer === "string" ? item.answer : JSON.stringify(item.answer)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
