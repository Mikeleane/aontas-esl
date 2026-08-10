"use client";

import React, { useMemo, useState } from "react";

type Props = {
  standard?: string;
  adapted?: string;
  titleStandard?: string;
  titleAdapted?: string;
};

export default function StandardAdaptedPreview({
  standard,
  adapted,
  titleStandard = "Standard text",
  titleAdapted = "Supported text",
}: Props) {
  const s = (standard ?? "").trim();
  const a = (adapted ?? "").trim();
  const [mode, setMode] = useState<"split" | "standard" | "adapted">("split");

  const hasAny = !!(s || a);
  const splitOk = !!(s && a);

  const boxStyle: React.CSSProperties = {
    border: "1px solid rgba(15,23,42,.12)",
    borderRadius: 14,
    padding: 12,
    background: "white",
    whiteSpace: "pre-wrap",
    lineHeight: 1.5,
    fontSize: 13,
    maxHeight: 320,
    overflow: "auto",
  };

  const gridStyle: React.CSSProperties = useMemo(() => ({
    display: "grid",
    gridTemplateColumns: splitOk && mode === "split" ? "1fr 1fr" : "1fr",
    gap: 12,
  }), [splitOk, mode]);

  if (!hasAny) return null;

  return (
    <div style={{
      border: "1px solid rgba(15,23,42,.10)",
      borderRadius: 16,
      padding: 12,
      background: "rgba(248,250,252,.7)"
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900 }}>Texts</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setMode("split")}
            disabled={!splitOk}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,.18)",
              background: mode === "split" ? "#e2e8f0" : "white",
              fontWeight: 800,
              cursor: splitOk ? "pointer" : "not-allowed",
              opacity: splitOk ? 1 : 0.5,
            }}
          >
            Split
          </button>
          <button
            onClick={() => setMode("standard")}
            disabled={!s}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,.18)",
              background: mode === "standard" ? "#e2e8f0" : "white",
              fontWeight: 800,
              cursor: s ? "pointer" : "not-allowed",
              opacity: s ? 1 : 0.5,
            }}
          >
            Standard
          </button>
          <button
            onClick={() => setMode("adapted")}
            disabled={!a}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,.18)",
              background: mode === "adapted" ? "#e2e8f0" : "white",
              fontWeight: 800,
              cursor: a ? "pointer" : "not-allowed",
              opacity: a ? 1 : 0.5,
            }}
          >
            Supported
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, ...gridStyle }}>
        {(mode === "split" || mode === "standard") && (
          <div>
            <div style={{ fontWeight: 900, marginBottom: 6, opacity: 0.9 }}>
              {titleStandard} {s ? "(" + s.length.toLocaleString() + " chars)" : ""}
            </div>
            <div style={boxStyle}>{s || "—"}</div>
          </div>
        )}

        {(mode === "split" || mode === "adapted") && (
          <div>
            <div style={{ fontWeight: 900, marginBottom: 6, opacity: 0.9 }}>
              {titleAdapted} {a ? "(" + a.length.toLocaleString() + " chars)" : ""}
            </div>
            <div style={boxStyle}>{a || "—"}</div>
          </div>
        )}
      </div>
    </div>
  );
}
