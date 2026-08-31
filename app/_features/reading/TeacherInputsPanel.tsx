"use client";

import React, { useMemo, useRef, useState } from "react";

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

  purpose?: string;
  genre?: string;
  form?: string;

  strand?: string;
  element?: string;
  outcome?: string;
  focusDetail?: string;
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
  busy?: boolean;
};

function uid() {
  // crypto.randomUUID is great, but fallback keeps us safe.
  return globalThis.crypto?.randomUUID?.() || `m_${Math.random().toString(16).slice(2)}_${Date.now()}`;
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

  // Gentle "proper noun clusters" (not perfect, just a nudge)
  const proper = t.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g);
  if (proper?.length) hits.push({ label: "Potential names/places detected", sample: proper.slice(0, 2).join(", ") });

  return hits;
}

export default function TeacherInputsPanel({ onGenerate, busy = false }: Props) {
  const [title, setTitle] = useState<string>("");

  const [materials, setMaterials] = useState<TeacherMaterial[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  // Add material inputs
  const [addKind, setAddKind] = useState<MaterialKind>("text");
  const [linkUrl, setLinkUrl] = useState("");
  const [textPaste, setTextPaste] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Curriculum
  const [curriculum, setCurriculum] = useState<CurriculumTarget>({
    purpose: "Read to learn",
    genre: "Informational",
    form: "Article",
    strand: "Reading",
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

  const active = useMemo(
    () => materials.find((m) => m.id === activeId) || materials[0] || null,
    [materials, activeId]
  );

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
      sourceLabel: `${txt.split(/\s+/).slice(0, 6).join(" ")}...`,
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
      borderRadius: 20,
      padding: 18,
      boxShadow: "0 8px 28px rgba(15,23,42,.06)",
    };
    const input: React.CSSProperties = {
      width: "100%",
      padding: "11px 12px",
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,.16)",
      background: "white",
      color: "#0f172a",
      fontWeight: 700,
    };
    const textarea: React.CSSProperties = {
      ...input,
      resize: "vertical",
      fontFamily: "inherit",
      lineHeight: 1.5,
    };
    const btnBase: React.CSSProperties = {
      cursor: "pointer",
      borderRadius: 12,
      padding: "10px 13px",
      fontWeight: 900,
      fontSize: 13,
      border: "1px solid rgba(15,23,42,.14)",
      background: "#f8fafc",
      color: "#0f172a",
    };
    const label: React.CSSProperties = {
      display: "block",
      fontSize: 12,
      fontWeight: 900,
      color: "#475569",
    };
    return { card, input, textarea, btnBase, label };
  }, []);

  const purposeOptions = [
    "Read to learn",
    "Practise comprehension",
    "Build vocabulary",
    "Focus on grammar",
    "Discuss ideas",
    "Exam-style reading",
  ];

  const focusOptions: Record<string, string[]> = {
    "Read to learn": ["Main ideas", "Key details", "Summarise", "Sequence information"],
    "Practise comprehension": ["Gist", "Detailed understanding", "Inference", "Reference words", "Sequencing"],
    "Build vocabulary": ["Topic vocabulary", "Collocations", "Phrasal verbs", "Word families", "Useful expressions", "Teacher's own words"],
    "Focus on grammar": ["Past simple", "Present perfect", "Future forms", "Conditionals", "Articles", "Prepositions", "Teacher chooses"],
    "Discuss ideas": ["Personal response", "Agree / disagree", "Compare viewpoints", "Problem-solving", "Short discussion"],
    "Exam-style reading": ["Multiple choice", "True / false", "Matching", "Gapped text", "Short answers", "Mixed practice"],
  };

  const selectedPurpose = curriculum.purpose || "Read to learn";
  const selectedFocusOptions = focusOptions[selectedPurpose] || [];

  return (
    <div onPasteCapture={onPasteCapture} style={{ display: "grid", gap: 16 }}>
      <section style={styles.card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#166534", fontSize: 12, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" }}>
              Step 2
            </div>
            <div style={{ fontWeight: 1000, fontSize: 22, color: "#0f172a", marginTop: 4 }}>Add your source</div>
            <div style={{ color: "#64748b", marginTop: 6, fontSize: 13, maxWidth: 680 }}>
              Paste text, add a link, upload a file, or paste a screenshot. The text shown below is what the generator will use.
            </div>
          </div>
          {primary && (
            <div style={{ borderRadius: 999, background: "#ecfdf5", color: "#166534", padding: "7px 11px", fontSize: 12, fontWeight: 900 }}>
              Source ready
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          {([
            ["text", "Paste text"],
            ["link", "Link"],
            ["file", "Upload file"],
            ["image", "Image / screenshot"],
          ] as const).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => setAddKind(kind)}
              aria-pressed={addKind === kind}
              style={{
                ...styles.btnBase,
                borderRadius: 999,
                background: addKind === kind ? "#0f172a" : "white",
                color: addKind === kind ? "white" : "#0f172a",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {addKind === "text" && (
          <div style={{ marginTop: 14 }}>
            <textarea
              id="a10_textpaste"
              value={textPaste}
              onChange={(e) => setTextPaste(e.target.value)}
              placeholder="Paste the source text here..."
              style={{ ...styles.textarea, minHeight: 150 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button type="button" style={styles.btnBase} onClick={addText} disabled={!textPaste.trim()}>
                Use this text
              </button>
            </div>
          </div>
        )}

        {addKind === "link" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 8, marginTop: 14 }}>
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Paste a URL..." style={styles.input} />
            <button type="button" style={styles.btnBase} onClick={addLink} disabled={!linkUrl.trim()}>
              Add link
            </button>
          </div>
        )}

        {(addKind === "file" || addKind === "image") && (
          <div style={{ marginTop: 14, padding: 14, border: "1px dashed rgba(15,23,42,.20)", borderRadius: 14, background: "#f8fafc" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept={addKind === "image" ? "image/*" : undefined}
              multiple
              onChange={(e) => addFiles(e.target.files)}
            />
            {addKind === "image" && (
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
                You can also paste screenshots directly anywhere on this page.
              </div>
            )}
          </div>
        )}

        {materials.length > 0 && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 900, color: "#334155" }}>
              Added sources ({materials.length}){primary ? ` - Primary: ${primary.title}` : ""}
            </summary>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {materials.map((m) => (
                <div
                  key={m.id}
                  onClick={() => setActiveId(m.id)}
                  style={{
                    border: m.id === active?.id ? "2px solid rgba(22,101,52,.35)" : "1px solid rgba(15,23,42,.10)",
                    borderRadius: 14,
                    padding: 10,
                    background: m.isPrimary ? "#f0fdf4" : "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>
                        {m.title}{m.isPrimary ? <span style={{ color: "#166534", marginLeft: 8, fontSize: 12 }}>Primary</span> : null}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 620 }}>
                        {m.kind.toUpperCase()} - {m.sourceLabel || m.fileName || "source"}{m.sizeBytes ? ` - ${humanSize(m.sizeBytes)}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!m.isPrimary && (
                        <button
                          type="button"
                          style={{ ...styles.btnBase, padding: "7px 9px", background: "white" }}
                          onClick={(e) => { e.stopPropagation(); setPrimary(m.id); }}
                        >
                          Use as primary
                        </button>
                      )}
                      <button
                        type="button"
                        style={{ ...styles.btnBase, padding: "7px 9px", background: "#fff1f2", color: "#9f1239" }}
                        onClick={(e) => { e.stopPropagation(); removeMaterial(m.id); }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {m.objectUrl && m.kind === "image" && (
                    <div style={{ marginTop: 8 }}>
                      {/* Local object URLs are browser-only previews; Next image optimisation is not useful here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.objectUrl} alt={m.title} style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 10 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(15,23,42,.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 950, color: "#0f172a" }}>Text used for generation</div>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                Review or edit this before generating. For links, files and screenshots, make sure the usable text appears here.
              </div>
            </div>
            <div style={{ color: canGenerate ? "#166534" : "#94a3b8", fontSize: 12, fontWeight: 900 }}>
              {canGenerate ? "Ready" : "Source text required"}
            </div>
          </div>
          <textarea
            value={primary?.extractedText || primary?.text || ""}
            onChange={(e) => {
              const val = e.target.value;
              if (!primary) return;
              setMaterials((prev) => prev.map((m) => (m.id === primary.id ? { ...m, extractedText: val } : m)));
            }}
            placeholder="The source text will appear here..."
            style={{ ...styles.textarea, minHeight: 190, marginTop: 10 }}
          />
        </div>
      </section>

      {headsUpHits.length > 0 && (
        <div style={{ border: "1px solid rgba(180,83,9,.25)", background: "#fff7ed", borderRadius: 16, padding: 12 }}>
          <div style={{ fontWeight: 900, color: "#9a3412", fontSize: 13 }}>Quick privacy check</div>
          <div style={{ color: "#9a3412", fontSize: 12, marginTop: 4 }}>
            The source may contain personal details. Review them before generating if needed.
          </div>
        </div>
      )}

      <section style={styles.card}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div style={{ color: "#166534", fontSize: 12, fontWeight: 950, letterSpacing: ".08em", textTransform: "uppercase" }}>Step 3</div>
          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 850 }}>Reading target</div>
        </div>
        <div style={{ fontWeight: 1000, fontSize: 20, color: "#0f172a", marginTop: 4 }}>What do you want to work on?</div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 5 }}>
          Choose the main teaching focus. This changes the emphasis of the activities Aontas creates; it does not change the CEFR level.
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          {purposeOptions.map((option) => {
            const activePurpose = selectedPurpose === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setCurriculum((c) => ({ ...c, purpose: option, focusDetail: "" }))}
                aria-pressed={activePurpose}
                style={{
                  ...styles.btnBase,
                  borderRadius: 999,
                  background: activePurpose ? "#0f172a" : "white",
                  color: activePurpose ? "white" : "#0f172a",
                }}
              >
                {option}
              </button>
            );
          })}
        </div>

        {selectedFocusOptions.length > 0 && (
          <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#f8fafc", border: "1px solid rgba(15,23,42,.08)" }}>
            <div style={{ fontWeight: 950, color: "#334155", fontSize: 13 }}>Make it more specific <span style={{ color: "#94a3b8", fontWeight: 800 }}>(optional)</span></div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
              {selectedFocusOptions.map((option) => {
                const activeFocus = curriculum.focusDetail === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCurriculum((c) => ({ ...c, focusDetail: c.focusDetail === option ? "" : option }))}
                    aria-pressed={activeFocus}
                    style={{
                      ...styles.btnBase,
                      padding: "8px 11px",
                      borderRadius: 999,
                      background: activeFocus ? "#dcfce7" : "white",
                      borderColor: activeFocus ? "#86efac" : "rgba(15,23,42,.14)",
                      color: activeFocus ? "#166534" : "#334155",
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label style={{ ...styles.label, marginTop: 14 }}>
          Anything specific? (optional)
          <input
            value={curriculum.outcome ?? ""}
            onChange={(e) => setCurriculum((c) => ({ ...c, outcome: e.target.value }))}
            placeholder="e.g. include travel vocabulary; practise past simple; prepare for a short discussion..."
            style={{ ...styles.input, marginTop: 6 }}
          />
        </label>
      </section>

      <details style={{ ...styles.card, padding: 0, overflow: "hidden" }}>
        <summary style={{ cursor: "pointer", padding: 18, fontWeight: 950, color: "#334155", listStylePosition: "inside" }}>
          Optional guidance and advanced settings
        </summary>
        <div style={{ borderTop: "1px solid rgba(15,23,42,.08)", padding: 18, display: "grid", gap: 14 }}>
          <label style={styles.label}>
            Pack title (optional)
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Working from home" style={{ ...styles.input, marginTop: 6 }} />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12, color: "#334155", fontWeight: 800 }}>
              <input type="checkbox" checked={onlyUseProvidedFacts} onChange={(e) => setOnlyUseProvidedFacts(e.target.checked)} />
              Do not invent facts that are not in the source
            </label>
            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12, color: "#334155", fontWeight: 800 }}>
              <input type="checkbox" checked={useLocalContextExactly} onChange={(e) => setUseLocalContextExactly(e.target.checked)} />
              Keep any local context exactly as entered
            </label>
            <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12, color: "#334155", fontWeight: 800 }}>
              <input type="checkbox" checked={pilotMode} onChange={(e) => setPilotMode(e.target.checked)} />
              Respect source and copyright limits
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            <label style={styles.label}>
              Key vocabulary to include (optional)
              <textarea value={vocabRaw} onChange={(e) => setVocabRaw(e.target.value)} placeholder="e.g. deadline, schedule, flexible" style={{ ...styles.textarea, minHeight: 82, marginTop: 6 }} />
            </label>
            <label style={styles.label}>
              Glossary (optional)
              <textarea value={glossaryRaw} onChange={(e) => setGlossaryRaw(e.target.value)} placeholder="one per line: term: definition" style={{ ...styles.textarea, minHeight: 82, marginTop: 6 }} />
            </label>
            <label style={styles.label}>
              Context or topic tags (optional)
              <textarea value={contextTagsRaw} onChange={(e) => setContextTagsRaw(e.target.value)} placeholder="e.g. workplace English, travel, technology" style={{ ...styles.textarea, minHeight: 82, marginTop: 6 }} />
            </label>
            <label style={styles.label}>
              Related topics (optional)
              <textarea value={crossLinksRaw} onChange={(e) => setCrossLinksRaw(e.target.value)} placeholder="e.g. customer service, health, environment" style={{ ...styles.textarea, minHeight: 82, marginTop: 6 }} />
            </label>
            <label style={styles.label}>
              Source description (optional)
              <textarea value={authTypesRaw} onChange={(e) => setAuthTypesRaw(e.target.value)} placeholder="e.g. news article, workplace notice, email" style={{ ...styles.textarea, minHeight: 82, marginTop: 6 }} />
            </label>
          </div>
        </div>
      </details>

      <section
        style={{
          ...styles.card,
          borderColor: canGenerate ? "rgba(22,101,52,.22)" : "rgba(15,23,42,.10)",
          background: canGenerate ? "linear-gradient(135deg,#f0fdf4,#ffffff)" : "#f8fafc",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 1000, fontSize: 18, color: "#0f172a" }}>{canGenerate ? "Ready to generate" : "Add a source to continue"}</div>
            <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
              Creates a Standard and Supported reading plus aligned exercises.
            </div>
          </div>
          <button
            type="button"
            disabled={!canGenerate || busy}
            onClick={() => onGenerate?.(payload)}
            style={{
              border: 0,
              borderRadius: 14,
              padding: "13px 20px",
              fontSize: 14,
              fontWeight: 1000,
              cursor: canGenerate && !busy ? "pointer" : "not-allowed",
              background: canGenerate && !busy ? "#166534" : "#94a3b8",
              color: "white",
              minWidth: 210,
            }}
          >
            {busy ? "Generating..." : "Generate reading pack"}
          </button>
        </div>
      </section>
    </div>
  );
}
