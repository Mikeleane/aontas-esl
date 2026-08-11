"use client";

import React from "react";
import { CEFR_LEVELS, type CefrLevel, type TextType } from "@/lib/cefr";

const LEVELS: readonly CefrLevel[] = CEFR_LEVELS;

const TYPES: { id: TextType; label: string; hint: string }[] = [
  { id: "story", label: "Story", hint: "Clear beginning, middle and end; optional dialogue" },
  { id: "short_message", label: "Short message", hint: "Short, direct and practical" },
  { id: "email_informal", label: "Informal email", hint: "Friendly greeting, message and sign-off" },
  { id: "email_formal", label: "Formal email", hint: "Formal greeting, clear purpose and polite close" },
  { id: "article", label: "Article", hint: "Title and clear paragraphs; optional subheadings" },
  { id: "review", label: "Review", hint: "Features, opinion and recommendation" },
  { id: "report", label: "Report", hint: "Clear headings, findings and recommendations" },
  { id: "essay", label: "Essay", hint: "Introduction, developed paragraphs and conclusion" },
];

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "9px 12px",
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
  const activeType = TYPES.find((t) => t.id === props.textType) || TYPES[4];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "160px minmax(0,1fr)", gap: 18, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900, color: "#475569" }}>
          Learner level
          <select
            value={props.cefrLevel}
            onChange={(e) => props.setCefrLevel(e.target.value as CefrLevel)}
            style={{
              width: "100%",
              padding: "10px 11px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,.18)",
              background: "white",
              color: "#0f172a",
              fontWeight: 1000,
              fontSize: 15,
            }}
          >
            {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>

        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>Text format</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 5 }}>
            <strong style={{ color: "#0f172a" }}>{activeType.label}:</strong> {activeType.hint}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => props.setTextType(type.id)}
            style={chipStyle(type.id === props.textType)}
            aria-pressed={type.id === props.textType}
            title={type.hint}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
}
