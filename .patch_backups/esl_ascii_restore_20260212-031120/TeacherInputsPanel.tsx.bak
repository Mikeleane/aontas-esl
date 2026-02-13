"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

export type MaterialKind = "link" | "text" | "image" | "file";

export type TeacherMaterial = {
  id: string;
  kind: MaterialKind;
  title: string;
  sourceLabel?: string; // e.g. URL or filename
  createdAt: number;

  // Raw payload
  url?: string; // for link materials
  text?: string; // for text materials or extracted text
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;

  // For images/files in-browser
  objectUrl?: string; // URL.createObjectURL(file)
  dataUrl?: string; // optional: base64 data URL (for small images if you want)
  isPrimary?: boolean;

  // Editable extraction field
  extractedText?: string;
};

export type CurriculumTarget = {
  // Pilot mode: warn about potential copyright limits; outputs for internal/pilot use
  pilotMode?: boolean;

  classLevel?: number;
  stage?: number;

  purpose?: string;
  genre?: string;
  form?: string;

  strand?: string;
  element?: string;
  outcome?: string;
};

export type Enrichment = {
  contextTags: string[];
  crossCurricularLinks: string[];
  authenticMaterialTypes: string[];

  localVocabPreferred: string[]; // preferred vocabulary list
  glossary: { term: string; definition: string }[];

  useLocalContextExactly: boolean;
  onlyUseProvidedFacts: boolean;

  pilotMode: boolean;
};

export type TeacherInputsPayload = {
  title?: string;
  curriculum: CurriculumTarget;
  enrichment: Enrichment;
  materials: TeacherMaterial[];

  primaryMaterialId?: string;
  primaryText?: string; // canonical text used for generation
};

type Props = {
  onGenerate?: (payload: TeacherInputsPayload) => Promise<void> | void;
};

function uid() {
  // crypto.randomUUID is great, but fallback keeps us safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = globalThis as any;
  return (c.crypto?.randomUUID?.() as string) || `m_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function humanSize(n?: number) {
  if (!n || n <= 0) return "";
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function splitLinesToList(s: string) {
  return (s || "")
    .split(/\r?\n|,/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function scanHeadsUp(text: string) {
  const t = text || "";
  const hits: { label: string; sample: string }[] = [];

  const email = t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (email?.length) hits.push({ label: "Email(s) detected", sample: email.slice(0, 2).join(", ") });

  const phone = t.match(/(\+?\d[\d\s().-]{7,}\d)/g);
  if (phone?.length) hits.push({ label: "Phone-like number(s) detected", sample: phone.slice(0, 2).join(", ") });

  const eircode = t.match(/\b([AC-FHKNPRTV-Y]\d{2}|D6W)\s?[0-9AC-FHKNPRTV-Y]{4}\b/gi);
  if (eircode?.length) hits.push({ label: "Eircode-like code(s) detected", sample: eircode.slice(0, 2).join(", ") });

  // Gentle â€œproper noun clustersâ€ (not perfect, just a nudge)
  const proper = t.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g);
  if (proper?.length) hits.push({ label: "Potential names/places detected", sample: proper.slice(0, 2).join(", ") });

  return hits;
}

export default function TeacherInputsPanel({ onGenerate }: Props) {
  const [title, setTitle] = useState<string>("");

  const [materials, setMaterials] = useState<TeacherMaterial[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // Add material inputs
  const [addKind, setAddKind] = useState<MaterialKind>("link");
  const [linkUrl, setLinkUrl] = useState("");
  const [textPaste, setTextPaste] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Curriculum
  const [curriculum, setCurriculum] = useState<CurriculumTarget>({
    classLevel: 5,
    stage: 4,
    purpose: "Read to learn",
    genre: "Informational",
    form: "Article",
    strand: "Oral Language / Reading / Writing",
    element: "Comprehension",
    outcome: "",
  });

  // Enrichment
  const [contextTagsRaw, setContextTagsRaw] = useState("");
  const [crossLinksRaw, setCrossLinksRaw] = useState("");
  const [authTypesRaw, setAuthTypesRaw] = useState("");

  const [vocabRaw, setVocabRaw] = useState("");
  const [glossaryRaw, setGlossaryRaw] = useState("");

  const [pilotMode, setPilotMode] = useState<boolean>(true);
  const [useLocalContextExactly, setUseLocalContextExactly] = useState<boolean>(true);
  const [onlyUseProvidedFacts, setOnlyUseProvidedFacts] = useState<boolean>(true);

  const active = useMemo(() => materials.find((m) => m.id === activeId) || null, [materials, activeId]);

  // Auto-select first material
  useEffect(() => {
    if (!activeId && materials.length) setActiveId(materials[0].id);
  }, [materials, activeId]);

  // Clipboard paste for screenshots/images
  const onPasteCapture = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;

    const images: File[] = [];
    for (const it of items) {
      if (it.type?.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) images.push(f);
      }
    }
    if (!images.length) return;

    e.preventDefault();

    const created: TeacherMaterial[] = images.map((f, idx) => {
      const obj = URL.createObjectURL(f);
      return {
        id: uid(),
        kind: "image",
        title: `Pasted screenshot ${images.length > 1 ? `(${idx + 1})` : ""}`.trim(),
        sourceLabel: f.name || "clipboard-image",
        createdAt: Date.now(),
        fileName: f.name,
        mimeType: f.type,
        sizeBytes: f.size,
        objectUrl: obj,
        extractedText: "",
      };
    });

    setMaterials((prev) => {
      const next = [...created, ...prev];
      // Make newest primary if none exists
      if (!next.some((m) => m.isPrimary)) next[0].isPrimary = true;
      return next;
    });
    setActiveId(created[0].id);
  };

  const setPrimary = (id: string) => {
    setMaterials((prev) =>
      prev.map((m) => ({
        ...m,
        isPrimary: m.id === id,
      }))
    );
  };

  const removeMaterial = (id: string) => {
    setMaterials((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target?.objectUrl) URL.revokeObjectURL(target.objectUrl);

      const next = prev.filter((m) => m.id !== id);
      // ensure a primary exists
      if (next.length && !next.some((m) => m.isPrimary)) next[0].isPrimary = true;

      // repair active selection
      if (id === activeId) setActiveId(next[0]?.id || "");
      return next;
    });
  };

  const addLink = () => {
    const url = linkUrl.trim();
    if (!url) return;

    const m: TeacherMaterial = {
      id: uid(),
      kind: "link",
      title: "Link material",
      sourceLabel: url,
      url,
      createdAt: Date.now(),
      extractedText: "",
    };

    setMaterials((prev) => {
      const next = [m, ...prev];
      if (!next.some((x) => x.isPrimary)) next[0].isPrimary = true;
      return next;
    });
    setActiveId(m.id);
    setLinkUrl("");
  };

  const addText = () => {
    const txt = textPaste.trim();
    if (!txt) return;

    const m: TeacherMaterial = {
      id: uid(),
      kind: "text",
      title: "Pasted text",
      sourceLabel: `${txt.split(/\s+/).slice(0, 6).join(" ")}â€¦`,
      createdAt: Date.now(),
      text: txt,
      extractedText: txt, // for text, extraction = the text itself
    };

    setMaterials((prev) => {
      const next = [m, ...prev];
      if (!next.some((x) => x.isPrimary)) next[0].isPrimary = true;
      return next;
    });
    setActiveId(m.id);
    setTextPaste("");
  };

  const addFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);

    const created: TeacherMaterial[] = list.map((f) => {
      const obj = URL.createObjectURL(f);
      const isImg = f.type?.startsWith("image/");
      return {
        id: uid(),
        kind: isImg ? "image" : "file",
        title: f.name || (isImg ? "Uploaded image" : "Uploaded file"),
        sourceLabel: f.name,
        createdAt: Date.now(),
        fileName: f.name,
        mimeType: f.type,
        sizeBytes: f.size,
        objectUrl: obj,
        extractedText: "",
      };
    });

    setMaterials((prev) => {
      const next = [...created, ...prev];
      if (!next.some((x) => x.isPrimary)) next[0].isPrimary = true;
      return next;
    });
    setActiveId(created[0].id);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateActive = (patch: Partial<TeacherMaterial>) => {
    if (!active) return;
    setMaterials((prev) => prev.map((m) => (m.id === active.id ? { ...m, ...patch } : m)));
  };

  const primary = useMemo(() => materials.find((m) => m.isPrimary) || null, [materials]);

  const headsUpHits = useMemo(() => {
    const blobs = [
      primary?.extractedText || primary?.text || "",
      glossaryRaw,
      vocabRaw,
      contextTagsRaw,
      crossLinksRaw,
    ].join("\n\n");
    return scanHeadsUp(blobs);
  }, [primary, glossaryRaw, vocabRaw, contextTagsRaw, crossLinksRaw]);

  const payload = useMemo<TeacherInputsPayload>(() => {
    const enrichment: Enrichment = {
      contextTags: splitLinesToList(contextTagsRaw),
      crossCurricularLinks: splitLinesToList(crossLinksRaw),
      authenticMaterialTypes: splitLinesToList(authTypesRaw),
      localVocabPreferred: splitLinesToList(vocabRaw),
      glossary: splitLinesToList(glossaryRaw).map((line) => {
        const [term, ...rest] = line.split(":");
        return { term: (term || "").trim(), definition: rest.join(":").trim() };
      }).filter((g) => g.term),
      useLocalContextExactly,
      onlyUseProvidedFacts,
      pilotMode,
    };

    const canonical = primary?.extractedText || primary?.text || "";

    return {
      title: title.trim() || undefined,
      curriculum,
      enrichment,
      materials,
      primaryMaterialId: primary?.id,
      primaryText: canonical || undefined,
    };
  }, [
    title,
    curriculum,
    contextTagsRaw,
    crossLinksRaw,
    authTypesRaw,
    vocabRaw,
    glossaryRaw,
    useLocalContextExactly,
    onlyUseProvidedFacts,
    pilotMode,
    materials,
    primary,
  ]);

  const canGenerate = !!payload.primaryText && !!payload.primaryText.trim();

  const styles = useMemo(() => {
    const card: React.CSSProperties = {
      background: "white",
      border: "1px solid rgba(15,23,42,.12)",
      borderRadius: 18,
      padding: 14,
      boxShadow: "0 6px 20px rgba(2,6,23,.06)",
    };
    const btnBase: React.CSSProperties = {
      cursor: "pointer",
      borderRadius: 12,
      padding: "10px 12px",
      fontWeight: 900,
      fontSize: 13,
      border: "1px solid rgba(15,23,42,.14)",
      background: "#f1f5f9",
    };
    const btnGhost: React.CSSProperties = { ...btnBase, background: "white" };
    const pill: React.CSSProperties = {
      border: "1px solid rgba(15,23,42,.14)",
      borderRadius: 999,
      padding: "6px 10px",
      fontSize: 12,
      fontWeight: 800,
      background: "#f8fafc",
      color: "#334155",
    };
    return { card, btnBase, btnGhost, pill };
  }, []);

  return (
    <div onPasteCapture={onPasteCapture}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 950, fontSize: 18 }}>Teacher Inputs</div>
          <div style={{ color: "#475569", marginTop: 6, fontSize: 13 }}>
            Add a link, paste text, paste a screenshot, or upload files. Choose one Primary material for generation.
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={styles.pill}>Local context is allowed</span>
            <span style={styles.pill}>No invented facts</span>
            <span style={styles.pill}>Primary material drives outputs</span>
          </div>
        </div>

        <div style={{ minWidth: 260 }}>
          <div style={{ fontSize: 12, color: "#475569", fontWeight: 900, marginBottom: 6 }}>Pack title (optional)</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Wildfires & Forests"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,.16)",
              fontWeight: 700,
            }}
          />
        </div>
      </div>

      {/* Heads-up scan (non-blocking) */}
      {headsUpHits.length > 0 && (
        <div style={{ ...styles.card, marginTop: 14, borderColor: "rgba(180,83,9,.35)", background: "#fff7ed" }}>
          <div style={{ fontWeight: 950, marginBottom: 6, color: "#7c2d12" }}>Heads-up review</div>
          <div style={{ color: "#7c2d12", fontSize: 12 }}>
            I spotted a few things that *might* be identifiers (not necessarily a problem â€” just a quick sanity check).
          </div>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#7c2d12", fontSize: 12 }}>
            {headsUpHits.map((h, i) => (
              <li key={i}>
                <b>{h.label}:</b> {h.sample}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        {/* LEFT: Materials */}
        <div style={styles.card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950 }}>Materials</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
              Tip: paste a screenshot anywhere on this page.
            </div>
          </div>

          {/* Add material controls */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <select
              value={addKind}
              onChange={(e) => setAddKind(e.target.value as MaterialKind)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,.16)",
                background: "white",
                fontWeight: 900,
              }}
            >
              <option value="link">Link</option>
              <option value="text">Paste text</option>
              <option value="file">Upload file</option>
              <option value="image">Upload image</option>
            </select>

            {addKind === "link" && (
              <>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste a URLâ€¦"
                  style={{
                    flex: 1,
                    minWidth: 240,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,.16)",
                    fontWeight: 700,
                  }}
                />
                <button type="button" style={styles.btnBase} onClick={addLink}>
                  Add link
                </button>
              </>
            )}

            {addKind === "text" && (
              <button
                type="button"
                style={styles.btnGhost}
                onClick={() => {
                  // focus the textarea below
                  const el = document.getElementById("a10_textpaste");
                  (el as HTMLTextAreaElement | null)?.focus();
                }}
              >
                Jump to text box
              </button>
            )}

            {(addKind === "file" || addKind === "image") && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={addKind === "image" ? "image/*" : undefined}
                  multiple
                  onChange={(e) => addFiles(e.target.files)}
                />
              </>
            )}
          </div>

          {addKind === "text" && (
            <div style={{ marginTop: 10 }}>
              <textarea
                id="a10_textpaste"
                value={textPaste}
                onChange={(e) => setTextPaste(e.target.value)}
                placeholder="Paste your text here (or type)â€¦"
                style={{
                  width: "100%",
                  minHeight: 120,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.16)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button type="button" style={styles.btnBase} onClick={addText}>
                  Add text
                </button>
                <div style={{ fontSize: 12, color: "#64748b", alignSelf: "center" }}>
                  This becomes extracted text automatically.
                </div>
              </div>
            </div>
          )}

          {/* Materials list */}
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {materials.length === 0 && (
              <div style={{ color: "#64748b", fontSize: 13, padding: 10, border: "1px dashed rgba(15,23,42,.18)", borderRadius: 14 }}>
                No materials yet. Add a link, paste text, paste a screenshot, or upload a file.
              </div>
            )}

            {materials.map((m) => (
              <div
                key={m.id}
                onClick={() => setActiveId(m.id)}
                style={{
                  border: m.id === activeId ? "2px solid rgba(45,125,79,.6)" : "1px solid rgba(15,23,42,.12)",
                  borderRadius: 14,
                  padding: 12,
                  background: m.id === activeId ? "#f0fdf4" : "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950 }}>
                      {m.title}{" "}
                      {m.isPrimary && (
                        <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 950, color: "#166534" }}>
                          Primary
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.kind.toUpperCase()} â€¢ {m.sourceLabel || m.fileName || "â€”"} {m.sizeBytes ? `â€¢ ${humanSize(m.sizeBytes)}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      style={{ ...styles.btnGhost, padding: "8px 10px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrimary(m.id);
                      }}
                    >
                      Set primary
                    </button>
                    <button
                      type="button"
                      style={{ ...styles.btnGhost, padding: "8px 10px", background: "#fee2e2", borderColor: "rgba(220,38,38,.25)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMaterial(m.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {m.objectUrl && m.kind === "image" && (
                  <div style={{ marginTop: 10 }}>
                    <img
                      src={m.objectUrl}
                      alt={m.title}
                      style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 12, border: "1px solid rgba(15,23,42,.10)" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Review + curriculum + enrichment */}
        <div style={{ display: "grid", gap: 12 }}>
          <div style={styles.card}>
            <div style={{ fontWeight: 950 }}>Primary text (editable)</div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 6 }}>
              The generator uses this text. For links/files/images, paste or edit extracted text here.
            </div>

            <div style={{ marginTop: 10 }}>
              <textarea
                value={primary?.extractedText || primary?.text || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  // write back into the primary material
                  if (!primary) return;
                  setMaterials((prev) => prev.map((m) => (m.id === primary.id ? { ...m, extractedText: val } : m)));
                }}
                placeholder="Paste / edit the text the class will work fromâ€¦"
                style={{
                  width: "100%",
                  minHeight: 180,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,.16)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: 12,
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  style={{ ...styles.btnBase, opacity: canGenerate ? 1 : 0.5, cursor: canGenerate ? "pointer" : "not-allowed" }}
                  disabled={!canGenerate}
                  onClick={() => onGenerate?.(payload)}
                >
                  Generate from inputs
                </button>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {canGenerate ? "Ready." : "Add a Primary material and make sure the text box isnâ€™t empty."}
                </div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ fontWeight: 950 }}>Curriculum target</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Class
                <input
                  type="number"
                  value={curriculum.classLevel ?? 5}
                  min={1}
                  max={6}
                  onChange={(e) => setCurriculum((c) => ({ ...c, classLevel: Number(e.target.value) }))}
                  style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Stage
                <input
                  type="number"
                  value={curriculum.stage ?? 4}
                  min={1}
                  max={4}
                  onChange={(e) => setCurriculum((c) => ({ ...c, stage: Number(e.target.value) }))}
                  style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Purpose
                <input
                  value={curriculum.purpose ?? ""}
                  onChange={(e) => setCurriculum((c) => ({ ...c, purpose: e.target.value }))}
                  style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Genre / Form
                <input
                  value={`${curriculum.genre ?? ""}${curriculum.form ? ` â€¢ ${curriculum.form}` : ""}`.trim()}
                  onChange={(e) => {
                    const v = e.target.value;
                    const parts = v.split("â€¢").map((x) => x.trim());
                    setCurriculum((c) => ({ ...c, genre: parts[0] || c.genre, form: parts[1] || c.form }));
                  }}
                  style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#475569", marginTop: 10 }}>
              Outcome / Notes (optional)
              <input
                value={curriculum.outcome ?? ""}
                onChange={(e) => setCurriculum((c) => ({ ...c, outcome: e.target.value }))}
                style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
              />
            </label>
          </div>

          <div style={styles.card}>
            <div style={{ fontWeight: 950 }}>Enrichment + guardrails</div>

            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: "#334155", fontWeight: 900 }}>
                <input type="checkbox" checked={pilotMode} onChange={(e) => setPilotMode(e.target.checked)} />
                Pilot mode (warn about copyright / internal use)
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: "#334155", fontWeight: 900 }}>
                <input type="checkbox" checked={useLocalContextExactly} onChange={(e) => setUseLocalContextExactly(e.target.checked)} />
                Use local context exactly as entered
              </label>

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, color: "#334155", fontWeight: 900 }}>
                <input type="checkbox" checked={onlyUseProvidedFacts} onChange={(e) => setOnlyUseProvidedFacts(e.target.checked)} />
                Only use provided facts (donâ€™t invent local details)
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Context tags (comma or new line)
                <textarea
                  value={contextTagsRaw}
                  onChange={(e) => setContextTagsRaw(e.target.value)}
                  placeholder="e.g. local history, health promotion, GAA, environmentâ€¦"
                  style={{ width: "100%", marginTop: 6, minHeight: 70, padding: 10, borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Cross-curricular links (comma or new line)
                <textarea
                  value={crossLinksRaw}
                  onChange={(e) => setCrossLinksRaw(e.target.value)}
                  placeholder="e.g. Geography, SPHE, Scienceâ€¦"
                  style={{ width: "100%", marginTop: 6, minHeight: 70, padding: 10, borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Authentic material type(s)
                <textarea
                  value={authTypesRaw}
                  onChange={(e) => setAuthTypesRaw(e.target.value)}
                  placeholder="e.g. poster, leaflet, article, announcement, timetableâ€¦"
                  style={{ width: "100%", marginTop: 6, minHeight: 70, padding: 10, borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Preferred local vocabulary (comma or new line)
                <textarea
                  value={vocabRaw}
                  onChange={(e) => setVocabRaw(e.target.value)}
                  placeholder="e.g. (local place names), key terms, Irish wordsâ€¦"
                  style={{ width: "100%", marginTop: 6, minHeight: 70, padding: 10, borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#475569" }}>
                Glossary (one per line: term: definition)
                <textarea
                  value={glossaryRaw}
                  onChange={(e) => setGlossaryRaw(e.target.value)}
                  placeholder="e.g. ember: a small piece of burning woodâ€¦"
                  style={{ width: "100%", marginTop: 6, minHeight: 90, padding: 10, borderRadius: 12, border: "1px solid rgba(15,23,42,.16)" }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Debug payload (optional but handy) */}
      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontWeight: 900, color: "#334155" }}>Debug: payload preview</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#0f172a", background: "#f8fafc", padding: 12, borderRadius: 12, border: "1px solid rgba(15,23,42,.12)", marginTop: 10 }}>
          {JSON.stringify(payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}

