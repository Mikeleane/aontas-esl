"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import ReadingPackApp, { type ReadingPackData } from "./_features/reading/ReadingPackApp";

type InputKind = "link" | "text" | "paste" | "upload";

type MaterialInput =
  | { kind: "link"; url: string }
  | { kind: "text"; text: string }
  | { kind: "upload"; filename: string; mime: string; dataUrl: string }
  | { kind: "paste"; mime: string; dataUrl: string };

type TeacherRequest = {
  meta: {
    schoolClass?: number; // 1-6
    stage?: number; // 1-4
    titleHint?: string;
    allowLocalNames?: boolean;
    pilotMode?: boolean;
  };
  alignment: {
    textType?: string;
    purpose?: string[];
    supports?: string[];
    notes?: string;
  };
  material: MaterialInput;
};

const API_URL = "/api/reading/generate-pack";

// From your spec (trimmed to the practical “teacher UI” set)
const TEXT_TYPES = [
  "Narrative",
  "Recount",
  "Report",
  "Explanation",
  "Procedure",
  "Persuasive",
  "Response (personal/critical)",
  "Poetry",
  "Drama",
  "Media / Multimodal",
];

const PURPOSES = [
  "Comprehension (literal + inferential)",
  "Vocabulary (tier 2/3 words)",
  "Fluency (pace, expression)",
  "Author’s craft (structure, language)",
  "Critical thinking (bias, viewpoint, evidence)",
  "Writing connection (model a text type)",
  "Oral language (discussion prompts)",
];

const SUPPORTS = [
  "Supported version (same target, same answer key)",
  "Clear layout + generous spacing",
  "Chunking (one paragraph at a time)",
  "Bionic reading option in interactive",
  "Glossary / key words",
  "Sentence starters",
  "Reduced extraneous load (keep meaning, simplify access)",
];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function slugify(s: string) {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("FileReader failed"));
    r.readAsDataURL(file);
  });
}

async function postJson<T>(url: string, body: any, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
  }
  return (await res.json()) as T;
}

type MaterialType = "link" | "text" | "image" | "pdf" | "docx" | "other";

type ApiMaterial = {
  id: string;
  type: MaterialType;
  title: string;
  url?: string;
  rawText?: string;
  extractedText?: string;
  fileName?: string;
  mimeType?: string;
  fileDataUrl?: string;
  useAsPrimaryText?: boolean;
};

function materialTypeFromMime(mime: string): MaterialType {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("docx") || m.includes("wordprocessingml")) return "docx";
  if (m.startsWith("text/")) return "text";
  return "other";
}

function teacherRequestToApiBody(req: TeacherRequest) {
  const id = "primary";
  const mat = req.material;

  let materials: ApiMaterial[] = [];
  let primaryText: string | undefined;
  let primaryUrl: string | undefined;
  let primaryImageDataUrl: string | undefined;

  if (mat.kind === "text") {
    primaryText = mat.text;
    materials = [
      { id, type: "text", title: "Text", rawText: mat.text, extractedText: mat.text, useAsPrimaryText: true },
    ];
  } else if (mat.kind === "link") {
    primaryUrl = mat.url;
    materials = [{ id, type: "link", title: "Link", url: mat.url, useAsPrimaryText: true }];
  } else if (mat.kind === "paste") {
    primaryImageDataUrl = mat.dataUrl; // data:image/... base64
    materials = [
      { id, type: "image", title: "Pasted screenshot", mimeType: mat.mime, fileDataUrl: mat.dataUrl, useAsPrimaryText: true },
    ];
  } else if (mat.kind === "upload") {
    const t = materialTypeFromMime(mat.mime);
    if (t === "image") primaryImageDataUrl = mat.dataUrl;

    materials = [
      {
        id,
        type: t,
        title: mat.filename,
        fileName: mat.filename,
        mimeType: mat.mime,
        fileDataUrl: mat.dataUrl,
        useAsPrimaryText: true,
      },
    ];
  }

  // Optional: pack teacher alignment into a simple teacherContext that the API prompt can use
  const teacherContext = {
    contextTags: [
      req.alignment.textType || "",
      ...(req.alignment.purpose || []),
      ...(req.alignment.supports || []),
    ].filter(Boolean),
    crossCurricularLinks: [],
    authenticMaterialTypes: [],
    localVocab: req.alignment.notes || "",
    localGlossary: [],
    useLocalContextExactly: true,
    onlyUseProvidedFacts: true,
  };

  return {
    title: req.meta.titleHint,
    stage: req.meta.stage,
    schoolClass: req.meta.schoolClass,
    pilotMode: req.meta.pilotMode,

    primaryText,
    primaryUrl,
    primaryImageDataUrl,

    materials,
    primaryMaterialId: "primary",
    teacherContext,

    // Optional “alignment-ish” fields your API prompt can mention
    genre: req.alignment.textType,
    purpose: (req.alignment.purpose || []).join("; "),
  };
}


export default function Page() {
  // The generated pack (feeds into ReadingPackApp)
  const [pack, setPack] = useState<ReadingPackData | null>(null);

  // Teacher inputs
  const [inputKind, setInputKind] = useState<InputKind>("paste");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [uploaded, setUploaded] = useState<{ filename: string; mime: string; dataUrl: string } | null>(null);
  const [pasted, setPasted] = useState<{ mime: string; dataUrl: string } | null>(null);

  // Alignment/meta
  const [schoolClass, setSchoolClass] = useState<number>(5);
  const [stage, setStage] = useState<number>(4);
  const [titleHint, setTitleHint] = useState<string>("");
  const [textType, setTextType] = useState<string>(TEXT_TYPES[0]);
  const [purpose, setPurpose] = useState<string[]>(["Comprehension (literal + inferential)"]);
  const [supports, setSupports] = useState<string[]>(["Supported version (same target, same answer key)"]);
  const [allowLocalNames, setAllowLocalNames] = useState(true);
  const [pilotMode, setPilotMode] = useState(false);
  const [notes, setNotes] = useState("");

  // Busy + errors
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  // Persist teacher form (so a refresh doesn’t nuke everything)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("a10_teacherInputs_v1");
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj?.inputKind) setInputKind(obj.inputKind);
      if (typeof obj?.url === "string") setUrl(obj.url);
      if (typeof obj?.text === "string") setText(obj.text);
      if (obj?.uploaded) setUploaded(obj.uploaded);
      if (obj?.pasted) setPasted(obj.pasted);

      if (typeof obj?.schoolClass === "number") setSchoolClass(clamp(obj.schoolClass, 1, 6));
      if (typeof obj?.stage === "number") setStage(clamp(obj.stage, 1, 4));
      if (typeof obj?.titleHint === "string") setTitleHint(obj.titleHint);
      if (typeof obj?.textType === "string") setTextType(obj.textType);
      if (Array.isArray(obj?.purpose)) setPurpose(obj.purpose);
      if (Array.isArray(obj?.supports)) setSupports(obj.supports);
      if (typeof obj?.allowLocalNames === "boolean") setAllowLocalNames(obj.allowLocalNames);
      if (typeof obj?.pilotMode === "boolean") setPilotMode(obj.pilotMode);
      if (typeof obj?.notes === "string") setNotes(obj.notes);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "a10_teacherInputs_v1",
        JSON.stringify({
          inputKind,
          url,
          text,
          uploaded,
          pasted,
          schoolClass,
          stage,
          titleHint,
          textType,
          purpose,
          supports,
          allowLocalNames,
          pilotMode,
          notes,
        })
      );
    } catch {
      // ignore
    }
  }, [inputKind, url, text, uploaded, pasted, schoolClass, stage, titleHint, textType, purpose, supports, allowLocalNames, pilotMode, notes]);

  const material: MaterialInput | null = useMemo(() => {
    if (inputKind === "link") {
      const u = url.trim();
      if (!u) return null;
      return { kind: "link", url: u };
    }
    if (inputKind === "text") {
      const t = text.trim();
      if (!t) return null;
      return { kind: "text", text: t };
    }
    if (inputKind === "upload") {
      if (!uploaded) return null;
      return { kind: "upload", ...uploaded };
    }
    // paste
    if (!pasted) return null;
    return { kind: "paste", ...pasted };
  }, [inputKind, url, text, uploaded, pasted]);

  function toggleInList(list: string[], value: string) {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  async function handlePasteFromClipboard() {
    setErr("");
    try {
      // Prefer image from clipboard
      const items = await (navigator.clipboard as any)?.read?.();
      if (items && items.length) {
        for (const it of items) {
          const types: string[] = it.types || [];
          const imgType = types.find((t) => t.startsWith("image/"));
          if (imgType) {
            const blob = await it.getType(imgType);
            const file = new File([blob], `pasted.${imgType.split("/")[1] || "png"}`, { type: imgType });
            const dataUrl = await fileToDataUrl(file);
            setPasted({ mime: imgType, dataUrl });
            setInputKind("paste");
            return;
          }
        }
      }
      setErr("Clipboard read worked, but no image found. Try copying an image/screenshot first.");
    } catch {
      setErr("Clipboard read failed (browser permission). You can still Ctrl+V into the paste box below.");
    }
  }

  async function handleGeneratePack() {
    setErr("");
    if (!material) {
      setErr("Add some material first (link, text, pasted screenshot, or upload).");
      return;
    }

    const req: TeacherRequest = {
      meta: {
        schoolClass,
        stage,
        titleHint: titleHint.trim() || undefined,
        allowLocalNames,
        pilotMode,
      },
      alignment: {
        textType,
        purpose,
        supports,
        notes: notes.trim() || undefined,
      },
      material,
    };

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setBusy(true);
    try {
      const apiBody = teacherRequestToApiBody(req);
console.log("GENERATE payload", apiBody);

const res = await postJson<any>(API_URL, apiBody, abortRef.current.signal);

// Your route might return { pack: ... } OR the pack directly.
// This makes the client tolerant of either.
const returnedPack = (res?.pack ?? res) as ReadingPackData;

if (!returnedPack) throw new Error("No pack returned from API.");
setPack(returnedPack);

      if (!res?.pack) throw new Error("No pack returned from API.");
      setPack(res.pack);
      // Scroll to the pack tools for instant gratification
      setTimeout(() => window.scrollTo({ top: 999999, behavior: "smooth" }), 50);
    } catch (e: any) {
      setErr(
        String(e?.message || e || "Unknown error") +
          "\n\nIf you haven’t created the API route yet, make /api/reading/generate-pack return { pack: ... }."
      );
    } finally {
      setBusy(false);
    }
  }

  function onPasteEvent(e: React.ClipboardEvent) {
    setErr("");
    try {
      const dt = e.clipboardData;
      if (!dt) return;

      // Image paste
      const items = Array.from(dt.items || []);
      const imgItem = items.find((it) => it.type && it.type.startsWith("image/"));
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (file) {
          fileToDataUrl(file).then((dataUrl) => {
            setPasted({ mime: file.type || "image/png", dataUrl });
            setInputKind("paste");
          });
          return;
        }
      }

      // Text paste fallback (if they paste text while on paste tab)
      const t = dt.getData("text/plain");
      if (t && t.trim()) {
        setText((prev) => (prev ? prev + "\n\n" + t : t));
        setInputKind("text");
      }
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>
      <div style={heroStyle}>
        <div style={{ fontWeight: 950, fontSize: 20 }}>Aontas 10 — Teacher Input → Reading Pack</div>
        <div style={{ color: "#475569", marginTop: 8, lineHeight: 1.45 }}>
          Paste a link, text, or a screenshot — or upload a photo/doc. Then generate a pack.
          <span style={{ display: "block", marginTop: 6, color: "#64748b" }}>
            Interactive output is separate from printables (HTML/PDF/DOCX) to keep things stable.
          </span>
        </div>
      </div>

      {/* INPUT CARD */}
      <div style={cardStyle}>
        <div style={cardHeadStyle}>
          <div>
            <div style={{ fontWeight: 900 }}>1) Add your material</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              Link • Text • Pasted screenshot • Upload
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["paste", "link", "text", "upload"] as InputKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setInputKind(k)}
                style={pillBtnStyle(inputKind === k)}
              >
                {k === "paste" ? "Paste screenshot" : k === "link" ? "Link" : k === "text" ? "Text" : "Upload"}
              </button>
            ))}
          </div>
        </div>

        <div onPaste={onPasteEvent} style={{ padding: 14 }}>
          {inputKind === "link" && (
            <div>
              <div style={labelStyle}>Paste a link</div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                style={inputStyle}
              />
              <div style={hintStyle}>We’ll send the URL to the generator (your API decides how to fetch/handle it).</div>
            </div>
          )}

          {inputKind === "text" && (
            <div>
              <div style={labelStyle}>Paste text</div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste an extract or full text here..."
                style={{ ...inputStyle, minHeight: 160, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
              />
              <div style={hintStyle}>Tip: you can also Ctrl+V text into the paste area — it’ll land here.</div>
            </div>
          )}

          {inputKind === "upload" && (
            <div>
              <div style={labelStyle}>Upload a file</div>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={async (e) => {
                  setErr("");
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const dataUrl = await fileToDataUrl(f);
                  setUploaded({ filename: f.name, mime: f.type || "application/octet-stream", dataUrl });
                }}
              />
              {uploaded && (
                <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={miniTagStyle}>{uploaded.filename}</div>
                  <div style={miniTagStyle}>{uploaded.mime || "unknown type"}</div>
                  <button type="button" onClick={() => setUploaded(null)} style={smallBtnStyle}>
                    Remove
                  </button>
                </div>
              )}
              <div style={hintStyle}>Uploads are sent as data URLs to your API (so the generator can “see” them).</div>
            </div>
          )}

          {inputKind === "paste" && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={labelStyle}>Paste a screenshot</div>
                <button type="button" onClick={handlePasteFromClipboard} style={smallBtnStyle}>
                  Paste from clipboard
                </button>
                <div style={hintStyle}>Or click here and press Ctrl+V / Cmd+V.</div>
              </div>

              <div style={pasteBoxStyle}>
                {pasted ? (
                  <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "start" }}>
                    <img
                      src={pasted.dataUrl}
                      alt="Pasted screenshot"
                      style={{ width: 220, borderRadius: 12, border: "1px solid rgba(15,23,42,.14)" }}
                    />
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={miniTagStyle}>{pasted.mime}</div>
                        <button type="button" onClick={() => setPasted(null)} style={smallBtnStyle}>
                          Remove
                        </button>
                      </div>
                      <div style={hintStyle}>
                        Nice. This goes to the generator as an image data URL (no fragile inline script tags in TSX, yay).
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#64748b", fontSize: 13 }}>
                    Click in this box and paste an image. (You can also paste text — it will switch to the Text tab.)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ALIGNMENT CARD */}
      <div style={cardStyle}>
        <div style={cardHeadStyle}>
          <div>
            <div style={{ fontWeight: 900 }}>2) Curriculum alignment + outputs</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              Class/Stage • Text type • Purpose • Supports • Pilot mode
            </div>
          </div>
        </div>

        <div style={{ padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label style={fieldStyle}>
              <div style={labelStyle}>Class</div>
              <input
                type="number"
                min={1}
                max={6}
                value={schoolClass}
                onChange={(e) => setSchoolClass(clamp(Number(e.target.value || 1), 1, 6))}
                style={inputStyle}
              />
            </label>

<a href="/social" style={{ fontWeight: 900 }}>Open Social Thread Generator</a>


            <label style={fieldStyle}>
              <div style={labelStyle}>Stage</div>
              <input
                type="number"
                min={1}
                max={4}
                value={stage}
                onChange={(e) => setStage(clamp(Number(e.target.value || 1), 1, 4))}
                style={inputStyle}
              />
            </label>

            <label style={fieldStyle}>
              <div style={labelStyle}>Title hint (optional)</div>
              <input
                value={titleHint}
                onChange={(e) => setTitleHint(e.target.value)}
                placeholder="e.g., Forest fires and ecosystems"
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={fieldStyle}>
              <div style={labelStyle}>Text type</div>
              <select value={textType} onChange={(e) => setTextType(e.target.value)} style={inputStyle}>
                {TEXT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldStyle}>
              <div style={labelStyle}>Purpose (choose any)</div>
              <div style={chipWrapStyle}>
                {PURPOSES.map((p) => (
                  <button key={p} type="button" onClick={() => setPurpose((prev) => toggleInList(prev, p))} style={chipStyle(purpose.includes(p))}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div style={fieldStyle}>
              <div style={labelStyle}>Supports (choose any)</div>
              <div style={chipWrapStyle}>
                {SUPPORTS.map((s) => (
                  <button key={s} type="button" onClick={() => setSupports((prev) => toggleInList(prev, s))} style={chipStyle(supports.includes(s))}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={fieldStyle}>
              <div style={labelStyle}>Teacher notes (optional)</div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Local context, sensitive points, class interests, tricky vocabulary, etc."
                style={{ ...inputStyle, minHeight: 100 }}
              />
            </label>

            <div style={fieldStyle}>
              <div style={labelStyle}>Options</div>
              <label style={checkStyle}>
                <input type="checkbox" checked={allowLocalNames} onChange={(e) => setAllowLocalNames(e.target.checked)} />
                Allow local names/place names/cultural references (teacher judgment)
              </label>
              <label style={checkStyle}>
                <input type="checkbox" checked={pilotMode} onChange={(e) => setPilotMode(e.target.checked)} />
                Pilot mode (warn about possible copyright / internal use only)
              </label>
              <div style={hintStyle}>
                These flags simply travel with the request — your API can enforce/label outputs.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleGeneratePack}
              disabled={busy}
              style={{
                ...bigBtnStyle,
                opacity: busy ? 0.7 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Generating pack..." : "Generate Reading Pack"}
            </button>

            <button
              type="button"
              onClick={() => {
                abortRef.current?.abort();
                setBusy(false);
              }}
              style={smallBtnStyle}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                setPack(null);
                setErr("");
              }}
              style={smallBtnStyle}
            >
              Clear pack
            </button>

            <div style={{ color: material ? "#16a34a" : "#b45309", fontSize: 12, fontWeight: 800 }}>
              {material ? "Material ready ✓" : "Add material to generate"}
            </div>
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
      </div>

      {/* OUTPUTS */}
      <div style={{ marginTop: 18 }}>
        <ReadingPackApp pack={pack} onPackChange={setPack} crestFallbackPath="/kns-crest.jpg" />
      </div>

      <div style={{ marginTop: 18, color: "#64748b", fontSize: 12, lineHeight: 1.5 }}>
        Nerdy sanity check: this page only collects inputs and asks your API to generate a pack. ReadingPackApp then handles exports.
        That separation is the whole “keep it stable” plan.
      </div>
    </div>
  );
}

/* ---------- styles (simple, robust) ---------- */

const heroStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(244,197,66,.20), rgba(255,255,255,0))",
  border: "1px solid rgba(15,23,42,.12)",
  borderRadius: 18,
  padding: 14,
};

const cardStyle: React.CSSProperties = {
  marginTop: 14,
  background: "white",
  border: "1px solid rgba(15,23,42,.12)",
  borderRadius: 18,
  overflow: "hidden",
  boxShadow: "0 6px 20px rgba(2,6,23,.06)",
};

const cardHeadStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid rgba(15,23,42,.10)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  background: "linear-gradient(180deg, rgba(79,179,217,.16), rgba(255,255,255,0))",
};

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#475569", fontWeight: 900, marginBottom: 6 };

const hintStyle: React.CSSProperties = { color: "#64748b", fontSize: 12, marginTop: 8 };

const fieldStyle: React.CSSProperties = { border: "1px solid rgba(15,23,42,.10)", borderRadius: 14, padding: 12 };

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(15,23,42,.14)",
  outline: "none",
};

const pasteBoxStyle: React.CSSProperties = {
  marginTop: 10,
  border: "2px dashed rgba(15,23,42,.18)",
  borderRadius: 16,
  padding: 12,
  minHeight: 120,
  background: "#f8fafc",
};

const miniTagStyle: React.CSSProperties = {
  border: "1px solid rgba(15,23,42,.14)",
  borderRadius: 999,
  padding: "6px 10px",
  fontSize: 12,
  fontWeight: 900,
  color: "#0f172a",
  background: "#f1f5f9",
};

function pillBtnStyle(active: boolean): React.CSSProperties {
  return {
    border: "1px solid rgba(15,23,42,.14)",
    background: active ? "#0f172a" : "white",
    color: active ? "white" : "#0f172a",
    borderRadius: 999,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  };
}

const smallBtnStyle: React.CSSProperties = {
  border: "1px solid rgba(15,23,42,.14)",
  background: "white",
  borderRadius: 12,
  padding: "9px 12px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const bigBtnStyle: React.CSSProperties = {
  border: "1px solid rgba(15,23,42,.14)",
  background: "#f1f5f9",
  borderRadius: 14,
  padding: "11px 14px",
  fontSize: 13,
  fontWeight: 950,
};

const chipWrapStyle: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };

function chipStyle(active: boolean): React.CSSProperties {
  return {
    border: "1px solid rgba(15,23,42,.14)",
    background: active ? "#0f172a" : "#ffffff",
    color: active ? "white" : "#0f172a",
    borderRadius: 999,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    textAlign: "left",
  };
}

const checkStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  padding: "8px 0",
  fontSize: 13,
  color: "#0f172a",
};
