"use client";

import React, { useEffect, useMemo, useState } from "react";
import { buildWordinessSeedFromText } from "../_features/wordiness/buildWordinessSeed";

type Game = {
  file: string;
  title?: string;
  desc?: string;
  description?: string;
  tags?: any; // <- intentionally loose, we normalize it
  seedable?: boolean;
  order?: any;
};

function b64UrlEncodeUtf8(s: string) {
  const bytes = encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  const b64 = btoa(bytes);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function asStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x)).map((t) => t.trim()).filter(Boolean);

  // common case: "grammar seeded" or "grammar,seeded"
  if (typeof v === "string") {
    return v
      .split(/[,\n\r\t ]+/g)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  // sometimes ConvertTo-Json / hand edits create objects
  if (typeof v === "object") {
    try {
      return Object.values(v)
        .map((x) => String(x))
        .map((t) => t.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  return [String(v)].map((t) => t.trim()).filter(Boolean);
}

function asNumber(v: any, fallback = 9999) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function WordinessHubPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [seedText, setSeedText] = useState("");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");

  useEffect(() => {
    fetch("/wordiness/manifest.json?ts=" + Date.now())
      .then((r) => r.json())
      .then((data) => {
        const arr: Game[] = Array.isArray(data) ? data : (data?.games ?? []);
        // normalize minimally so the rest of the page is safe
        const cleaned = (arr || []).filter(Boolean).map((g: any) => ({
          ...g,
          file: String(g.file || ""),
          title: g.title ?? g.name ?? "",
          desc: g.desc ?? g.description ?? "",
          tags: asStringArray(g.tags),
          seedable: !!g.seedable,
          order: asNumber(g.order, 9999),
        }));
        setGames(cleaned.filter((g) => !!g.file));
      })
      .catch(() => setGames([]));
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const g of games) {
      for (const t of asStringArray((g as any).tags)) s.add(String(t));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [games]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (games || [])
      .filter((g) => g && g.file)
      .filter((g) => (tag ? asStringArray(g.tags).includes(tag) : true))
      .filter((g) => {
        if (!qq) return true;
        const hay = `${g.title || ""} ${g.file} ${g.desc || ""} ${asStringArray(g.tags).join(" ")}`.toLowerCase();
        return hay.includes(qq);
      })
      .sort((a, b) => asNumber(a.order) - asNumber(b.order));
  }, [games, q, tag]);

  const seedHash = useMemo(() => {
    if (!seedText.trim()) return "";
    try {
      const seedObj = buildWordinessSeedFromText(seedText);
      return "#seed=" + b64UrlEncodeUtf8(JSON.stringify(seedObj));
    } catch {
      return "#seed=" + b64UrlEncodeUtf8(JSON.stringify({ seedText }));
    }
  }, [seedText]);

  function launch(g: Game) {
    const isSeededFile = /seeded\.(html|htm)$/i.test(g.file);
    const wantsSeed = (!!g.seedable || isSeededFile) && !!seedHash;
    const url = "/wordiness/" + g.file + (wantsSeed ? seedHash : "");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ minHeight: "100vh", padding: 18, background: "linear-gradient(135deg, #dff1ff 0%, #fff5d6 100%)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <img src="/wordiness/crest.png" alt="crest" style={{ width: 46, height: 46, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Wordiness Hub</div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              Launch Wordiness games. Seeded games use your Reading Pack text.
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
            Files found: <b>{games.length}</b>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.75)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            padding: 14,
            boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Current seed</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
            Paste Reading Pack text here (optional). Seeded games open with #seed=... attached.
          </div>
          <textarea
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            placeholder="Paste text from Reading Pack (optional)..."
            style={{
              width: "100%",
              minHeight: 110,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.15)",
              padding: 10,
              fontSize: 14,
              lineHeight: 1.35,
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search games..."
              style={{ flex: "1 1 260px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)", padding: "10px 12px" }}
            />
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              style={{ flex: "0 0 220px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.15)", padding: "10px 12px" }}
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSeedText("")}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.12)",
                padding: "10px 14px",
                background: "white",
                cursor: "pointer",
              }}
            >
              Clear seed
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 14 }}>
          {filtered.map((g) => (
            <div
              key={g.file}
              style={{
                background: "rgba(255,255,255,0.85)",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 16,
                padding: 14,
                boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>{g.title || g.file}</div>
              <div style={{ fontSize: 12, opacity: 0.75, minHeight: 32 }}>{g.desc || ""}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {asStringArray(g.tags).slice(0, 8).map((t) => (
                  <span key={t} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 999, background: "rgba(0,0,0,0.06)" }}>
                    {t}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                <button
                  onClick={() => launch(g)}
                  style={{ borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", padding: "10px 14px", background: "white", cursor: "pointer" }}
                >
                  Launch
                </button>
                <div style={{ fontSize: 11, opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {g.file}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>Seeded games read a #seed=... hash.</div>
      </div>
    </div>
  );
}
