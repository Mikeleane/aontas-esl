"use client";

import React, { useState } from "react";

type Props = { onText?: (text: string) => void };

export default function InputIngest({ onText }: Props) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "url" | "file">("");
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState("");

  function applyText(t: string, label: string) {
    const text = String(t || "").trim();
    setPreview(text.slice(0, 700));

    const len = text.length.toLocaleString();
    setMsg(
      text
        ? ("Loaded " + len + " characters (" + label + ").")
        : ("No text found (" + label + ").")
    );

    onText?.(text);
  }

  async function fetchUrl() {
    const u = url.trim();
    if (!u) return;
    setBusy("url");
    setMsg("Fetching articleâ€¦");
    try {
      const res = await fetch("/api/fetch-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Fetch failed");
      const label = data?.title ? ("URL: " + data.title) : "URL";
      applyText(data?.text || "", label);
    } catch (e: any) {
      setMsg("URL error: " + (e?.message || String(e)));
    } finally {
      setBusy("");
    }
  }

  async function uploadFile(file: File) {
    setBusy("file");
    setMsg("Extracting textâ€¦");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Extract failed");
      const label = "file: " + (data?.filename || file.name);
      applyText(data?.text || "", label);
    } catch (e: any) {
      setMsg("File error: " + (e?.message || String(e)));
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ border: "1px solid rgba(15,23,42,.12)", borderRadius: 14, padding: 12, background: "rgba(248,250,252,.7)" }}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>Input options</div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a URL (article/webpage)â€¦"
          style={{ flex: "1 1 360px", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,.18)" }}
        />

        <button
          onClick={fetchUrl}
          disabled={busy !== "" || !url.trim()}
          style={{ padding: "10px 12px", borderRadius: 10, fontWeight: 900, border: "1px solid rgba(15,23,42,.18)", background: busy === "url" ? "#e2e8f0" : "white" }}
        >
          {busy === "url" ? "Fetchingâ€¦" : "Fetch URL"}
        </button>

        <label style={{ padding: "10px 12px", borderRadius: 10, fontWeight: 900, border: "1px solid rgba(15,23,42,.18)", background: busy === "file" ? "#e2e8f0" : "white" }}>
          {busy === "file" ? "Uploadingâ€¦" : "Upload file"}
          <input
            type="file"
            disabled={busy !== ""}
            accept=".txt,.pdf,.docx,.png,.jpg,.jpeg,.webp"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {msg ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>{msg}</div> : null}

      {preview ? (
        <div style={{ marginTop: 10, fontSize: 12, whiteSpace: "pre-wrap", padding: 10, borderRadius: 10, background: "white", border: "1px solid rgba(15,23,42,.10)" }}>
          {preview}{preview.length >= 700 ? "â€¦" : ""}
        </div>
      ) : null}
    </div>
  );
}