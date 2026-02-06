"use client";

/**
 * Social Thread HTML Export (offline-friendly)
 * - Defaults to 1 comment visible
 * - Highlights the current comment
 * - Next scrolls to fully show the comment (accounts for bottom dock)
 * - Karaoke mode (word highlight while TTS plays; best-effort depending on browser voice support)
 * - Mystery words (click-to-reveal)
 *
 * This file is intentionally self-contained and typed loosely to avoid build breakage.
 */

export type ExportHtmlOptions = {
  defaultLens?: string;                 // "builder" | "debate" etc (future)
  defaultAutoVoices?: boolean;
  defaultSpeakEmojis?: boolean;
  defaultShowEmojis?: boolean;
  defaultPace?: "all" | "step" | string;
  initialVisibleCount?: number;         // default 1
  defaultKaraoke?: boolean;             // default false
  defaultMysteryWordsPerMsg?: number;   // default 0
};

export type ExportOpts = {
  pack: any;
  filename?: string;

  // Kept for compatibility with existing calls in ReadingPackApp
  precomputeUnpacks?: boolean;
  precomputeLens?: string;
  precomputeLimitPerVariant?: number;

  htmlOptions?: ExportHtmlOptions;

  // forward compatible
  [key: string]: any;
};

function safeFileBase(s: string) {
  return String(s || "social-thread")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "social-thread";
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function pickVariantPack(pack: any, variant: string) {
  // Try a bunch of likely shapes, then fallback
  return (
    pack?.variants?.[variant] ||
    pack?.[variant] ||
    pack?.variantPacks?.[variant] ||
    pack
  );
}

function getMessages(variantPack: any): any[] {
  return (
    variantPack?.messages ||
    variantPack?.thread ||
    variantPack?.chat ||
    variantPack?.items ||
    []
  );
}

function getConcepts(pack: any): any[] {
  return pack?.concepts || pack?.vocab || pack?.glossary || [];
}

export async function exportSocialThreadHtml(opts: ExportOpts): Promise<void> {
  const pack = opts?.pack ?? {};
  const title =
    pack?.title ||
    pack?.topic ||
    pack?.unitTitle ||
    pack?.meta?.title ||
    "Social Thread";

  const htmlOptions: ExportHtmlOptions = {
    defaultLens: opts?.htmlOptions?.defaultLens ?? "builder",
    defaultAutoVoices: opts?.htmlOptions?.defaultAutoVoices ?? true,
    defaultSpeakEmojis: opts?.htmlOptions?.defaultSpeakEmojis ?? false,
    defaultShowEmojis: opts?.htmlOptions?.defaultShowEmojis ?? true,
    defaultPace: opts?.htmlOptions?.defaultPace ?? "step",
    initialVisibleCount: Math.max(1, Number(opts?.htmlOptions?.initialVisibleCount ?? 1)),
    defaultKaraoke: !!opts?.htmlOptions?.defaultKaraoke,
    defaultMysteryWordsPerMsg: Math.max(0, Number(opts?.htmlOptions?.defaultMysteryWordsPerMsg ?? 0)),
  };

  const packJson = JSON.stringify(pack);

  const fileBase = safeFileBase(opts?.filename || title);
  const filename = `${fileBase}.html`;

  // No nested template-literals inside this HTML string (avoids accidental ${} collisions)
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)} - Social Thread</title>
<style>
  :root{
    --bg:#f5f7fb;
    --card:#ffffff;
    --ink:#0f172a;
    --muted:#475569;
    --line:#e2e8f0;
    --chip:#eef2ff;
    --chipInk:#1e293b;
    --accent:#2563eb;
    --accent2:#7c3aed;
    --shadow: 0 12px 40px rgba(15,23,42,.10);
    --dockH: 92px;
    --radius: 18px;
  }
  *{ box-sizing:border-box; }
  body{
    margin:0;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    background: var(--bg);
    color: var(--ink);
  }
  .wrap{
    max-width: 1200px;
    margin: 20px auto calc(var(--dockH) + 28px);
    padding: 0 16px;
  }
  header{
    display:flex; align-items:flex-end; justify-content:space-between;
    gap:16px; margin: 8px 0 16px;
  }
  h1{ font-size: 20px; margin:0; letter-spacing: .2px; }
  .sub{ color: var(--muted); font-size: 13px; }
  .grid{
    display:grid;
    grid-template-columns: 1.2fr .8fr;
    gap: 14px;
  }
  @media (max-width: 980px){
    .grid{ grid-template-columns: 1fr; }
  }
  .panel{
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow:hidden;
  }
  .panelHead{
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
    display:flex; align-items:center; justify-content:space-between; gap:10px;
  }
  .panelTitle{ font-weight: 700; font-size: 14px; }
  .list{ padding: 12px; }
  .msg{
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 12px 12px 10px;
    background: #fff;
    margin-bottom: 10px;
    scroll-margin-bottom: calc(var(--dockH) + 18px);
    position: relative;
    transition: transform .12s ease, border-color .12s ease, box-shadow .12s ease;
  }
  .msg:hover{ transform: translateY(-1px); }
  .msg.active{
    border-color: rgba(37,99,235,.55);
    box-shadow: 0 10px 28px rgba(37,99,235,.12);
    outline: 3px solid rgba(37,99,235,.12);
  }
  .row{
    display:flex; align-items:flex-start; gap:10px;
  }
  .avatar{
    width: 34px; height:34px;
    border-radius: 12px;
    display:flex; align-items:center; justify-content:center;
    font-weight: 800;
    background: var(--chip);
    color: var(--chipInk);
    flex: 0 0 auto;
  }
  .meta{
    display:flex; align-items:center; justify-content:space-between;
    gap:10px;
  }
  .name{ font-weight: 800; font-size: 14px; }
  .idx{ color: var(--muted); font-size: 12px; }
  .text{
    margin-top: 6px;
    color: var(--ink);
    line-height: 1.45;
    font-size: 15px;
    word-break: break-word;
  }
  .btnRow{
    display:flex; gap:8px; flex-wrap: wrap;
    margin-top: 10px;
  }
  .btn{
    border: 1px solid var(--line);
    background: #fff;
    border-radius: 999px;
    padding: 7px 11px;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
  }
  .btn.primary{
    background: rgba(37,99,235,.08);
    border-color: rgba(37,99,235,.25);
  }
  .pill{
    border: 1px solid var(--line);
    background: #f8fafc;
    border-radius: 999px;
    padding: 7px 10px;
    font-size: 12px;
    color: var(--muted);
  }
  .concept{
    border-top: 1px solid var(--line);
    padding: 12px 14px;
  }
  .concept:first-child{ border-top:none; }
  .term{ font-weight: 900; font-size: 14px; margin-bottom: 4px; }
  .def{ color: var(--muted); font-size: 13px; line-height: 1.4; }
  .ex{ margin-top: 6px; font-size: 12px; color: #334155; }
  .dock{
    position: fixed;
    left: 0; right: 0; bottom: 0;
    background: rgba(245,247,251,.92);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--line);
    padding: 10px 12px;
    z-index: 9999;
  }
  .dockInner{
    max-width: 1200px;
    margin: 0 auto;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .controls{
    display:flex;
    gap: 10px;
    align-items:center;
    flex-wrap: wrap;
  }
  label{ font-size: 12px; color: var(--muted); font-weight: 700; display:flex; gap:6px; align-items:center; }
  select, input[type="checkbox"]{
    cursor:pointer;
  }
  select{
    border:1px solid var(--line);
    border-radius: 10px;
    padding: 6px 8px;
    background: #fff;
    font-weight: 700;
    font-size: 12px;
  }
  .dockBtn{
    border:1px solid var(--line);
    background:#fff;
    border-radius: 12px;
    padding: 8px 10px;
    font-weight: 900;
    font-size: 12px;
    cursor:pointer;
  }
  .dockBtn.primary{
    background: rgba(124,58,237,.10);
    border-color: rgba(124,58,237,.30);
  }
  .dockBtn:disabled{ opacity:.45; cursor:not-allowed; }

  /* Karaoke + mystery words */
  .w{ padding:0 1px; border-radius: 6px; }
  .w.on{ background: rgba(124,58,237,.18); }
  .mw{
    padding: 0 3px;
    border-radius: 8px;
    background: rgba(37,99,235,.10);
    border: 1px dashed rgba(37,99,235,.35);
    cursor: pointer;
    user-select: none;
  }
  .mw.revealed{
    background: transparent;
    border: 1px solid transparent;
    cursor: default;
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">Offline Social Thread export • pace, speak, karaoke, mystery words</div>
    </div>
    <div class="sub" id="status"></div>
  </header>

  <div class="grid">
    <div class="panel">
      <div class="panelHead">
        <div class="panelTitle">Thread</div>
        <div class="sub" id="threadMeta"></div>
      </div>
      <div class="list" id="thread"></div>
    </div>

    <div class="panel">
      <div class="panelHead">
        <div class="panelTitle">Concepts & Notes</div>
        <div class="sub" id="conceptMeta"></div>
      </div>
      <div id="concepts"></div>
    </div>
  </div>
</div>

<div class="dock" id="dock">
  <div class="dockInner">
    <div class="controls">
      <label>Variant:
        <select id="variantSel">
          <option value="standard">Standard</option>
          <option value="adapted">Adapted</option>
        </select>
      </label>

      <label>Pace:
        <select id="paceSel">
          <option value="step">Step</option>
          <option value="all">All</option>
        </select>
      </label>

      <button class="dockBtn primary" id="btnNext">Next</button>
      <button class="dockBtn" id="btnAll">Show all</button>

      <label><input type="checkbox" id="chkTeacher"/> Teacher mode</label>
      <label><input type="checkbox" id="chkEmojis"/> Show emojis</label>
      <label><input type="checkbox" id="chkSpeakEmojis"/> Speak emojis</label>

      <label><input type="checkbox" id="chkKaraoke"/> Karaoke</label>

      <label>Mystery:
        <select id="mysterySel">
          <option value="0">Off</option>
          <option value="2">2 words</option>
          <option value="4">4 words</option>
          <option value="6">6 words</option>
        </select>
      </label>
    </div>

    <div class="controls">
      <label>Voice:
        <select id="voiceSel"></select>
      </label>
      <button class="dockBtn" id="btnStop">Stop</button>
    </div>
  </div>
</div>

<script id="__PACK__" type="application/json">${escapeHtml(packJson)}</script>

<script>
(function(){
  const pack = JSON.parse(document.getElementById("__PACK__").textContent || "{}");

  const opt = ${escapeHtml(JSON.stringify(htmlOptions))};

  const els = {
    thread: document.getElementById("thread"),
    concepts: document.getElementById("concepts"),
    status: document.getElementById("status"),
    threadMeta: document.getElementById("threadMeta"),
    conceptMeta: document.getElementById("conceptMeta"),
    dock: document.getElementById("dock"),
    variantSel: document.getElementById("variantSel"),
    paceSel: document.getElementById("paceSel"),
    btnNext: document.getElementById("btnNext"),
    btnAll: document.getElementById("btnAll"),
    chkTeacher: document.getElementById("chkTeacher"),
    chkEmojis: document.getElementById("chkEmojis"),
    chkSpeakEmojis: document.getElementById("chkSpeakEmojis"),
    chkKaraoke: document.getElementById("chkKaraoke"),
    mysterySel: document.getElementById("mysterySel"),
    voiceSel: document.getElementById("voiceSel"),
    btnStop: document.getElementById("btnStop"),
  };

  // Defaults
  els.variantSel.value = "standard";
  els.paceSel.value = opt.defaultPace || "step";
  els.chkEmojis.checked = !!opt.defaultShowEmojis;
  els.chkSpeakEmojis.checked = !!opt.defaultSpeakEmojis;
  els.chkKaraoke.checked = !!opt.defaultKaraoke;
  els.mysterySel.value = String(opt.defaultMysteryWordsPerMsg || 0);

  let visibleCount = Math.max(1, Number(opt.initialVisibleCount || 1));
  let activeIdx = 0;

  // ---- Speech ----
  let voices = [];
  let currentUtt = null;

  function loadVoices(){
    voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    els.voiceSel.innerHTML = "";
    voices.forEach((v, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = v.name + " (" + v.lang + ")";
      els.voiceSel.appendChild(o);
    });
    // pick an English voice if possible
    const idx = voices.findIndex(v => /en/i.test(v.lang));
    if (idx >= 0) els.voiceSel.value = String(idx);
  }
  if (window.speechSynthesis){
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function stopSpeak(){
    try{
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }catch(e){}
    currentUtt = null;
    clearKaraoke();
  }

  function stripEmojisForSpeech(s){
    // crude but effective: remove most emoji blocks
    return String(s || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
  }

  function speakMessage(text, msgEl){
    stopSpeak();
    if (!window.speechSynthesis) return;

    const speakEmojis = !!els.chkSpeakEmojis.checked;
    const karaoke = !!els.chkKaraoke.checked;

    const spoken = speakEmojis ? String(text||"") : stripEmojisForSpeech(text||"");
    const utt = new SpeechSynthesisUtterance(spoken);

    const vIdx = parseInt(els.voiceSel.value || "0", 10);
    if (voices[vIdx]) utt.voice = voices[vIdx];
    utt.rate = 0.95;
    utt.pitch = 1.0;

    if (karaoke && msgEl){
      prepareKaraoke(msgEl, spoken);
      utt.onboundary = function(ev){
        if (ev && typeof ev.charIndex === "number"){
          karaokeAtChar(msgEl, ev.charIndex);
        }
      };
      utt.onend = function(){ clearKaraoke(); };
      utt.onerror = function(){ clearKaraoke(); };
    }

    currentUtt = utt;
    window.speechSynthesis.speak(utt);
  }

  // ---- Karaoke ----
  function clearKaraoke(){
    document.querySelectorAll(".w.on").forEach(el => el.classList.remove("on"));
  }

  function prepareKaraoke(msgEl, spokenText){
    // rebuild msg text into word spans with char offsets
    const textEl = msgEl.querySelector(".text");
    if (!textEl) return;

    const raw = textEl.getAttribute("data-raw") || "";
    // Use spokenText for offsets (emojis stripped if needed), but display raw (with emojis possibly)
    // We'll generate spans from spokenText to keep boundary indices consistent.
    const src = spokenText;

    const words = [];
    let i = 0;
    while (i < src.length){
      // keep whitespace as plain text nodes
      if (/\\s/.test(src[i])){
        words.push({ t: src[i], start: i, isWord: false });
        i++;
        continue;
      }
      // word token: letters/numbers/apostrophes
      const m = src.slice(i).match(/^[\\p{L}\\p{M}\\p{N}']+/u);
      if (m){
        const w = m[0];
        words.push({ t: w, start: i, isWord: true });
        i += w.length;
        continue;
      }
      // punctuation
      words.push({ t: src[i], start: i, isWord: false });
      i++;
    }

    // render
    textEl.innerHTML = "";
    for (const w of words){
      if (!w.isWord){
        textEl.appendChild(document.createTextNode(w.t));
      }else{
        const sp = document.createElement("span");
        sp.className = "w";
        sp.textContent = w.t;
        sp.setAttribute("data-start", String(w.start));
        textEl.appendChild(sp);
      }
    }

    // restore raw for later rerender on toggle/mystery changes
    textEl.setAttribute("data-karaoke", "1");
  }

  function karaokeAtChar(msgEl, charIndex){
    const spans = msgEl.querySelectorAll(".w");
    let best = null;
    for (let i=0;i<spans.length;i++){
      const s = spans[i];
      const st = parseInt(s.getAttribute("data-start") || "0", 10);
      if (st <= charIndex) best = s;
      else break;
    }
    if (!best) return;
    spans.forEach(x => x.classList.remove("on"));
    best.classList.add("on");
  }

  // ---- Mystery words ----
  function seededRand(seed){
    // tiny deterministic PRNG
    let x = seed >>> 0;
    return function(){
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function applyMysteryToText(rawText, msgIndex, count){
    if (!count || count <= 0) return { html: escapeHtml(rawText), did: false };

    // pick candidate words (len>=5)
    const words = [];
    const re = /[\\p{L}\\p{M}\\p{N}']+/gu;
    let m;
    while ((m = re.exec(rawText)) !== null){
      const w = m[0];
      if (w.length >= 5) words.push({ w, i: m.index, len: w.length });
    }
    if (words.length === 0) return { html: escapeHtml(rawText), did: false };

    const r = seededRand((msgIndex+1) * 1337 + rawText.length * 17);
    // select unique indices
    const chosen = new Set();
    const maxPick = Math.min(count, words.length);
    while (chosen.size < maxPick){
      chosen.add(Math.floor(r() * words.length));
    }
    const chosenArr = Array.from(chosen).map(idx => words[idx]).sort((a,b)=>a.i-b.i);

    // build html with spans
    let out = "";
    let cursor = 0;
    for (const it of chosenArr){
      out += escapeHtml(rawText.slice(cursor, it.i));
      const real = rawText.substr(it.i, it.len);
      const masked = "▯".repeat(Math.min(8, Math.max(4, real.length)));
      out += '<span class="mw" data-real="' + escapeHtml(real) + '">' + masked + "</span>";
      cursor = it.i + it.len;
    }
    out += escapeHtml(rawText.slice(cursor));
    return { html: out, did: true };
  }

  function wireMysteryClicks(root){
    root.querySelectorAll(".mw").forEach(el => {
      el.addEventListener("click", () => {
        if (el.classList.contains("revealed")) return;
        el.textContent = el.getAttribute("data-real") || "";
        el.classList.add("revealed");
      });
    });
  }

  // ---- Render ----
  function colorForName(name){
    const s = String(name||"?");
    let h = 0;
    for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) % 360;
    return "hsl(" + h + ", 70%, 92%)";
  }

  function initialForName(name){
    const s = String(name||"?");
    return s.trim().slice(0,1).toUpperCase() || "?";
  }

  function getDockH(){
    const r = els.dock.getBoundingClientRect();
    return r.height || 92;
  }

  function scrollToActive(){
    const el = document.querySelector('.msg.active');
    if (!el) return;
    // scroll into view, then nudge a bit to keep above dock
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    setTimeout(() => {
      const dockH = getDockH();
      window.scrollBy({ top: -Math.min(140, dockH * 0.6), behavior: "smooth" });
    }, 250);
  }

  function setActive(idx){
    activeIdx = idx;
    document.querySelectorAll(".msg").forEach(m => m.classList.remove("active"));
    const el = document.querySelector('.msg[data-idx="' + idx + '"]');
    if (el) el.classList.add("active");
  }

  function render(){
    stopSpeak();

    const variant = els.variantSel.value;
    const pace = els.paceSel.value;
    const showEmojis = !!els.chkEmojis.checked;
    const mysteryN = parseInt(els.mysterySel.value || "0", 10);

    const vp = (pack.variants && pack.variants[variant]) ? pack.variants[variant] :
               (pack[variant] ? pack[variant] : pack);
    const msgs = (vp && (vp.messages || vp.thread || vp.chat || vp.items)) ? (vp.messages || vp.thread || vp.chat || vp.items) : [];
    const concepts = getConcepts(pack);

    els.threadMeta.textContent = msgs.length ? (msgs.length + " messages") : "No messages found";
    els.conceptMeta.textContent = concepts.length ? (concepts.length + " items") : "No concepts";

    // pace logic
    const total = msgs.length;
    if (pace === "all"){
      visibleCount = total;
      els.btnNext.disabled = true;
    }else{
      els.btnNext.disabled = false;
      visibleCount = Math.max(1, Math.min(visibleCount, total || 1));
    }

    // Render messages
    els.thread.innerHTML = "";
    const vis = msgs.slice(0, visibleCount);
    vis.forEach((m, i) => {
      const idx = i;
      const name = m.name || m.speaker || m.participant || ("Participant " + (i+1));
      const raw = String(m.text || m.message || m.content || "");
      const emoji = String(m.emoji || m.reaction || "");
      const displayText = showEmojis ? (raw + (emoji ? " " + emoji : "")) : raw;

      const wrap = document.createElement("div");
      wrap.className = "msg";
      wrap.setAttribute("data-idx", String(idx));

      const av = document.createElement("div");
      av.className = "avatar";
      av.style.background = colorForName(name);
      av.textContent = initialForName(name);

      const right = document.createElement("div");
      right.style.flex = "1";

      const meta = document.createElement("div");
      meta.className = "meta";
      const nm = document.createElement("div");
      nm.className = "name";
      nm.textContent = name;
      const idd = document.createElement("div");
      idd.className = "idx";
      idd.textContent = "#" + (i+1);
      meta.appendChild(nm);
      meta.appendChild(idd);

      const txt = document.createElement("div");
      txt.className = "text";
      txt.setAttribute("data-raw", displayText);

      // apply mystery words (on raw without html)
      const myst = applyMysteryToText(displayText, idx, mysteryN);
      txt.innerHTML = myst.html;

      const btnRow = document.createElement("div");
      btnRow.className = "btnRow";

      const bSpeak = document.createElement("button");
      bSpeak.className = "btn primary";
      bSpeak.type = "button";
      bSpeak.textContent = "Speak";
      bSpeak.addEventListener("click", () => speakMessage(displayText, wrap));

      const bUnpack = document.createElement("button");
      bUnpack.className = "btn";
      bUnpack.type = "button";
      bUnpack.textContent = "Unpack";
      bUnpack.addEventListener("click", () => {
        const extra = m.unpack || m.explain || m.notes || null;
        if (!extra){
          alert("No unpack data in this pack for this message (yet).");
          return;
        }
        alert(typeof extra === "string" ? extra : JSON.stringify(extra, null, 2));
      });

      btnRow.appendChild(bSpeak);
      btnRow.appendChild(bUnpack);

      // Optional tag pill (if concept/topic exists)
      const tag = m.tag || m.topic || m.skill || "";
      if (tag){
        const p = document.createElement("div");
        p.className = "pill";
        p.textContent = String(tag);
        btnRow.appendChild(p);
      }

      right.appendChild(meta);
      right.appendChild(txt);
      right.appendChild(btnRow);

      const row = document.createElement("div");
      row.className = "row";
      row.appendChild(av);
      row.appendChild(right);

      wrap.appendChild(row);

      // click selects active
      wrap.addEventListener("click", () => {
        setActive(idx);
        scrollToActive();
      });

      els.thread.appendChild(wrap);

      // wire mystery reveal
      wireMysteryClicks(wrap);
    });

    // Set active to last visible in step mode, else last message
    const newActive = Math.max(0, Math.min((visibleCount - 1), Math.max(0, (vis.length - 1))));
    setActive(newActive);

    // Render concepts
    els.concepts.innerHTML = "";
    if (concepts.length){
      concepts.slice(0, 60).forEach((c) => {
        const term = c.term || c.word || c.title || c.name || "Concept";
        const def = c.definition || c.def || c.meaning || c.explain || "";
        const ex = c.example || c.examples || c.use || "";

        const div = document.createElement("div");
        div.className = "concept";

        const t = document.createElement("div");
        t.className = "term";
        t.textContent = term;

        const d = document.createElement("div");
        d.className = "def";
        d.textContent = def ? String(def) : "—";

        div.appendChild(t);
        div.appendChild(d);

        if (ex){
          const e = document.createElement("div");
          e.className = "ex";
          e.textContent = typeof ex === "string" ? ex : JSON.stringify(ex);
          div.appendChild(e);
        }

        els.concepts.appendChild(div);
      });
    }else{
      const div = document.createElement("div");
      div.className = "concept";
      div.innerHTML = '<div class="def">No concepts found in pack. If your generator includes a glossary/concepts list, it will render here.</div>';
      els.concepts.appendChild(div);
    }

    // update status
    els.status.textContent = (pace === "step")
      ? ("Showing " + visibleCount + " of " + total)
      : ("Showing all " + total);

    // ensure active is visible and positioned nicely
    setTimeout(scrollToActive, 120);
  }

  // Controls
  els.btnNext.addEventListener("click", () => {
    const variant = els.variantSel.value;
    const vp = (pack.variants && pack.variants[variant]) ? pack.variants[variant] : (pack[variant] ? pack[variant] : pack);
    const msgs = (vp && (vp.messages || vp.thread || vp.chat || vp.items)) ? (vp.messages || vp.thread || vp.chat || vp.items) : [];

    visibleCount = Math.min(msgs.length, visibleCount + 1);
    render();
  });

  els.btnAll.addEventListener("click", () => {
    els.paceSel.value = "all";
    render();
  });

  els.btnStop.addEventListener("click", stopSpeak);

  [
    els.variantSel, els.paceSel,
    els.chkTeacher, els.chkEmojis, els.chkSpeakEmojis,
    els.chkKaraoke, els.mysterySel,
    els.voiceSel
  ].forEach(el => el.addEventListener("change", render));

  // Initial render
  render();
})();
</script>
</body>
</html>`;

  downloadTextFile(filename, html);
}
