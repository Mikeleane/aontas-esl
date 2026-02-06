"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildWordinessSeedFromText } from "../wordiness/buildWordinessSeed";
// Re-export types so other files that imported from ReadingPackApp keep working.
export type { ReadingMode, ReadingPackData, ExerciseItem, ExerciseSide } from "./readingPackTypes";

import type { ReadingMode, ReadingPackData } from "./readingPackTypes";
import { buildInteractiveHtml } from "./exports/interactiveHtml";
import { buildPrintablesHtml, buildTeacherKeyHtml, splitParas } from "./exports/printablesHtml";
import { buildPrintablesPdfBytes } from "./exports/printablesPdf";
import { buildPrintablesDocxBlob } from "./exports/printablesDocx";
// âœ… Social thread export (copied from your bcomm-y3 work)
import { exportSocialThreadHtml } from "../social/exports/socialThreadExport";
type Props = {
  pack?: ReadingPackData | null;
  onPackChange?: (p: ReadingPackData | null) => void;
  crestFallbackPath?: string; // e.g. "/kns-crest.jpg"
};

const BRAND = {
  ink: "#0f172a",
  muted: "#475569",
  muted2: "#64748b",
  line: "rgba(15,23,42,.14)",
  panel: "rgba(255,255,255,.88)",
  panel2: "rgba(255,255,255,.72)",
  accent: "#2d7d4f",
  danger: "#dc2626",
  bgA: "rgba(79,179,217,.18)", // sky
  bgB: "rgba(244,197,66,.18)", // gold
};

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "reading-pack";
}

function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  downloadBlobFile(filename, blob);
}

function openHtmlInNewTab(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function fetchAsDataUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getSidePrompt(pack: ReadingPackData, mode: ReadingMode, idx: number) {
  const it = (pack.exercises || [])[idx];
  if (!it) return "";
  const side = mode === "standard" ? it.standard : it.SUPPORTED || it.adapted || it.standard;
  return side?.prompt || "";
}

type BtnKind = "primary" | "secondary" | "danger";

function btnStyle(kind: BtnKind, opts?: { busy?: boolean; disabled?: boolean }): React.CSSProperties {
  const busy = !!opts?.busy;
  const disabled = !!opts?.disabled;

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
    opacity: disabled ? 0.45 : busy ? 0.85 : 1,
    transition: "transform .06s ease, filter .12s ease, opacity .12s ease",
    whiteSpace: "nowrap",
  };

  if (kind === "primary") {
    return {
      ...base,
      background: BRAND.accent,
      color: "white",
      borderColor: "rgba(45,125,79,.35)",
      filter: disabled ? "none" : busy ? "saturate(0.9)" : "none",
    };
  }

  if (kind === "danger") {
    return {
      ...base,
      background: BRAND.danger,
      color: "white",
      borderColor: "rgba(220,38,38,.35)",
    };
  }

  // secondary
  return {
    ...base,
    background: "white",
    color: BRAND.ink, // IMPORTANT: prevents â€œblank button textâ€
  };
}

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: `radial-gradient(900px 420px at 10% 10%, ${BRAND.bgA}, transparent 60%),
               radial-gradient(900px 420px at 90% 10%, ${BRAND.bgB}, transparent 60%),
               linear-gradient(180deg, rgba(248,250,252,1), rgba(248,250,252,.85))`,
};

const innerWrap: React.CSSProperties = {
  padding: 18,
  maxWidth: 1100,
  margin: "0 auto",
};

const cardStyle: React.CSSProperties = {
  marginTop: 14,
  background: BRAND.panel,
  border: `1px solid ${BRAND.line}`,
  borderRadius: 22,
  padding: 16,
  boxShadow: "0 10px 30px rgba(2,6,23,.07)",
  backdropFilter: "blur(6px)",
};

const sectionTitle: React.CSSProperties = {
  fontWeight: 1000,
  fontSize: 14,
  letterSpacing: 0.2,
  marginBottom: 10,
};

const smallNote: React.CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: BRAND.muted2,
  lineHeight: 1.4,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: 12,
};

async function postJson<T>(url: string, body: any, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const text = await res.text();
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      (typeof data === "string" && data) ||
      `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  // Always return something for Promise<T>
  return data as T;
}

export default function ReadingPackApp(props: Props) {
  
    useEffect(() => {
      try {
        const textForSeed = String((socialSource || socialSource || "") ?? "");
        if (!textForSeed.trim()) return;
        const seed = buildWordinessSeedFromText(textForSeed, "reading-pack");
        localStorage.setItem("wordiness_seed_json", JSON.stringify(seed));
      } catch (e) {}
    }, []);
    

  const crestFallbackPath = props.crestFallbackPath || "/kns-crest.jpg";

  const [pack, setPack] = useState<ReadingPackData | null>(props.pack ?? null);
  const [mode, setMode] = useState<ReadingMode>("standard");
  const [busy, setBusy] = useState<string>("");

  const [jsonBox, setJsonBox] = useState<string>("");
  const [showJsonTools, setShowJsonTools] = useState(false);

  // âœ… Social Thread (derived from reading pack text)
  const [socialPack, setSocialPack] = useState<any | null>(null);
  const [socialErr, setSocialErr] = useState<string>("");
  const [tongueInCheek, setTongueInCheek] = useState<boolean>(false);
  const [socialSource, setSocialSource] = useState<"standard" | "SUPPORTED">("standard");
  const socialAbortRef = useRef<AbortController | null>(null);

  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    if (props.pack) return;

    try {
      const raw = localStorage.getItem("a10_lastReadingPack");
      if (raw) setPack(JSON.parse(raw));
    } catch {
      // ignore
    }

    try {
      const rawSocial = localStorage.getItem("a10_lastSocialThreadPack");
      if (rawSocial) setSocialPack(JSON.parse(rawSocial));
    } catch {
      // ignore
    }
  }, [props.pack]);

  useEffect(() => {
    if (props.pack !== undefined) setPack(props.pack ?? null);
  }, [props.pack]);

  const persistPack = useCallback(
    (p: ReadingPackData | null) => {
      setPack(p);
      props.onPackChange?.(p);
      try {
        if (p) localStorage.setItem("a10_lastReadingPack", JSON.stringify(p));
        else localStorage.removeItem("a10_lastReadingPack");
      } catch {
        // ignore
      }
    },
    [props]
  );

  const ensureCrestEmbedded = useCallback(
    async (p: ReadingPackData): Promise<ReadingPackData> => {
      if (p.crest && p.crest.startsWith("data:")) return p;
      if (p.crest && /^https?:\/\//i.test(p.crest)) return p;

      const fetched = await fetchAsDataUrl(crestFallbackPath);
      if (fetched) return { ...p, crest: fetched };

      return p;
    },
    [crestFallbackPath]
  );

  const disabledAll = !pack || !!busy;

  // ---- Interactive HTML ----
  const generateInteractive = useCallback(async () => {
    if (!pack) return;
    setBusy("interactive");
    try {
      const withCrest = await ensureCrestEmbedded(pack);
      const html = buildInteractiveHtml(withCrest);

      const slug = slugify(withCrest.title || "reading-pack") || "reading-pack";
      const parts = [
        "aontas10-reading",
        slug,
        withCrest.schoolClass ? `class${withCrest.schoolClass}` : null,
        withCrest.stage ? `stage${withCrest.stage}` : null,
        "interactive",
      ]
        .filter(Boolean)
        .join("-");
      const name = `${parts}.html`.replace(/--+/g, "-");

      downloadTextFile(name, html, "text/html;charset=utf-8");
      persistPack(withCrest);
    } finally {
      setBusy("");
    }
  }, [pack, ensureCrestEmbedded, persistPack]);

  // ---- Printables HTML (quick print) ----
  const openPrintablesStudentA = useCallback(async () => {
    if (!pack) return;
    setBusy("printA_html");
    try {
      const withCrest = await ensureCrestEmbedded(pack);
      openHtmlInNewTab(buildPrintablesHtml(withCrest, "standard", false));
      persistPack(withCrest);
    } finally {
      setBusy("");
    }
  }, [pack, ensureCrestEmbedded, persistPack]);

  const openPrintablesStudentB = useCallback(async () => {
    if (!pack) return;
    setBusy("printB_html");
    try {
      const withCrest = await ensureCrestEmbedded(pack);
      openHtmlInNewTab(buildPrintablesHtml(withCrest, "SUPPORTED", false));
      persistPack(withCrest);
    } finally {
      setBusy("");
    }
  }, [pack, ensureCrestEmbedded, persistPack]);

  const openTeacherKey = useCallback(async () => {
    if (!pack) return;
    setBusy("teacher_html");
    try {
      const withCrest = await ensureCrestEmbedded(pack);
      openHtmlInNewTab(buildTeacherKeyHtml(withCrest));
      persistPack(withCrest);
    } finally {
      setBusy("");
    }
  }, [pack, ensureCrestEmbedded, persistPack]);

  // ---- PDF downloads ----
  const downloadPdf = useCallback(
    async (which: "A" | "B" | "T") => {
      if (!pack) return;
      setBusy(`pdf_${which}`);
      try {
        const withCrest = await ensureCrestEmbedded(pack);
        const slug = slugify(withCrest.title || "reading-pack") || "reading-pack";
        const base = `aontas10-reading-${slug}-class${withCrest.schoolClass ?? ""}-stage${withCrest.stage ?? ""}`.replace(/--+/g, "-");

        const bytes =
          which === "A"
            ? await buildPrintablesPdfBytes(withCrest, { mode: "standard", includeAnswers: false })
            : which === "B"
              ? await buildPrintablesPdfBytes(withCrest, { mode: "SUPPORTED", includeAnswers: false })
              : await buildPrintablesPdfBytes(withCrest, { mode: "standard", includeAnswers: true });

        const name = `${base}-${which === "A" ? "studentA" : which === "B" ? "studentB" : "teacher"}-printables.pdf`;

        // TS-proof: copy into a fresh Uint8Array so the buffer is a real ArrayBuffer (not SharedArrayBuffer).
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        downloadBlobFile(name, new Blob([copy.buffer], { type: "application/pdf" }));

        persistPack(withCrest);
      } finally {
        setBusy("");
      }
    },
    [pack, ensureCrestEmbedded, persistPack]
  );

  // ---- DOCX downloads ----
  const downloadDocx = useCallback(
    async (which: "A" | "B" | "T") => {
      if (!pack) return;
      setBusy(`docx_${which}`);
      try {
        const withCrest = await ensureCrestEmbedded(pack);
        const slug = slugify(withCrest.title || "reading-pack") || "reading-pack";
        const base = `aontas10-reading-${slug}-class${withCrest.schoolClass ?? ""}-stage${withCrest.stage ?? ""}`.replace(/--+/g, "-");

        const blob =
          which === "A"
            ? await buildPrintablesDocxBlob(withCrest, { mode: "standard", includeAnswers: false })
            : which === "B"
              ? await buildPrintablesDocxBlob(withCrest, { mode: "SUPPORTED", includeAnswers: false })
              : await buildPrintablesDocxBlob(withCrest, { mode: "standard", includeAnswers: true });

        const name = `${base}-${which === "A" ? "studentA" : which === "B" ? "studentB" : "teacher"}-printables.docx`;
        downloadBlobFile(name, blob);
        persistPack(withCrest);
      } finally {
        setBusy("");
      }
    },
    [pack, ensureCrestEmbedded, persistPack]
  );

  const loadFromJsonBox = useCallback(() => {
    try {
      persistPack(JSON.parse(jsonBox));
      setShowJsonTools(false);
    } catch {
      alert("That JSON did not parse. Tip: paste the full export object.");
    }
  }, [jsonBox, persistPack]);

  // âœ… Generate Social Thread from the Reading Pack (derived)
  const generateSocialThread = useCallback(async () => {
    if (!pack) return;

    setSocialErr("");
    setBusy("social_generate");

    const sourceMode = socialSource;
    const sourceText =
      sourceMode === "standard"
        ? String(pack.reading?.standard || "").trim()
        : String(pack.reading?.SUPPORTED || pack.reading?.standard || "").trim();

    if (!sourceText) {
      setBusy("");
      setSocialErr("No reading text found on the pack (standard/SUPPORTED).");
      return;
    }

    socialAbortRef.current?.abort();
    socialAbortRef.current = new AbortController();

    try {
      const data = await postJson<{ pack: any }>(
        "/api/social-thread",
        {
          text: sourceText.slice(0, 12_000), // safety cap
          tongueInCheek,
          title: pack.title || "Social Thread",
        },
        socialAbortRef.current.signal
      );

      if (!data?.pack) throw new Error("No 'pack' returned from /api/social-thread.");
      setSocialPack(data.pack);

      try {
        localStorage.setItem("a10_lastSocialThreadPack", JSON.stringify(data.pack));
      } catch {
        // ignore
      }
    } catch (e: any) {
      setSocialErr(String(e?.message || e || "Unknown error"));
    } finally {
      setBusy("");
    }
  }, [pack, socialSource, tongueInCheek]);

  // âœ… Export Social Thread HTML
  const exportSocialThread = useCallback(async () => {
    setSocialErr("");
    if (!socialPack) {
      setSocialErr("Generate the Social Thread first.");
      return;
    }
    setBusy("social_export");
    try {
      await exportSocialThreadHtml({
        pack: socialPack,
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
    } catch (e: any) {
      setSocialErr(String(e?.message || e || "Export failed."));
    } finally {
      setBusy("");
    }
  }, [socialPack]);

  const clearSocial = useCallback(() => {
    setSocialPack(null);
    setSocialErr("");
    try {
      localStorage.removeItem("a10_lastSocialThreadPack");
    } catch {
      // ignore
    }
  }, []);

  const packSummary = useMemo(() => {
    if (!pack) return "No pack loaded yet.";
    const exCount = pack.exercises?.length ?? 0;
    return `${pack.title || "Untitled"} â€¢ Class ${pack.schoolClass ?? "?"} â€¢ Stage ${pack.stage ?? "?"} â€¢ ${exCount} exercises`;
  }, [pack]);

  const socialSummary = useMemo(() => {
    if (!socialPack) return "No social thread generated yet.";
    const stdMsgs = socialPack?.standard?.messages?.length ?? 0;
    const supMsgs = socialPack?.supported?.messages?.length ?? 0;
    const stdChecks = socialPack?.standard?.checks?.length ?? 0;
    const supChecks = socialPack?.supported?.checks?.length ?? 0;
    const t = String(socialPack?.title || "Social Thread");
    return `${t} â€¢ Std: ${stdMsgs} msgs / ${stdChecks} checks â€¢ Sup: ${supMsgs} msgs / ${supChecks} checks`;
  }, [socialPack]);
  // Wordiness: keep a seeded word pool in localStorage for the Wordiness Hub (/wordiness)
  useEffect(() => {
    try {
      const textForSeed = String((socialSource || socialSource || "") ?? "");
      if (!textForSeed.trim()) return;
      const seed = buildWordinessSeedFromText(textForSeed, "reading-pack");
      localStorage.setItem("wordiness_seed_json", JSON.stringify(seed));
    } catch (e) {}
  }, []);
  return (
    <div style={pageWrap}>
      
      {/* Wordiness quick launch */}
      <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9999 }}>
        <button
          type="button"
          onClick={() => window.open("/wordiness", "_blank", "noopener,noreferrer")}
          style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,.22)", background: "white", fontWeight: 900 }}
          aria-label="Open Wordiness Hub"
          title="Open Wordiness Hub"
        >
          Wordiness
        </button>
      </div>
<div style={innerWrap}>
        {/* Header */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 1100, fontSize: 22, color: BRAND.ink }}>Reading Pack</div>
            <div style={{ color: BRAND.muted, marginTop: 6, fontSize: 13 }}>{packSummary}</div>
            <div style={{ color: BRAND.muted2, marginTop: 6, fontSize: 12, lineHeight: 1.4 }}>
              Interactive export is separate. Printables export as HTML (quick print), PDF, or DOCX.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: BRAND.muted, fontWeight: 900 }}>
              Preview mode{" "}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ReadingMode)}
                style={{
                  marginLeft: 8,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${BRAND.line}`,
                  background: "white",
                  color: BRAND.ink,
                  fontWeight: 900,
                }}
              >
                <option value="standard">Standard (A)</option>
                <option value="SUPPORTED">Supported (B)</option>
              </select>
            </label>

            <button onClick={() => setShowJsonTools((v) => !v)} style={btnStyle("secondary")} type="button">
              {showJsonTools ? "Close JSON tools" : "JSON tools"}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {!pack && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 1100, fontSize: 16, color: BRAND.ink }}>No pack loaded</div>
            <div style={{ color: BRAND.muted, fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>
              Generate a Reading Pack from the main workflow, or paste a saved JSON export below to recover.
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setShowJsonTools(true)} style={btnStyle("primary")} type="button">
                Paste JSON export
              </button>
              <button onClick={() => persistPack(null)} style={btnStyle("secondary")} type="button">
                Clear saved pack
              </button>
            </div>
          </div>
        )}

        {/* Interactive */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Interactive</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={generateInteractive}
              disabled={disabledAll}
              style={btnStyle("primary", { busy: busy === "interactive", disabled: disabledAll })}
              type="button"
            >
              {busy === "interactive" ? "Generatingâ€¦" : "Generate Interactive HTML"}
            </button>
            <div style={{ fontSize: 12, color: BRAND.muted2, lineHeight: 1.3 }}>
              Screen-first file with reading tools (Bionic, one-at-a-time, night mode).
            </div>
          </div>
        </div>

        {/* âœ… Social Thread (derived from the reading pack) */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Social Thread (derived)</div>

          <div style={{ color: BRAND.muted2, fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
            Generates a class-friendly social-media-style thread based on the Reading Pack text, with Standard + Supported variants and a shared learning target.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, color: BRAND.muted, fontWeight: 900 }}>
              Source{" "}
              <select
                value={socialSource}
                onChange={(e) => setSocialSource(e.target.value as any)}
                style={{
                  marginLeft: 8,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${BRAND.line}`,
                  background: "white",
                  color: BRAND.ink,
                  fontWeight: 900,
                }}
              >
                <option value="standard">Use Standard reading</option>
                <option value="SUPPORTED">Use Supported reading</option>
              </select>
            </label>

            <label style={{ display: "inline-flex", gap: 10, alignItems: "center", fontSize: 12, color: BRAND.muted, fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={tongueInCheek}
                onChange={(e) => setTongueInCheek(e.target.checked)}
              />
              Tongue-in-cheek (still school-appropriate)
            </label>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={generateSocialThread}
              disabled={!pack || !!busy}
              style={btnStyle("primary", { busy: busy === "social_generate", disabled: !pack || !!busy })}
              type="button"
            >
              {busy === "social_generate" ? "Generatingâ€¦" : "Generate Social Thread"}
            </button>

            <button
              onClick={exportSocialThread}
              disabled={!socialPack || !!busy}
              style={btnStyle("secondary", { busy: busy === "social_export", disabled: !socialPack || !!busy })}
              type="button"
            >
              {busy === "social_export" ? "Exportingâ€¦" : "Export Social HTML"}
            </button>

            <button
              onClick={() => {
                socialAbortRef.current?.abort();
                setBusy("");
              }}
              disabled={!busy}
              style={btnStyle("secondary", { disabled: !busy })}
              type="button"
            >
              Cancel
            </button>

            <button onClick={clearSocial} style={btnStyle("danger")} type="button">
              Clear Social
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: BRAND.muted2 }}>
            {socialSummary}
          </div>

          {socialErr && (
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
              {socialErr}
            </pre>
          )}
        </div>

        {/* Printables */}
        <div style={cardStyle}>
          <div style={sectionTitle}>Printables</div>

          <div style={{ display: "grid", gap: 12 }}>
            {/* HTML quick print */}
            <div style={{ padding: 12, borderRadius: 18, border: `1px solid ${BRAND.line}`, background: BRAND.panel2 }}>
              <div style={{ fontWeight: 1000, fontSize: 13, color: BRAND.ink, marginBottom: 10 }}>Quick print (HTML)</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={openPrintablesStudentA}
                  disabled={disabledAll}
                  style={btnStyle("secondary", { busy: busy === "printA_html", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "printA_html" ? "Openingâ€¦" : "Open: Student A"}
                </button>
                <button
                  onClick={openPrintablesStudentB}
                  disabled={disabledAll}
                  style={btnStyle("secondary", { busy: busy === "printB_html", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "printB_html" ? "Openingâ€¦" : "Open: Student B"}
                </button>
                <button
                  onClick={openTeacherKey}
                  disabled={disabledAll}
                  style={btnStyle("secondary", { busy: busy === "teacher_html", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "teacher_html" ? "Openingâ€¦" : "Open: Teacher Key"}
                </button>
              </div>
            </div>

            {/* PDF */}
            <div style={{ padding: 12, borderRadius: 18, border: `1px solid ${BRAND.line}`, background: BRAND.panel2 }}>
              <div style={{ fontWeight: 1000, fontSize: 13, color: BRAND.ink, marginBottom: 10 }}>PDF downloads</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => downloadPdf("A")}
                  disabled={disabledAll}
                  style={btnStyle("primary", { busy: busy === "pdf_A", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "pdf_A" ? "Building PDFâ€¦" : "Student A (PDF)"}
                </button>
                <button
                  onClick={() => downloadPdf("B")}
                  disabled={disabledAll}
                  style={btnStyle("primary", { busy: busy === "pdf_B", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "pdf_B" ? "Building PDFâ€¦" : "Student B (PDF)"}
                </button>
                <button
                  onClick={() => downloadPdf("T")}
                  disabled={disabledAll}
                  style={btnStyle("secondary", { busy: busy === "pdf_T", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "pdf_T" ? "Building PDFâ€¦" : "Teacher Key (PDF)"}
                </button>
              </div>
            </div>

            {/* DOCX */}
            <div style={{ padding: 12, borderRadius: 18, border: `1px solid ${BRAND.line}`, background: BRAND.panel2 }}>
              <div style={{ fontWeight: 1000, fontSize: 13, color: BRAND.ink, marginBottom: 10 }}>DOCX downloads</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => downloadDocx("A")}
                  disabled={disabledAll}
                  style={btnStyle("primary", { busy: busy === "docx_A", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "docx_A" ? "Building DOCXâ€¦" : "Student A (DOCX)"}
                </button>
                <button
                  onClick={() => downloadDocx("B")}
                  disabled={disabledAll}
                  style={btnStyle("primary", { busy: busy === "docx_B", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "docx_B" ? "Building DOCXâ€¦" : "Student B (DOCX)"}
                </button>
                <button
                  onClick={() => downloadDocx("T")}
                  disabled={disabledAll}
                  style={btnStyle("secondary", { busy: busy === "docx_T", disabled: disabledAll })}
                  type="button"
                >
                  {busy === "docx_T" ? "Building DOCXâ€¦" : "Teacher Key (DOCX)"}
                </button>
              </div>

              <div style={smallNote}>Student B uses larger type + looser spacing. Teacher Key shows the shared answers.</div>
            </div>
          </div>
        </div>

        {showJsonTools && (
          <div style={cardStyle}>
            <div style={sectionTitle}>JSON tools</div>
            <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>
              Paste a full ReadingPack JSON export here to load it into the app (recovery / sharing).
            </div>

            <textarea
              value={jsonBox}
              onChange={(e) => setJsonBox(e.target.value)}
              placeholder='Paste JSON like: { "title": "...", "reading": { ... }, "exercises": [ ... ] }'
              style={{
                width: "100%",
                minHeight: 180,
                padding: 12,
                borderRadius: 16,
                border: `1px solid ${BRAND.line}`,
                background: "white",
                color: BRAND.ink,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.4,
              }}
            />

            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={loadFromJsonBox} style={btnStyle("primary")} type="button">
                Load JSON into app
              </button>
              <button onClick={() => setJsonBox(pack ? JSON.stringify(pack, null, 2) : "")} style={btnStyle("secondary")} type="button">
                Dump current pack to JSON
              </button>
              <button onClick={() => persistPack(null)} style={btnStyle("danger")} type="button">
                Clear pack
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {pack && (
          <div style={cardStyle}>
            <div style={sectionTitle}>Preview</div>
            <div style={{ color: BRAND.muted, fontSize: 12, marginBottom: 10 }}>Quick preview only. Export files are the source of truth.</div>

            <div style={grid2}>
              <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 12, background: "white" }}>
                <div style={{ fontWeight: 1000, marginBottom: 8, color: BRAND.ink }}>Reading ({mode})</div>
                {splitParas(pack.reading?.[mode] || "")
                  .slice(0, 4)
                  .map((p, idx) => (
                    <p key={idx} style={{ margin: "0 0 10px", lineHeight: 1.55, color: BRAND.ink }}>
                      {p}
                    </p>
                  ))}
                {splitParas(pack.reading?.[mode] || "").length > 4 && <div style={{ color: BRAND.muted2, fontSize: 12 }}>â€¦ (preview truncated)</div>}
              </div>

              <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 12, background: "white" }}>
                <div style={{ fontWeight: 1000, marginBottom: 8, color: BRAND.ink }}>Exercises</div>
                <div style={{ color: BRAND.muted2, fontSize: 12, marginBottom: 10 }}>{pack.exercises?.length ?? 0} total</div>
                <ol style={{ margin: 0, paddingLeft: 18 }}>
                  {(pack.exercises || []).slice(0, 6).map((_, i) => (
                    <li key={i} style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 800, color: BRAND.ink }}>{getSidePrompt(pack, mode, i)}</div>
                    </li>
                  ))}
                </ol>
                {(pack.exercises || []).length > 6 && <div style={{ color: BRAND.muted2, fontSize: 12 }}>â€¦ (preview truncated)</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

