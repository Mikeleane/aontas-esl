"use client";

import React, { useMemo, useRef, useState } from "react";

// Use a relative import so you don't get path-alias headaches.
import { exportSocialThreadHtml } from "../_features/social/exports/socialThreadExport";

type ApiResponse = { pack: any };

async function postJson<T>(url: string, body: any, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const txt = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
  return (txt ? JSON.parse(txt) : {}) as T;
}

function downloadTextFile(filename: string, text: string, mime = "text/html;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function SocialPage() {
  const [text, setText] = useState(
    "Create a school-appropriate class chat about staying organised and doing homework. Include 10–14 messages."
  );
  const [tongueInCheek, setTongueInCheek] = useState(false);

  const [pack, setPack] = useState<any | null>(null);
  const [busy, setBusy] = useState<"" | "generate" | "export">("");
  const [err, setErr] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const preview = useMemo(() => {
    const msgs = pack?.standard?.messages;
    if (!Array.isArray(msgs)) return [];
    return msgs.slice(0, 6);
  }, [pack]);

  async function handleGenerate() {
    setErr("");
    setPack(null);

    const cleaned = String(text || "").trim();
    if (!cleaned) {
      setErr("Paste some text first.");
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setBusy("generate");
    try {
      const res = await postJson<ApiResponse>(
        "/api/social-thread",
        { text: cleaned, tongueInCheek },
        abortRef.current.signal
      );
      if (!res?.pack) throw new Error("No pack returned.");
      setPack(res.pack);
    } catch (e: any) {
      setErr(String(e?.message || e || "Unknown error"));
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
      // Call your exporter. It might:
      // - return an HTML string, OR
      // - download internally and return void.
      const maybeHtml = await (exportSocialThreadHtml as any)({
        pack,
        precomputeUnpacks: true,
        precomputeLens: "builder",
        precomputeLimitPerVariant: 30,
        htmlOptions: {
          defaultLens: "builder",
          defaultAutoVoices: true,
          defaultSpeakEmojis: false,
          defaultShowEmojis: true,
          defaultPace: "step",
          initialVisibleCount: 4,
        },
      });

      // If it returned HTML, download it here.
      if (typeof maybeHtml === "string" && maybeHtml.trim().startsWith("<")) {
        const title = String(pack?.title || "social-thread").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        downloadTextFile(`aontas-social-${title}.html`, maybeHtml, "text/html;charset=utf-8");
      }
    } catch (e: any) {
      setErr(String(e?.message || e || "Unknown error"));
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ fontWeight: 950, fontSize: 20 }}>Social Thread Generator</div>
      <div style={{ color: "#64748b", marginTop: 8 }}>
        Generates a Standard + Supported social-media-style chat pack, then exports an offline HTML file.
      </div>

      <div style={{ marginTop: 14, background: "white", border: "1px solid rgba(15,23,42,.12)", borderRadius: 18, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", marginBottom: 6 }}>Prompt / source text</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            width: "100%",
            minHeight: 140,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,.14)",
            outline: "none",
          }}
        />

        <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, fontSize: 13 }}>
          <input type="checkbox" checked={tongueInCheek} onChange={(e) => setTongueInCheek(e.target.checked)} />
          Light tongue-in-cheek tone (still school-appropriate)
        </label>

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
            {busy === "generate" ? "Generating…" : "Generate Pack"}
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
            {busy === "export" ? "Exporting…" : "Export Social HTML"}
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

      <div style={{ marginTop: 14, background: "white", border: "1px solid rgba(15,23,42,.12)", borderRadius: 18, padding: 14 }}>
        <div style={{ fontWeight: 950 }}>Preview</div>
        {!pack ? (
          <div style={{ color: "#64748b", marginTop: 8 }}>No pack yet.</div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
              {pack?.title || "Untitled"} • {Array.isArray(pack?.standard?.messages) ? pack.standard.messages.length : 0} messages
            </div>
            {preview.map((m: any, i: number) => (
              <div key={i} style={{ padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,.08)" }}>
                <div style={{ fontWeight: 900 }}>{m?.speaker || "?"}</div>
                <div style={{ color: "#0f172a" }}>{m?.text || ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}