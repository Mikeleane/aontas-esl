"use client";

import React, { useEffect, useMemo, useState } from "react";

type H5PLibItem = {
  id: string;               // folder name under /public/h5p/<id>/
  title?: string;           // from h5p.json (optional)
  mainLibrary?: string;     // e.g. "H5P.AdvancedBlanks"
  summary?: string;         // optional
};

const BRAND = {
  ink: "#0f172a",
  muted: "#475569",
  muted2: "#64748b",
  line: "rgba(15,23,42,.14)",
  panel: "rgba(255,255,255,.88)",
  panel2: "rgba(255,255,255,.72)",
  bgA: "rgba(79,179,217,.18)", // sky
  bgB: "rgba(244,197,66,.18)", // gold
};

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: `radial-gradient(900px 420px at 10% 10%, ${BRAND.bgA}, transparent 60%),
               radial-gradient(900px 420px at 90% 10%, ${BRAND.bgB}, transparent 60%),
               linear-gradient(180deg, rgba(248,250,252,1), rgba(248,250,252,.85))`,
};

const innerWrap: React.CSSProperties = {
  padding: 18,
  maxWidth: 1200,
  margin: "0 auto",
};

const cardStyle: React.CSSProperties = {
  background: BRAND.panel,
  border: `1px solid ${BRAND.line}`,
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 10px 30px rgba(2,6,23,.07)",
  backdropFilter: "blur(6px)",
};

const h2: React.CSSProperties = { fontWeight: 1100, fontSize: 22, color: BRAND.ink, margin: 0 };
const p: React.CSSProperties = { color: BRAND.muted2, marginTop: 8, fontSize: 12, lineHeight: 1.4 };

function btnStyle(kind: "primary" | "secondary", disabled?: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    userSelect: "none",
    borderRadius: 14,
    padding: "10px 12px",
    fontWeight: 900,
    fontSize: 13,
    border: `1px solid ${BRAND.line}`,
    opacity: disabled ? 0.55 : 1,
    whiteSpace: "nowrap",
  };
  if (kind === "primary") {
    return { ...base, background: "#2d7d4f", color: "white", borderColor: "rgba(45,125,79,.35)" };
  }
  return { ...base, background: "white", color: BRAND.ink };
}

async function tryFetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function H5PLibraryPage() {
  const [items, setItems] = useState<H5PLibItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [height, setHeight] = useState(640);

  async function loadList() {
    setLoading(true);
    setErr("");

    // Prefer API (server-side scan), fallback to static json if you have it
    const fromApi = await tryFetchJson<{ items: H5PLibItem[] }>("/api/h5p/library");
    const fromStatic = fromApi ? null : await tryFetchJson<{ items: H5PLibItem[] }>("/h5p/library.json");

    const list = (fromApi?.items || fromStatic?.items || []) as H5PLibItem[];
    setItems(list);

    // keep selection if possible, else pick first
    setSelectedId((prev) => {
      if (prev && list.some((x) => x.id === prev)) return prev;
      return list[0]?.id || "";
    });

    if (!fromApi && !fromStatic) {
      setErr(
        "Could not load library list. Make sure /api/h5p/library exists OR create /public/h5p/library.json."
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) => {
      const hay = `${it.id} ${it.title || ""} ${it.mainLibrary || ""} ${it.summary || ""}`.toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  const selected = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId]);

  const embedUrl = useMemo(() => {
    if (!selectedId) return "";
    // This must exist in /public/h5p-player/h5p-embed.html
    return `/h5p-player/h5p-embed.html?id=${encodeURIComponent(selectedId)}`;
  }, [selectedId]);

  return (
    <div style={pageWrap}>
      <div style={innerWrap}>
        {/* Header */}
        <div style={{ ...cardStyle, marginBottom: 14 }}>
          <h1 style={h2}>H5P Library (in-app player)</h1>
          <div style={p}>
            Drop unzipped H5Ps into <b>public/h5p/&lt;id&gt;/</b> (must contain <b>h5p.json</b>, <b>content/</b>, <b>libraries/</b>).
            Then preview them here.
            <div style={{ marginTop: 6 }}>
              This is the “teacher resource shelf” — later we’ll tag/filter by <b>Class</b> / <b>Stage</b> / <b>Skills</b>.
            </div>
          </div>
          {err && (
            <div
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
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, alignItems: "start" }}>
          {/* Left: list */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 1000, fontSize: 14, marginBottom: 10, color: BRAND.ink }}>Games</div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 14,
                border: `1px solid ${BRAND.line}`,
                background: "white",
                color: BRAND.ink,
                fontWeight: 800,
                outline: "none",
              }}
            />

            <div style={{ marginTop: 10, color: BRAND.muted2, fontSize: 12 }}>
              {loading ? "Loading…" : `${filtered.length} found`}
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {filtered.map((it) => {
                const active = it.id === selectedId;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => setSelectedId(it.id)}
                    style={{
                      textAlign: "left",
                      borderRadius: 18,
                      padding: 12,
                      border: `1px solid ${BRAND.line}`,
                      background: active ? BRAND.ink : "white",
                      color: active ? "white" : BRAND.ink,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 1100, fontSize: 13 }}>{it.id}</div>
                    <div style={{ marginTop: 4, fontSize: 12, opacity: active ? 0.9 : 0.75 }}>
                      {(it.title || "Untitled")} {it.mainLibrary ? `• ${it.mainLibrary}` : ""}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${BRAND.line}` }}>
              <div style={{ fontWeight: 1000, fontSize: 13, color: BRAND.ink, marginBottom: 10 }}>Preview height</div>
              <input
                type="range"
                min={360}
                max={1000}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value || "640", 10))}
                style={{ width: "100%" }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: BRAND.muted2 }}>{height}px</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button
                  type="button"
                  style={btnStyle("secondary", !embedUrl)}
                  disabled={!embedUrl}
                  onClick={() => {
                    if (!embedUrl) return;
                    window.open(embedUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Open in new tab
                </button>
                <button type="button" style={btnStyle("secondary")} onClick={loadList}>
                  Refresh list
                </button>
              </div>
            </div>
          </div>

          {/* Right: iframe player */}
          <div style={cardStyle}>
            <div style={{ fontWeight: 1000, fontSize: 14, marginBottom: 10, color: BRAND.ink }}>Preview</div>

            <div style={{ color: BRAND.muted2, fontSize: 12, marginBottom: 10 }}>
              Currently viewing: <b style={{ color: BRAND.muted }}>{selectedId || "—"}</b>
              {selected?.mainLibrary ? (
                <span>
                  {" "}
                  • <span style={{ color: BRAND.muted }}>{selected.mainLibrary}</span>
                </span>
              ) : null}
            </div>

            {!embedUrl ? (
              <div style={{ padding: 18, borderRadius: 18, border: `1px dashed ${BRAND.line}`, color: BRAND.muted2 }}>
                No selection yet.
              </div>
            ) : (
              <iframe
                key={embedUrl} // forces refresh when switching items
                src={embedUrl}
                title={`H5P ${selectedId}`}
                style={{
                  width: "100%",
                  height,
                  border: `1px solid ${BRAND.line}`,
                  borderRadius: 18,
                  background: "white",
                }}
                // H5P needs scripts + same-origin to load its libraries and content
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                allow="fullscreen"
              />
            )}

            <div style={{ marginTop: 10, fontSize: 12, color: BRAND.muted2, lineHeight: 1.4 }}>
              If you see a 404 inside the frame, open the embed URL in a new tab and check the Network tab.
              The embed file must live at <b>/public/h5p-player/h5p-embed.html</b>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
