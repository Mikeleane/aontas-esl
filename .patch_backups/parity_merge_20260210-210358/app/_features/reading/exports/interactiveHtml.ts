import type { ReadingPackData, ReadingMode } from "../readingPackTypes";

function escHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeJson(obj: any) {
  // prevent </script> breakouts
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function buildInteractiveHtml(pack: ReadingPackData): string {
  const title = pack.title || "Reading Pack";
  const crest = pack.crest || "";
  const readingStandard = pack.reading?.standard || "";
  const readingSupported = (pack.reading?.SUPPORTED || pack.reading?.standard || "") as string;

  const initialSettings = {
    font: "system",
    fs: 18,
    lh: 1.55,
    ls: 0,
    wlfs: 22,
    voiceA: "",
    voiceB: "",
    rate: 1,
    onePara: false,
    bionic: false,
    night: false,
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escHtml(title)} — Aontas 10</title>
<style>
  :root{
    --ink:#0f172a;
    --muted:#475569;
    --muted2:#64748b;
    --line:rgba(15,23,42,.14);
    --bgA: rgba(79,179,217,.18);
    --bgB: rgba(244,197,66,.18);
    --accent:#2d7d4f;
    --danger:#dc2626;

    --fs: ${initialSettings.fs}px;
    --lh: ${initialSettings.lh};
    --ls: ${initialSettings.ls}em;
    --wlfs: ${initialSettings.wlfs}px;

    --font: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji","Segoe UI Emoji";
  }

  body{
    margin:0;
    color:var(--ink);
    background:
      radial-gradient(900px 420px at 10% 10%, var(--bgA), transparent 60%),
      radial-gradient(900px 420px at 90% 10%, var(--bgB), transparent 60%),
      linear-gradient(180deg, rgba(248,250,252,1), rgba(248,250,252,.85));
    font-family: var(--font);
    font-size: var(--fs);
    line-height: var(--lh);
    letter-spacing: var(--ls);
  }

  .wrap{ max-width:1100px; margin:0 auto; padding:18px; }
  .card{
    margin-top:14px;
    background: rgba(255,255,255,.88);
    border:1px solid var(--line);
    border-radius:22px;
    padding:16px;
    box-shadow: 0 10px 30px rgba(2,6,23,.07);
    backdrop-filter: blur(6px);
  }

  .row{ display:flex; gap:12px; flex-wrap:wrap; align-items:center; justify-content:space-between; }
  .h1{ font-size:22px; font-weight:1000; margin:0; }
  .sub{ color:var(--muted); font-size:13px; margin-top:6px; }
  .tiny{ color:var(--muted2); font-size:12px; line-height:1.35; }

  .btn{
    display:inline-flex; align-items:center; justify-content:center;
    gap:8px; border-radius:14px; padding:10px 12px;
    font-weight:900; font-size:13px; border:1px solid var(--line);
    background:white; color:var(--ink); cursor:pointer; user-select:none;
  }
  .btn.primary{ background:var(--accent); color:white; border-color: rgba(45,125,79,.35); }
  .btn.danger{ background:var(--danger); color:white; border-color: rgba(220,38,38,.35); }
  .btn:disabled{ opacity:.5; cursor:not-allowed; }

  .pill{
    border:1px solid var(--line);
    background:white;
    border-radius:999px;
    padding:8px 10px;
    font-size:12px;
    font-weight:900;
    cursor:pointer;
  }
  .pill.active{ background:#0f172a; color:white; }

  .grid2{ display:grid; grid-template-columns: 1.2fr .8fr; gap:12px; }
  @media (max-width: 920px){ .grid2{ grid-template-columns:1fr; } }

  .panel{
    border:1px solid var(--line);
    background:white;
    border-radius:18px;
    padding:12px;
  }

  .reading p{ margin:0 0 12px; }
  .reading p:last-child{ margin-bottom:0; }

  .word{
    cursor:pointer;
    padding:0 2px;
    border-radius:6px;
  }
  .word:hover{ background: rgba(45,125,79,.10); }

  .bionic .word b{ font-weight:1000; }
  .night{
    background:#0b1220 !important;
    color:#e5e7eb !important;
  }
  .night .card{ background: rgba(15,23,42,.55); border-color: rgba(148,163,184,.25); }
  .night .panel{ background: rgba(2,6,23,.35); border-color: rgba(148,163,184,.25); }
  .night .btn{ background: rgba(2,6,23,.35); color:#e5e7eb; }
  .night .pill{ background: rgba(2,6,23,.35); color:#e5e7eb; }
  .night .pill.active{ background:#e5e7eb; color:#0b1220; }

  /* Accessibility bar */
  .a11y{
    display:grid;
    grid-template-columns: 1.1fr 1fr 1fr;
    gap:12px;
    align-items:end;
  }
  @media (max-width: 980px){ .a11y{ grid-template-columns:1fr; } }
  label{ font-size:12px; font-weight:900; color:var(--muted); display:block; margin-bottom:6px; }
  select, input[type="range"]{
    width:100%;
    padding:10px 12px;
    border-radius:12px;
    border:1px solid var(--line);
    background:white;
    color:var(--ink);
    font-weight:800;
  }
  .rangeRow{ display:flex; gap:10px; align-items:center; }
  .rangeVal{ font-size:12px; font-weight:1000; color:var(--muted); min-width:70px; text-align:right; }

  /* Word lab */
  .wordlab .bigWord{
    font-size: var(--wlfs);
    font-weight:1100;
    letter-spacing: calc(var(--ls) * 0.6);
    line-height:1.15;
  }
  .tag{ display:inline-block; border:1px solid var(--line); background:#f1f5f9; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:900; }
  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:12px; }

  .breakGrid{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
  @media (max-width: 820px){ .breakGrid{ grid-template-columns:1fr; } }

  .miniBtn{
    border:1px solid var(--line);
    background:white;
    border-radius:12px;
    padding:9px 12px;
    font-size:12px;
    font-weight:900;
    cursor:pointer;
  }
  .miniBtn:disabled{ opacity:.5; cursor:not-allowed; }

  .kbd{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:12px; background:#f1f5f9; padding:3px 6px; border-radius:8px; border:1px solid var(--line); }

</style>
</head>

<body>
<div class="wrap" id="root">

  <div class="card">
    <div class="row">
      <div style="display:flex; gap:12px; align-items:flex-start;">
        ${
          crest
            ? `<img src="${escHtml(crest)}" alt="Crest" style="width:56px;height:56px;border-radius:14px;border:1px solid var(--line);object-fit:cover;background:white;" />`
            : ""
        }
        <div>
          <div class="h1">${escHtml(title)}</div>
          <div class="sub">Aontas 10 — Interactive Reading Pack</div>
          <div class="tiny">
            Tip: click a word to open the Word Lab. Use <span class="kbd">Ctrl</span>+<span class="kbd">F</span> to find words fast.
          </div>
        </div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button class="pill active" id="modeStandard">Standard (A)</button>
        <button class="pill" id="modeSupported">Supported (B)</button>
        <button class="pill" id="toggleNight">Night</button>
        <button class="pill" id="toggleBionic">Bionic</button>
        <button class="pill" id="toggleOnePara">One-at-a-time</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div style="font-weight:1000; font-size:14px; margin-bottom:10px;">Accessibility + Read Aloud</div>

    <div class="a11y">
      <div>
        <label for="fontSel">Font</label>
        <select id="fontSel">
          <option value="system">System Sans (default)</option>
          <option value="verdana">Verdana</option>
          <option value="georgia">Georgia (serif)</option>
          <option value="comic">Comic Sans (surprisingly readable)</option>
          <option value="atkinson">Atkinson Hyperlegible (if installed)</option>
          <option value="opendyslexic">OpenDyslexic (if installed)</option>
        </select>
        <div class="tiny" style="margin-top:8px;">(No downloads here — options use installed fonts.)</div>
      </div>

      <div>
        <label>Text spacing</label>
        <div class="rangeRow">
          <input id="fs" type="range" min="14" max="34" step="1" />
          <div class="rangeVal" id="fsVal"></div>
        </div>
        <div class="rangeRow" style="margin-top:10px;">
          <input id="lh" type="range" min="1.2" max="2.2" step="0.05" />
          <div class="rangeVal" id="lhVal"></div>
        </div>
        <div class="rangeRow" style="margin-top:10px;">
          <input id="ls" type="range" min="0" max="0.12" step="0.005" />
          <div class="rangeVal" id="lsVal"></div>
        </div>
        <div class="tiny" style="margin-top:8px;">Font size • line spacing • letter spacing</div>
      </div>

      <div>
        <label>Read Aloud (Voice A / Voice B)</label>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <div class="tiny" style="margin-bottom:6px;">Voice A (often “male”)</div>
            <select id="voiceA"></select>
          </div>
          <div>
            <div class="tiny" style="margin-bottom:6px;">Voice B (often “female”)</div>
            <select id="voiceB"></select>
          </div>
        </div>
        <div class="rangeRow" style="margin-top:10px;">
          <input id="rate" type="range" min="0.7" max="1.2" step="0.05" />
          <div class="rangeVal" id="rateVal"></div>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
          <button class="btn" id="readSelection">Read selection</button>
          <button class="btn primary" id="readPara">Read this paragraph</button>
          <button class="btn" id="readAll">Read all</button>
          <button class="btn danger" id="stopRead">Stop</button>
        </div>
      </div>
    </div>
  </div>

  <div class="card grid2">
    <div class="panel reading">
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div style="font-weight:1000;">Reading</div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="miniBtn" id="prevPara">◀ Prev</button>
          <div class="tag" id="paraCounter">Paragraph 1 / 1</div>
          <button class="miniBtn" id="nextPara">Next ▶</button>
        </div>
      </div>
      <div id="readingBox" style="margin-top:12px;"></div>
    </div>

    <div class="panel wordlab wordlabPanel">
      <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;">
        <div style="font-weight:1000;">Word Lab</div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <span class="tag" id="wlModeTag">Click a word</span>
        </div>
      </div>

      <div style="margin-top:12px;">
        <div class="bigWord" id="wlWord">—</div>
        <div class="tiny" id="wlContext" style="margin-top:8px;"></div>

        <div style="margin-top:12px;">
          <label>Word Lab font size</label>
          <div class="rangeRow">
            <input id="wlfs" type="range" min="16" max="44" step="1" />
            <div class="rangeVal" id="wlfsVal"></div>
          </div>
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
          <button class="btn primary" id="wlSpeakA">Say (A)</button>
          <button class="btn" id="wlSpeakB">Say (B)</button>
          <button class="btn" id="wlSlow">Slow</button>
          <button class="btn" id="wlSpell">Spell</button>
          <button class="btn" id="wlDefine">Define</button>
          <button class="btn" id="wlImages">Images</button>
        </div>

        <div class="breakGrid" style="margin-top:12px;">
          <div class="panel" style="padding:10px;">
            <div style="font-weight:1000; font-size:13px;">Break it down</div>
            <div class="tiny" style="margin-top:6px;">Syllables • clap • vowel teams • prefixes/suffixes • root</div>
            <div id="wlBreak" style="margin-top:10px;"></div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
              <button class="miniBtn" id="wlClap">Clap syllables</button>
              <button class="miniBtn" id="wlWiktionary">Wiktionary</button>
              <button class="miniBtn" id="wlEtym">Etymology</button>
              <button class="miniBtn" id="wlThesaurus">Synonyms</button>
              <button class="miniBtn" id="wlRhyme">Rhymes</button>
            </div>
          </div>

          <div class="panel" style="padding:10px;">
            <div style="font-weight:1000; font-size:13px;">Teacher helpers</div>
            <div class="tiny" style="margin-top:6px;">Build a mini glossary across the lesson (saved in this file’s browser).</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
              <button class="miniBtn" id="wlAddGloss">Add to glossary</button>
              <button class="miniBtn" id="wlShowGloss">Show glossary</button>
              <button class="miniBtn" id="wlExportGloss">Export glossary</button>
              <button class="miniBtn" id="wlClearGloss">Clear glossary</button>
            </div>
            <div id="wlGlossBox" style="margin-top:10px;"></div>
          </div>
        </div>

      </div>
    </div>
  </div>

  <div class="card">
    <div style="font-weight:1000; font-size:14px; margin-bottom:10px;">Exercises</div>
    <div class="tiny" style="margin-bottom:10px;">(Shared answer key — Student A + Student B can work together.)</div>
    <div id="exBox"></div>
  </div>
</div>

<script id="packData" type="application/json">${safeJson({
    ...pack,
    reading: { standard: readingStandard, SUPPORTED: readingSupported },
  })}</script>

<script>
(function(){
  const pack = JSON.parse(document.getElementById("packData").textContent || "{}") || {};
  const $ = (id) => document.getElementById(id);

  const SETTINGS_KEY = "a10_html_a11y_v1";
  const GLOSS_KEY = "a10_html_glossary_v1";

  const state = {
    mode: "standard",
    paraIndex: 0,

    night: false,
    bionic: false,
    onePara: false,

    font: "system",
    fs: ${initialSettings.fs},
    lh: ${initialSettings.lh},
    ls: ${initialSettings.ls},
    wlfs: ${initialSettings.wlfs},

    voiceA: "",
    voiceB: "",
    rate: ${initialSettings.rate},

    word: "",
    context: "",

    voices: [],
    speaking: null,
  };

  /* ------------------------- Settings (persisted) ------------------------- */

  function loadSettings(){
    try{
      const raw = localStorage.getItem(SETTINGS_KEY);
      if(!raw) return;
      const s = JSON.parse(raw);
      if(!s || typeof s !== "object") return;

      ["font","voiceA","voiceB"].forEach(k => { if(typeof s[k] === "string") state[k] = s[k]; });
      ["fs","wlfs"].forEach(k => { if(typeof s[k] === "number") state[k] = s[k]; });
      ["lh","ls","rate"].forEach(k => { if(typeof s[k] === "number") state[k] = s[k]; });
      ["night","bionic","onePara"].forEach(k => { if(typeof s[k] === "boolean") state[k] = s[k]; });

    }catch{}
  }

  function saveSettings(){
    try{
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        font: state.font,
        fs: state.fs,
        lh: state.lh,
        ls: state.ls,
        wlfs: state.wlfs,
        voiceA: state.voiceA,
        voiceB: state.voiceB,
        rate: state.rate,
        night: state.night,
        bionic: state.bionic,
        onePara: state.onePara
      }));
    }catch{}
  }

  function applyA11y(){
    document.documentElement.style.setProperty("--fs", state.fs + "px");
    document.documentElement.style.setProperty("--lh", String(state.lh));
    document.documentElement.style.setProperty("--ls", String(state.ls) + "em");
    document.documentElement.style.setProperty("--wlfs", state.wlfs + "px");

    const fonts = {
      system: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji","Segoe UI Emoji"',
      verdana: 'Verdana, Arial, system-ui, sans-serif',
      georgia: 'Georgia, "Times New Roman", serif',
      comic: '"Comic Sans MS", "Comic Sans", system-ui, sans-serif',
      atkinson: '"Atkinson Hyperlegible", Arial, system-ui, sans-serif',
      opendyslexic: '"OpenDyslexic", Arial, system-ui, sans-serif'
    };
    document.documentElement.style.setProperty("--font", fonts[state.font] || fonts.system);

    const root = $("root");
    if(state.night) root.classList.add("night"); else root.classList.remove("night");
    if(state.bionic) root.classList.add("bionic"); else root.classList.remove("bionic");

    $("fsVal").textContent = state.fs + "px";
    $("lhVal").textContent = "LH " + Number(state.lh).toFixed(2);
    $("lsVal").textContent = "LS " + Number(state.ls).toFixed(3) + "em";
    $("wlfsVal").textContent = state.wlfs + "px";
    $("rateVal").textContent = "Rate " + Number(state.rate).toFixed(2);
  }

  /* ------------------------------- Reading -------------------------------- */

  function splitParas(txt){
    return String(txt||"")
      .replace(/\\r/g,"")
      .split(/\\n\\s*\\n+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function currentReading(){
    const r = pack.reading || {};
    return state.mode === "SUPPORTED" ? (r.SUPPORTED || r.standard || "") : (r.standard || "");
  }

  function wrapWords(p){
    // keeps punctuation but makes word tokens clickable
    const tokens = String(p||"").split(/(\\s+)/);
    return tokens.map(t => {
      if(/^\\s+$/.test(t)) return t;
      const raw = t;
      const w = raw.replace(/^[-–—("'“‘]+|[-–—)"'”’.,!?;:]+$/g,"");
      if(!w) return esc(raw);
      const safe = esc(raw);
      const data = esc(w);
      if(state.bionic){
        // bold first chunk
        const b = w.length <= 4 ? 2 : Math.max(2, Math.floor(w.length * 0.45));
        const left = esc(w.slice(0,b));
        const right = esc(w.slice(b));
        // rebuild with punctuation preserved via safe
        // easiest: wrap whole token but display safe; store data-word separately.
        return '<span class="word" data-word="'+data+'"><b>'+left+'</b>'+esc(w.slice(b))+'</span>' + safe.replace(esc(w), "");
      }
      return '<span class="word" data-word="'+data+'">'+safe+'</span>';
    }).join("");
  }

  function esc(s){
    return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function renderReading(){
    const box = $("readingBox");
    const paras = splitParas(currentReading());

    if(!paras.length){
      box.innerHTML = '<div class="tiny">No reading text found.</div>';
      $("paraCounter").textContent = "Paragraph 0 / 0";
      return;
    }

    if(state.paraIndex < 0) state.paraIndex = 0;
    if(state.paraIndex > paras.length-1) state.paraIndex = paras.length-1;

    $("paraCounter").textContent = "Paragraph " + (state.paraIndex+1) + " / " + paras.length;

    if(state.onePara){
      const p = paras[state.paraIndex];
      box.innerHTML = "<p>" + wrapWords(p) + "</p>";
      $("prevPara").disabled = state.paraIndex <= 0;
      $("nextPara").disabled = state.paraIndex >= paras.length-1;
    }else{
      box.innerHTML = paras.map(p => "<p>" + wrapWords(p) + "</p>").join("");
      $("prevPara").disabled = true;
      $("nextPara").disabled = true;
    }
  }

  /* ------------------------------ Exercises -------------------------------- */

  function getSide(ex){
    if(state.mode === "SUPPORTED") return ex.SUPPORTED || ex.adapted || ex.standard;
    return ex.standard;
  }

  function renderExercises(){
    const exBox = $("exBox");
    const exs = Array.isArray(pack.exercises) ? pack.exercises : [];
    if(!exs.length){
      exBox.innerHTML = '<div class="tiny">No exercises yet.</div>';
      return;
    }

    exBox.innerHTML = exs.map((ex, i) => {
      const side = getSide(ex) || {};
      const prompt = esc(side.prompt || "");
      const options = Array.isArray(side.options) ? side.options : null;

      let body = "";
      if(options && options.length){
        body = '<ol style="margin:8px 0 0; padding-left:18px;">' +
          options.map(o => '<li style="margin:6px 0;">' + esc(o) + '</li>').join("") +
        '</ol>';
      }else{
        body = '<div style="margin-top:8px;"><span class="tiny">Answer:</span> <span style="display:inline-block;border-bottom:1px solid var(--line);min-width:260px;height:18px;"></span></div>';
      }

      return '<div class="panel" style="margin-top:12px;">' +
        '<div style="font-weight:1000;">' + (i+1) + '. ' + prompt + '</div>' +
        '<div class="tiny" style="margin-top:6px;">Type: ' + esc(ex.type || "exercise") + '</div>' +
        body +
      '</div>';
    }).join("");
  }

  /* --------------------------- Speech / Voices ----------------------------- */

  function pickDefaultVoices(voices){
    const en = voices.filter(v => (v.lang||"").toLowerCase().startsWith("en"));
    const list = en.length ? en : voices;

    // heuristic: names sometimes contain gender-y hints; not guaranteed.
    const male = list.find(v => /male|daniel|david|mark|george|ryan/i.test(v.name));
    const female = list.find(v => /female|susan|zoe|emma|amy|samantha|victoria/i.test(v.name));

    const a = male || list[0] || null;
    const b = female || list.find(v => a && v.name !== a.name) || list[1] || a;

    return { a: a ? a.name : "", b: b ? b.name : "" };
  }

  function loadVoices(){
    if(!("speechSynthesis" in window)) return;
    const voices = window.speechSynthesis.getVoices() || [];
    state.voices = voices;

    const selA = $("voiceA");
    const selB = $("voiceB");
    selA.innerHTML = "";
    selB.innerHTML = "";

    const add = (sel, v) => {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = v.name + (v.lang ? " ("+v.lang+")" : "");
      sel.appendChild(opt);
    };

    voices.forEach(v => { add(selA, v); add(selB, v); });

    // defaults
    if(!state.voiceA || !voices.find(v => v.name === state.voiceA) ||
       !state.voiceB || !voices.find(v => v.name === state.voiceB)){
      const d = pickDefaultVoices(voices);
      state.voiceA = d.a;
      state.voiceB = d.b;
    }

    if(state.voiceA) selA.value = state.voiceA;
    if(state.voiceB) selB.value = state.voiceB;

    saveSettings();
  }

  function stopSpeaking(){
    try{
      if("speechSynthesis" in window) window.speechSynthesis.cancel();
    }catch{}
  }

  function speak(text, voiceName){
    stopSpeaking();
    if(!("speechSynthesis" in window)) return;

    const u = new SpeechSynthesisUtterance(String(text||"").trim());
    if(!u.text) return;

    u.rate = Number(state.rate || 1);

    const v = state.voices.find(v => v.name === voiceName);
    if(v) u.voice = v;

    window.speechSynthesis.speak(u);
  }

  function selectedText(){
    try{
      const sel = window.getSelection && window.getSelection();
      const t = sel ? String(sel.toString() || "").trim() : "";
      return t;
    }catch{ return ""; }
  }

  function currentParaText(){
    const paras = splitParas(currentReading());
    if(!paras.length) return "";
    if(state.onePara) return paras[state.paraIndex] || "";
    // if not onePara, read the paragraph nearest the top-ish: use paraIndex
    return paras[state.paraIndex] || paras[0] || "";
  }

  function allReadingText(){
    return splitParas(currentReading()).join("\\n\\n");
  }

  /* ---------------------------- Word Lab logic ----------------------------- */

  function normalizeWord(w){
    return String(w||"").toLowerCase().replace(/[^a-z\\-']/g,"").replace(/^-+|-+$/g,"");
  }

  function findContext(word){
    const w = normalizeWord(word);
    if(!w) return "";
    const txt = allReadingText();
    if(!txt) return "";
    const sentences = txt.split(/(?<=[.!?])\\s+/);
    
 function escRe(str){
   return String(str||"").replace(/[.*+?^{}()|[\\]\\\\$]/g,"\\\\$&");
 }
 const hit = sentences.find(s => new RegExp("\\\\b"+escRe(w)+"\\\\b","i").test(s));

    return hit ? hit.trim() : "";
  }

  function syllableSplit(word){
    // VERY heuristic, but better than nothing.
    const w = normalizeWord(word);
    if(!w) return [];
    const cleaned = w.replace(/'/g,"");
    const parts = [];
    let cur = "";
    const vowels = "aeiouy";
    for(let i=0;i<cleaned.length;i++){
      const ch = cleaned[i];
      cur += ch;
      const next = cleaned[i+1] || "";
      const isV = vowels.includes(ch);
      const nextIsV = next && vowels.includes(next);
      // split after vowel group when next is consonant and we have more left
      if(isV && !nextIsV && i < cleaned.length-2){
        parts.push(cur);
        cur = "";
      }
    }
    if(cur) parts.push(cur);
    // tiny cleanup: merge single-letter bits
    const merged = [];
    for(const p of parts){
      if(merged.length && p.length === 1) merged[merged.length-1] += p;
      else merged.push(p);
    }
    return merged.filter(Boolean);
  }

  const VOWEL_TEAMS = ["ea","ee","ai","ay","oa","oe","oi","oy","ou","ow","au","aw","ie","ei","ue","ui","igh"];
  function vowelTeams(word){
    const w = normalizeWord(word);
    const hits = [];
    for(const t of VOWEL_TEAMS){
      if(w.includes(t)) hits.push(t);
    }
    return hits;
  }

  const PREFIXES = {
    un:"not", re:"again", dis:"opposite", mis:"wrongly", pre:"before", sub:"under", super:"above",
    inter:"between", trans:"across", anti:"against", auto:"self", bi:"two", tri:"three", tele:"far", micro:"small", macro:"large"
  };
  const SUFFIXES = {
    ing:"action", ed:"past", ly:"how", er:"person/thing", est:"most", ful:"full of", less:"without", ness:"state",
    tion:"act/state", sion:"act/state", ment:"result", able:"can be", ible:"can be", ous:"full of", ive:"tending to", y:"having"
  };

  function detectAffixes(word){
    const w = normalizeWord(word);
    let pre = "";
    let suf = "";

    // longest-match wins
    const preKeys = Object.keys(PREFIXES).sort((a,b)=>b.length-a.length);
    const sufKeys = Object.keys(SUFFIXES).sort((a,b)=>b.length-a.length);

    for(const p of preKeys){
      if(w.startsWith(p) && w.length > p.length + 2){ pre = p; break; }
    }
    for(const s of sufKeys){
      if(w.endsWith(s) && w.length > s.length + 2){ suf = s; break; }
    }

    const root = w.replace(new RegExp("^"+pre), "").replace(new RegExp(suf+"$"), "");
    return { pre, suf, root: root || w };
  }

  function buildBreakdown(word){
    const w = normalizeWord(word);
    if(!w) return '<div class="tiny">Click a word in the reading to see breakdown tools.</div>';

    const syl = syllableSplit(w);
    const aff = detectAffixes(w);
    const teams = vowelTeams(w);

    const sylHtml = syl.length
      ? '<div><span class="tag">'+syl.length+' syllable'+(syl.length===1?'':'s')+'</span> ' +
        syl.map(s => '<span class="tag" style="margin-left:6px;">'+esc(s)+'</span>').join("") +
        '</div>'
      : '<div class="tiny">Syllables: (not sure)</div>';

    const teamHtml = teams.length
      ? '<div style="margin-top:10px;"><div class="tiny">Vowel teams spotted:</div>' +
        teams.map(t => '<span class="tag" style="margin-right:6px; margin-top:6px; display:inline-block;">'+esc(t)+'</span>').join("") +
        '</div>'
      : '<div style="margin-top:10px;" class="tiny">Vowel teams: none obvious</div>';

    const preHtml = aff.pre
      ? '<div style="margin-top:10px;"><div class="tiny">Prefix:</div><span class="tag">'+esc(aff.pre)+'</span> <span class="tiny">('+esc(PREFIXES[aff.pre] || "meaning unknown")+')</span></div>'
      : '<div style="margin-top:10px;" class="tiny">Prefix: none obvious</div>';

    const sufHtml = aff.suf
      ? '<div style="margin-top:10px;"><div class="tiny">Suffix:</div><span class="tag">'+esc(aff.suf)+'</span> <span class="tiny">('+esc(SUFFIXES[aff.suf] || "meaning unknown")+')</span></div>'
      : '<div style="margin-top:10px;" class="tiny">Suffix: none obvious</div>';

    const rootHtml =
      '<div style="margin-top:10px;"><div class="tiny">Root/core:</div><span class="tag">'+esc(aff.root)+'</span></div>';

    return sylHtml + teamHtml + preHtml + sufHtml + rootHtml;
  }

  function playClaps(count){
    const n = Math.max(1, Math.min(8, Number(count||1)));
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const t0 = ctx.currentTime + 0.05;
      for(let i=0;i<n;i++){
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 520;
        gain.gain.value = 0.0001;

        osc.connect(gain);
        gain.connect(ctx.destination);

        const t = t0 + i*0.35;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.10);
        osc.start(t);
        osc.stop(t + 0.12);
      }
      setTimeout(()=>{ try{ ctx.close(); }catch{} }, 1200);
    }catch{}
  }

  function openLink(url){
    try{ window.open(url, "_blank", "noopener,noreferrer"); }catch{}
  }

  function updateWordLab(word){
    state.word = word || "";
    const w = normalizeWord(state.word);

    $("wlWord").textContent = w ? state.word : "—";
    $("wlModeTag").textContent = w ? (state.mode === "SUPPORTED" ? "Supported (B)" : "Standard (A)") : "Click a word";

    state.context = w ? findContext(w) : "";
    $("wlContext").textContent = state.context ? ("Context: " + state.context) : "";

    $("wlBreak").innerHTML = buildBreakdown(w);
  }

  /* ------------------------------ Glossary -------------------------------- */

  function loadGloss(){
    try{
      const raw = localStorage.getItem(GLOSS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch{ return []; }
  }

  function saveGloss(arr){
    try{ localStorage.setItem(GLOSS_KEY, JSON.stringify(arr)); }catch{}
  }

  function renderGloss(){
    const box = $("wlGlossBox");
    const arr = loadGloss();
    if(!arr.length){
      box.innerHTML = '<div class="tiny">No glossary items yet.</div>';
      return;
    }
    box.innerHTML =
      '<div class="mono">' +
      arr.map((x,i)=> (i+1)+". "+esc(x.word)+" — "+esc(x.note||"")).join("<br/>") +
      "</div>";
  }

  /* ------------------------------ Wire up UI ------------------------------ */

  loadSettings();
  applyA11y();

  // Tabs
  function setMode(m){
    state.mode = m;
    $("modeStandard").classList.toggle("active", m === "standard");
    $("modeSupported").classList.toggle("active", m === "SUPPORTED");
    renderReading();
    renderExercises();
    updateWordLab(state.word);
    saveSettings();
  }

  $("modeStandard").onclick = () => setMode("standard");
  $("modeSupported").onclick = () => setMode("SUPPORTED");

  $("toggleNight").onclick = () => { state.night = !state.night; applyA11y(); saveSettings(); };
  $("toggleBionic").onclick = () => { state.bionic = !state.bionic; applyA11y(); renderReading(); saveSettings(); };
  $("toggleOnePara").onclick = () => { state.onePara = !state.onePara; applyA11y(); renderReading(); saveSettings(); };

  // A11y inputs
  $("fontSel").value = state.font;
  $("fontSel").onchange = (e) => { state.font = e.target.value; applyA11y(); saveSettings(); };

  $("fs").value = state.fs;
  $("fs").oninput = (e) => { state.fs = Number(e.target.value||18); applyA11y(); saveSettings(); };

  $("lh").value = state.lh;
  $("lh").oninput = (e) => { state.lh = Number(e.target.value||1.55); applyA11y(); saveSettings(); };

  $("ls").value = state.ls;
  $("ls").oninput = (e) => { state.ls = Number(e.target.value||0); applyA11y(); saveSettings(); };

  $("wlfs").value = state.wlfs;
  $("wlfs").oninput = (e) => { state.wlfs = Number(e.target.value||22); applyA11y(); saveSettings(); };

  $("rate").value = state.rate;
  $("rate").oninput = (e) => { state.rate = Number(e.target.value||1); applyA11y(); saveSettings(); };

  // Paragraph controls
  $("prevPara").onclick = () => { state.paraIndex--; renderReading(); };
  $("nextPara").onclick = () => { state.paraIndex++; renderReading(); };

  // Read aloud
  $("readSelection").onclick = () => {
    const t = selectedText();
    if(!t) return;
    speak(t, state.voiceA || state.voiceB);
  };
  $("readPara").onclick = () => speak(currentParaText(), state.voiceA || state.voiceB);
  $("readAll").onclick = () => speak(allReadingText(), state.voiceA || state.voiceB);
  $("stopRead").onclick = () => stopSpeaking();

  // Word lab speech buttons
  $("wlSpeakA").onclick = () => { if(state.word) speak(state.word, state.voiceA || state.voiceB); };
  $("wlSpeakB").onclick = () => { if(state.word) speak(state.word, state.voiceB || state.voiceA); };
  $("wlSlow").onclick = () => {
    if(!state.word) return;
    const old = state.rate;
    state.rate = 0.8;
    applyA11y();
    speak(state.word, state.voiceA || state.voiceB);
    state.rate = old;
    applyA11y();
  };
  $("wlSpell").onclick = () => { if(state.word) speak(state.word.split("").join(" "), state.voiceA || state.voiceB); };

  $("wlDefine").onclick = () => {
    const w = normalizeWord(state.word);
    if(!w) return;
    openLink("https://www.google.com/search?q=define+" + encodeURIComponent(w));
  };

  $("wlImages").onclick = () => {
    const w = normalizeWord(state.word);
    if(!w) return;
    openLink("https://www.bing.com/images/search?q=" + encodeURIComponent(w));
  };

  $("wlWiktionary").onclick = () => {
    const w = normalizeWord(state.word);
    if(!w) return;
    openLink("https://en.wiktionary.org/wiki/" + encodeURIComponent(w));
  };
  $("wlEtym").onclick = () => {
    const w = normalizeWord(state.word);
    if(!w) return;
    openLink("https://www.etymonline.com/search?q=" + encodeURIComponent(w));
  };
  $("wlThesaurus").onclick = () => {
    const w = normalizeWord(state.word);
    if(!w) return;
    openLink("https://www.thesaurus.com/browse/" + encodeURIComponent(w));
  };
  $("wlRhyme").onclick = () => {
    const w = normalizeWord(state.word);
    if(!w) return;
    openLink("https://www.rhymezone.com/r/rhyme.cgi?Word=" + encodeURIComponent(w) + "&typeofrhyme=perfect&org1=syl&org2=l&org3=y");
  };

  $("wlClap").onclick = () => {
    const w = normalizeWord(state.word);
    if(!w) return;
    const syl = syllableSplit(w);
    playClaps(syl.length || 1);
  };

  $("wlAddGloss").onclick = () => {
    const w = normalizeWord(state.word);
    if(!w) return;
    const note = prompt("Glossary note for: " + w + "\\n\\n(Meaning, Irish translation, example, etc.)", "");
    if(note === null) return;
    const arr = loadGloss();
    arr.push({ word: w, note: String(note||"").trim() });
    saveGloss(arr);
    renderGloss();
  };

  $("wlShowGloss").onclick = () => renderGloss();

  $("wlExportGloss").onclick = () => {
    const arr = loadGloss();
    const txt = arr.map(x => x.word + "\\t" + (x.note||"")).join("\\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aontas10-glossary.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 30_000);
  };

  $("wlClearGloss").onclick = () => {
    if(!confirm("Clear the saved glossary in this browser?")) return;
    saveGloss([]);
    renderGloss();
  };

  // Click a word
  $("readingBox").addEventListener("click", (e) => {
    const el = e.target && e.target.closest && e.target.closest(".word");
    if(!el) return;
    const w = el.getAttribute("data-word") || "";
    updateWordLab(w);
  });

  // Voices
  if("speechSynthesis" in window){
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  } else {
    $("voiceA").innerHTML = '<option value="">(no speech synthesis)</option>';
    $("voiceB").innerHTML = '<option value="">(no speech synthesis)</option>';
  }

  $("voiceA").onchange = (e) => { state.voiceA = e.target.value; saveSettings(); };
  $("voiceB").onchange = (e) => { state.voiceB = e.target.value; saveSettings(); };

  // Initial render
  $("fontSel").value = state.font;
  $("fs").value = state.fs;
  $("lh").value = state.lh;
  $("ls").value = state.ls;
  $("wlfs").value = state.wlfs;
  $("rate").value = state.rate;

  applyA11y();
  setMode(state.mode);
  renderReading();
  renderExercises();
  updateWordLab("");

})();
</script>
</body>
</html>`;
}
