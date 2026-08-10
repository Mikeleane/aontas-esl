"use client";

import React, { useMemo, useRef, useState } from "react";
import { CEFR_LEVELS, type CefrLevel } from "@/lib/cefr";
import { normalizeSocialPack, type SocialPackData } from "@/lib/contracts/social";
import { exportSocialThreadHtml } from "../_features/social/exports/socialThreadExport";

type ApiResponse = { pack?: unknown; error?: string };

async function postJson<T>(url: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    let message = text || response.statusText;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === "string") message = parsed.error;
    } catch {
      // Keep the plain response text.
    }
    throw new Error(message || `HTTP ${response.status}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}

export default function SocialPage() {
  const [text, setText] = useState(
    "Create a class chat about staying organised and doing homework."
  );
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("B1");
  const [tongueInCheek, setTongueInCheek] = useState(false);
  const [pack, setPack] = useState<SocialPackData | null>(null);
  const [busy, setBusy] = useState<"" | "generate" | "export">("");
  const [err, setErr] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const preview = useMemo(() => pack?.standard.messages.slice(0, 6) ?? [], [pack]);

  async function handleGenerate() {
    setErr("");
    setPack(null);

    const cleaned = text.trim();
    if (!cleaned) {
      setErr("Paste some text first.");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy("generate");

    try {
      const response = await postJson<ApiResponse>(
        "/api/social-thread",
        { text: cleaned, cefrLevel, tongueInCheek },
        abortRef.current.signal
      );
      if (!response.pack) throw new Error(response.error || "No social thread returned.");
      setPack(normalizeSocialPack(response.pack, { cefrLevel }));
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErr(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  async function handleExport() {
    setErr("");
    if (!pack) {
      setErr("Generate a pack first.");
      return;
    }

    setBusy("export");
    try {
      await exportSocialThreadHtml({
        pack,
        htmlOptions: {
          defaultLens: "builder",
          defaultAutoVoices: true,
          defaultSpeakEmojis: false,
          defaultShowEmojis: true,
          defaultPace: "step",
          initialVisibleCount: 4,
        },
      });
    } catch (error: unknown) {
      setErr(errorMessage(error));
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontWeight: 950, fontSize: 20 }}>Social Thread Generator</div>
      <div style={{ color: "#64748b", marginTop: 8 }}>
        Generates aligned Standard + Supported social-media-style English practice from A1 to C2.
      </div>

      <div
        style={{
          marginTop: 14,
          background: "white",
          border: "1px solid rgba(15,23,42,.12)",
          borderRadius: 18,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>
          Prompt / source text
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          style={{
            width: "100%",
            minHeight: 140,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,.14)",
            outline: "none",
          }}
        />

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 800 }}>CEFR</span>
            <select
              value={cefrLevel}
              onChange={(event) => setCefrLevel(event.target.value as CefrLevel)}
              style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(15,23,42,.18)" }}
            >
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={tongueInCheek}
              onChange={(event) => setTongueInCheek(event.target.checked)}
            />
            Light tongue-in-cheek tone
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={busy !== ""}
            style={{
              border: "1px solid rgba(15,23,42,.14)",
              background: "#0f172a",
              color: "white",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy === "generate" ? "Generating..." : "Generate Pack"}
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={busy !== "" || !pack}
            style={{
              border: "1px solid rgba(15,23,42,.14)",
              background: "white",
              color: "#0f172a",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 900,
              cursor: busy || !pack ? "not-allowed" : "pointer",
              opacity: busy || !pack ? 0.6 : 1,
            }}
          >
            {busy === "export" ? "Exporting..." : "Export Social HTML"}
          </button>

          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              setBusy("");
            }}
            style={{
              border: "1px solid rgba(15,23,42,.14)",
              background: "white",
              color: "#0f172a",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>

        {err && (
          <pre
            style={{
              marginTop: 12,
              background: "#fff7ed",
              border: "1px solid rgba(180,83,9,.25)",
              padding: 12,
              borderRadius: 12,
              whiteSpace: "pre-wrap",
              fontSize: 12,
              color: "#7c2d12",
            }}
          >
            {err}
          </pre>
        )}
      </div>

      <div
        style={{
          marginTop: 14,
          background: "white",
          border: "1px solid rgba(15,23,42,.12)",
          borderRadius: 18,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 950 }}>Preview</div>
        {!pack ? (
          <div style={{ color: "#64748b", marginTop: 8 }}>No pack yet.</div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
              {pack.title} - {pack.cefrLevel} - {pack.standard.messages.length} aligned messages - {pack.concepts.length} concepts
            </div>
            {preview.map((message, index) => (
              <div
                key={message.id}
                style={{ padding: "8px 0", borderTop: index === 0 ? "none" : "1px solid rgba(15,23,42,.08)" }}
              >
                <div style={{ fontWeight: 900 }}>{message.emoji ? `${message.emoji} ` : ""}{message.speaker}</div>
                <div style={{ color: "#0f172a" }}>{message.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
