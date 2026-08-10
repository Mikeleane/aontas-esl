"use client";

import React from "react";
import { CEFR_LEVELS, type CefrLevel, type TextType } from "@/lib/cefr";

const LEVELS: readonly CefrLevel[] = CEFR_LEVELS;

const TYPES: { id: TextType; label: string; hint: string }[] = [
  { id: "story", label: "Story", hint: "Clear beginning–middle–end; optional dialogue" },
  { id: "short_message", label: "Short message", hint: "Text/note style; direct purpose" },
  { id: "email_informal", label: "Email (informal)", hint: "Subject + greeting + sign-off; friendly tone" },
  { id: "email_formal", label: "Email (formal)", hint: "Subject + formal greeting + polite closing" },
  { id: "article", label: "Article", hint: "Title + clear paragraphs; optional subheadings" },
  { id: "review", label: "Review", hint: "Features + opinion + recommendation" },
  { id: "report", label: "Report", hint: "Headings: Intro / Findings / Recommendations" },
  { id: "essay", label: "Essay", hint: "Intro + 2–3 body paragraphs + conclusion" },
];

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,.14)",
    background: active ? "#0f172a" : "white",
    color: active ? "white" : "#0f172a",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    userSelect: "none",
  };
}

export default function CefrTextTypeControls(props: {
  cefrLevel: CefrLevel;
  setCefrLevel: (v: CefrLevel) => void;
  textType: TextType;
  setTextType: (v: TextType) => void;
}) {
  const cefrLevel = props.cefrLevel;
  const textType = props.textType;

  const activeType = TYPES.find((t) => t.id === textType) || TYPES[4];

  return (
    <div
      style={{
        marginTop: 10,
        border: "1px solid rgba(15,23,42,.12)",
        borderRadius: 16,
        padding: 12,
        background: "rgba(255,255,255,.9)",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontWeight: 950, fontSize: 12, color: "#0f172a" }}>CEFR</div>
          <select
            value={cefrLevel}
            onChange={(e) => props.setCefrLevel(e.target.value as CefrLevel)}
            style={{
              padding: "6px 8px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,.18)",
              fontWeight: 900,
            }}
          >
            {LEVELS.map((L) => (
              <option key={L} value={L}>
                {L}
              </option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: 12, color: "#475569" }}>
          <span style={{ fontWeight: 900, color: "#0f172a" }}>Text type:</span>{" "}
          <span style={{ color: "#0f172a", fontWeight: 900 }}>{activeType.label}</span>{" "}
          <span style={{ color: "#64748b" }}>— {activeType.hint}</span>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => props.setTextType(t.id)}
            style={chipStyle(t.id === textType)}
            aria-pressed={t.id === textType}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}