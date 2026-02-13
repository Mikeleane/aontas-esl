# Add-WordinessPartsOfSpeechGames.ps1
# Creates 3 Wordiness games (parts of speech / sentence structure / connectors) in public/wordiness
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Update-ManifestIfPresent([string]$ManifestPath, [object[]]$NewEntries) {
  if (!(Test-Path $ManifestPath)) {
    Write-Host "Info: No manifest.json found (skipping manifest update)."
    return
  }

  $raw = Get-Content $ManifestPath -Raw -Encoding UTF8
  $trim = $raw.TrimStart()
  $isArrayRoot = $trim.StartsWith("[")

  $obj = $raw | ConvertFrom-Json

  if ($isArrayRoot) {
    $list = @($obj)
    foreach ($e in $NewEntries) {
      if (-not ($list | Where-Object { $_.file -eq $e.file })) {
        $list += [pscustomobject]$e
      }
    }
    Write-Utf8NoBom $ManifestPath ($list | ConvertTo-Json -Depth 50)
    Write-Host "Updated manifest.json (array root)."
    return
  }

  # object root
  if (!($obj.PSObject.Properties.Name -contains "games")) {
    $obj | Add-Member -NotePropertyName games -NotePropertyValue @() -Force
  }

  $list2 = @($obj.games)
  foreach ($e in $NewEntries) {
    if (-not ($list2 | Where-Object { $_.file -eq $e.file })) {
      $list2 += [pscustomobject]$e
    }
  }
  $obj.games = $list2
  Write-Utf8NoBom $ManifestPath ($obj | ConvertTo-Json -Depth 50)
  Write-Host "Updated manifest.json (object root with games[])."
}

# --- Paths ---
$root = $PWD.Path
$pub  = Join-Path $root "public\wordiness"
if (!(Test-Path $pub)) { New-Item -ItemType Directory -Path $pub | Out-Null }

# Crest fallback: crest.png or kns-crest.jpg (page uses onerror fallback)
$crestPng = Join-Path $pub "crest.png"
$crestJpg = Join-Path $pub "kns-crest.jpg"
if (!(Test-Path $crestPng) -and !(Test-Path $crestJpg)) {
  Write-Host "Warning: no crest.png / kns-crest.jpg found in public/wordiness (logo will hide)."
}

# --- Shared CSS/JS (embedded so pages work offline) ---
$COMMON_CSS = @'
:root{
  --bg:#070b12; --card: rgba(255,255,255,.06); --text:#e9eefb; --muted: rgba(233,238,251,.72);
  --line: rgba(255,255,255,.12); --accent:#5ee7ff; --good:#35d07f; --bad:#ff5d7a;
  --shadow: 0 18px 60px rgba(0,0,0,.55); --r: 18px; --pad: 18px;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  background:
    radial-gradient(1000px 700px at 15% 10%, rgba(94,231,255,.18), transparent 55%),
    radial-gradient(900px 650px at 85% 30%, rgba(53,208,127,.16), transparent 55%),
    radial-gradient(900px 700px at 60% 100%, rgba(255,93,122,.10), transparent 55%),
    var(--bg);
  color:var(--text);
}
.wrap{max-width:1100px;margin:0 auto;padding:20px 14px 44px}
.top{display:flex;align-items:center;gap:12px;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px;min-width:0}
.brand img{width:34px;height:34px;border-radius:10px;object-fit:cover;box-shadow:0 6px 22px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.18)}
.h1{font-size:20px;font-weight:900;letter-spacing:.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{font-size:13px;color:var(--muted);margin-top:2px}
.pillrow{display:flex;gap:8px;flex-wrap:wrap}
.pill, button, select, input[type="range"]{
  border:1px solid var(--line);
  background: rgba(255,255,255,.05);
  color:var(--text);
  border-radius:999px;
  padding:10px 12px;
  font-size:14px;
}
select{padding:10px 12px}
button{cursor:pointer}
button.primary{
  background: linear-gradient(180deg, rgba(94,231,255,.18), rgba(94,231,255,.08));
  border-color: rgba(94,231,255,.35);
  box-shadow: 0 12px 30px rgba(0,0,0,.35);
  font-weight:800;
}
.card{
  background: var(--card);
  border:1px solid var(--line);
  border-radius: var(--r);
  box-shadow: var(--shadow);
  overflow:hidden;
}
.card .hd{
  padding: var(--pad);
  display:flex; align-items:flex-start; justify-content:space-between; gap:12px;
  border-bottom:1px solid rgba(255,255,255,.10);
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
}
.card .bd{padding: var(--pad)}
.title{font-weight:900;font-size:15px}
.hint{color:var(--muted);font-size:13px;margin-top:6px;line-height:1.35}
.bigGoal{font-size:18px;font-weight:950;letter-spacing:.2px;margin-top:6px}
.kpi{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.chip{padding:8px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background: rgba(0,0,0,.18);font-size:13px}
.grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}
@media (max-width: 900px){ .grid{grid-template-columns:1fr} }
.hr{height:1px;background:rgba(255,255,255,.10);margin:12px 0}
.tilewrap{display:flex;flex-wrap:wrap;gap:10px}
.tile{
  user-select:none;
  padding:12px 14px;
  border-radius: 14px;
  border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  min-height:44px;
  display:flex; align-items:center; justify-content:center;
  font-weight:800;
}
.tile:active{transform:scale(.99)}
.tile.good{outline:2px solid rgba(53,208,127,.55)}
.tile.bad{outline:2px solid rgba(255,93,122,.55)}
.slotrow{display:flex;gap:10px;flex-wrap:wrap;min-height:56px;align-items:center}
.slot{
  border:1px dashed rgba(255,255,255,.18);
  background: rgba(0,0,0,.14);
  border-radius: 14px;
  padding:12px 12px;
  min-height:52px;
  min-width:120px;
  display:flex; align-items:center; justify-content:center;
  color: rgba(233,238,251,.55);
  font-weight:800;
}
.slot.filled{border-style:solid;color:var(--text)}
.toast{
  position:fixed;left:50%;transform:translateX(-50%);
  bottom:18px;max-width:92vw;
  background: rgba(0,0,0,.72);
  border:1px solid rgba(255,255,255,.18);
  padding:12px 14px;border-radius:14px;
  box-shadow: 0 18px 50px rgba(0,0,0,.55);
  font-size:14px;color: var(--text);
  display:none;
}
.toast.show{display:block;animation:pop .18s ease-out}
@keyframes pop{from{transform:translateX(-50%) translateY(6px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
.small{font-size:12px;color:var(--muted)}
'@

$COMMON_JS = @'
(function(){
  const state = {
    tts: true, voice: null, voices: [], preferSlow: false,
    mode: (localStorage.getItem("wordiness_mode") || "supported")
  };

  function qs(sel, el){ return (el||document).querySelector(sel); }
  function qsa(sel, el){ return Array.from((el||document).querySelectorAll(sel)); }

  function toast(msg, kind){
    const t = qs("#toast"); if(!t) return;
    t.textContent = msg;
    t.style.borderColor = kind==="good" ? "rgba(53,208,127,.45)" : kind==="bad" ? "rgba(255,93,122,.45)" : "rgba(255,255,255,.18)";
    t.classList.add("show");
    clearTimeout(toast._to);
    toast._to = setTimeout(()=>t.classList.remove("show"), 1600);
  }

  function escapeHtml(s){
    return String(s||"").replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;" }[c]));
  }

  function loadVoices(){
    if(!("speechSynthesis" in window)) return;
    const all = speechSynthesis.getVoices() || [];
    state.voices = all;
    const sel = qs("#voiceSel");
    if(!sel) return;
    const prev = localStorage.getItem("wordiness_voice") || "";
    sel.innerHTML = '<option value="">Default voice</option>' + all.map(v=>`<option value="${escapeHtml(v.name)}">${escapeHtml(v.name)} (${v.lang})</option>`).join("");
    sel.value = all.some(v=>v.name===prev) ? prev : "";
    state.voice = sel.value ? (all.find(v=>v.name===sel.value) || null) : null;
  }

  function speak(text, opts){
    try{
      if(!state.tts) return;
      if(!("speechSynthesis" in window)) return;
      const u = new SpeechSynthesisUtterance(String(text||""));
      u.rate = (opts && opts.slow) ? 0.82 : 1.0;
      if(state.voice) u.voice = state.voice;
      speechSynthesis.cancel();
      setTimeout(()=>speechSynthesis.speak(u), 40);
    }catch(e){}
  }
  function stopSpeak(){ try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(e){} }

  function setMode(m){
    state.mode = m;
    localStorage.setItem("wordiness_mode", m);
    document.documentElement.dataset.mode = m;
  }

  function initTopbar(){
    setMode(state.mode);

    const mStd = qs("#modeStd"), mSup = qs("#modeSup");
    if(mStd) mStd.onclick = ()=>setMode("standard");
    if(mSup) mSup.onclick = ()=>setMode("supported");

    const ttsBtn = qs("#ttsBtn");
    if(ttsBtn){
      const saved = localStorage.getItem("wordiness_tts");
      state.tts = saved ? (saved==="1") : true;
      ttsBtn.textContent = "TTS: " + (state.tts ? "On" : "Off");
      ttsBtn.onclick = ()=>{
        state.tts = !state.tts;
        localStorage.setItem("wordiness_tts", state.tts ? "1" : "0");
        ttsBtn.textContent = "TTS: " + (state.tts ? "On" : "Off");
        toast(state.tts ? "Text-to-speech on" : "Text-to-speech off");
      };
    }

    const slowBtn = qs("#slowBtn");
    if(slowBtn){
      const saved2 = localStorage.getItem("wordiness_slow");
      state.preferSlow = saved2 ? (saved2==="1") : false;
      slowBtn.textContent = state.preferSlow ? "Voice: Slow" : "Voice: Normal";
      slowBtn.onclick = ()=>{
        state.preferSlow = !state.preferSlow;
        localStorage.setItem("wordiness_slow", state.preferSlow ? "1" : "0");
        slowBtn.textContent = state.preferSlow ? "Voice: Slow" : "Voice: Normal";
        toast(state.preferSlow ? "Slower voice" : "Normal voice");
      };
    }

    const stopBtn = qs("#stopBtn");
    if(stopBtn) stopBtn.onclick = ()=>{ stopSpeak(); toast("Stopped"); };

    const sel = qs("#voiceSel");
    if(sel){
      sel.onchange = ()=>{
        const name = sel.value || "";
        localStorage.setItem("wordiness_voice", name);
        state.voice = name ? (state.voices.find(v=>v.name===name) || null) : null;
        toast(name ? "Voice set" : "Default voice");
      };
    }

    loadVoices();
    if("speechSynthesis" in window){
      speechSynthesis.onvoiceschanged = loadVoices;
      setTimeout(loadVoices, 250);
    }
  }

  window.__WORDINESS__ = { qs, qsa, toast, speak, stopSpeak, state, escapeHtml, initTopbar };
})();
'@

function Build-Page([string]$Title, [string]$Subtitle, [string]$BodyHtml, [string]$BodyJs) {
@"
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>$Title</title>
<style>
$COMMON_CSS
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <div class="brand">
      <img src="crest.png" onerror="this.onerror=null; this.src='kns-crest.jpg';">
      <div>
        <div class="h1">$Title</div>
        <div class="sub">$Subtitle</div>
      </div>
    </div>
    <div class="pillrow">
      <span class="pill">Mode</span>
      <button class="pill" id="modeStd" type="button">Standard</button>
      <button class="pill" id="modeSup" type="button">Supported</button>
      <button class="pill" id="ttsBtn" type="button">TTS: On</button>
      <button class="pill" id="slowBtn" type="button">Voice: Normal</button>
      <select class="pill" id="voiceSel" aria-label="Voice"><option>Loading voices...</option></select>
      <button class="pill" id="stopBtn" type="button">Stop</button>
    </div>
  </div>

$BodyHtml
</div>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script>
$COMMON_JS
</script>
<script>
window.__WORDINESS__.initTopbar();
$BodyJs
</script>
</body>
</html>
"@
}

# ---------------------------
# Game 1: Sentence Builder Studio
# ---------------------------
$BODY1 = @'
<div class="grid">
  <div class="card">
    <div class="hd">
      <div>
        <div class="title">Goal</div>
        <div class="hint"><b>Tap tiles</b> to build a sentence. Tap a word in the sentence to remove it. Then press <b>Check</b>.</div>
        <div class="bigGoal" id="goalText">Press Start.</div>
      </div>
      <div class="kpi">
        <div class="chip">Score <b id="score">0</b></div>
        <div class="chip">Streak <b id="streak">0</b></div>
      </div>
    </div>
    <div class="bd">
      <div class="slotrow" id="sentenceSlots" aria-label="Sentence builder"></div>
      <div class="hr"></div>
      <div class="pillrow">
        <button class="primary" id="startBtn" type="button">Start round</button>
        <button id="checkBtn" type="button">Check</button>
        <button id="sayBtn" type="button">Hear sentence</button>
        <button id="clearBtn" type="button">Clear</button>
      </div>
      <div class="small" id="supportHint" style="margin-top:10px"></div>
    </div>
  </div>

  <div class="card">
    <div class="hd">
      <div>
        <div class="title">Tiles</div>
        <div class="hint">Choose a category, then tap words. Supported mode shows fewer tiles.</div>
      </div>
      <div class="kpi"><div class="chip" id="catChip">Subject</div></div>
    </div>
    <div class="bd">
      <div class="pillrow">
        <button class="pill" data-cat="S" type="button">Subject</button>
        <button class="pill" data-cat="V" type="button">Verb</button>
        <button class="pill" data-cat="O" type="button">Object</button>
        <button class="pill" data-cat="Adj" type="button">Adjective</button>
        <button class="pill" data-cat="Adv" type="button">Adverb</button>
        <button class="pill" data-cat="Con" type="button">Connector</button>
      </div>
      <div class="hr"></div>
      <div class="tilewrap" id="tiles"></div>
    </div>
  </div>
</div>
'@

$JS1 = @'
(function(){
  const {qs, qsa, toast, speak, state, escapeHtml} = window.__WORDINESS__;

  const BANK = {
    S: ["I","We","You","The child","My friend","The class","A dog","The teacher","The team","My family"],
    V: ["run","play","build","find","write","carry","choose","enjoy","remember","finish"],
    O: ["a game","the book","my lunch","a plan","the homework","a puzzle","the ball","a story","a word","the project"],
    Adj:["quick","careful","brave","tiny","curious","helpful","noisy","quiet","colourful","different"],
    Adv:["today","slowly","together","outside","again","carefully","quietly","now","later","always"],
    Con:["and","but","because","so","when","if","although"]
  };

  const GOALS = [
    {t:"Build: Subject + Verb", need:["S","V"], order:["S","V"]},
    {t:"Build: Subject + Verb + Object", need:["S","V","O"], order:["S","V","O"]},
    {t:"Add: Adjective", need:["S","V","Adj"], order:["S","Adj","V"]},
    {t:"Add: Adverb", need:["S","V","Adv"], order:["S","V","Adv"]},
    {t:"Use a connector to add a second idea", need:["S","V","Con"], order:["S","V","Con","S","V"]}
  ];

  let score=0, streak=0, goal=null, activeCat="S";
  let sentence=[]; // {w, cat}

  const elSlots = qs("#sentenceSlots");
  const elTiles = qs("#tiles");
  const elGoal  = qs("#goalText");
  const elScore = qs("#score");
  const elStreak= qs("#streak");
  const elHint  = qs("#supportHint");
  const elCatChip = qs("#catChip");

  function limitForMode(arr){
    if(state.mode==="standard") return arr;
    return arr.slice(0, Math.min(arr.length, 6));
  }

  function renderSlots(){
    elSlots.innerHTML = "";
    if(sentence.length===0){
      const s = document.createElement("div");
      s.className="slot";
      s.textContent="Tap tiles to build";
      elSlots.appendChild(s);
      return;
    }
    sentence.forEach((t, idx)=>{
      const d = document.createElement("button");
      d.type="button";
      d.className="slot filled";
      d.innerHTML = escapeHtml(t.w);
      d.title = "Tap to remove";
      d.onclick = ()=>{ sentence.splice(idx,1); renderSlots(); };
      elSlots.appendChild(d);
    });
  }

  function renderTiles(){
    elCatChip.textContent =
      activeCat==="S"?"Subject":
      activeCat==="V"?"Verb":
      activeCat==="O"?"Object":
      activeCat==="Adj"?"Adjective":
      activeCat==="Adv"?"Adverb":"Connector";

    elTiles.innerHTML="";
    const list = limitForMode(BANK[activeCat]||[]);
    list.forEach(w=>{
      const b = document.createElement("button");
      b.type="button";
      b.className="tile";
      b.textContent = w;
      b.onclick = ()=>{
        sentence.push({w, cat:activeCat});
        renderSlots();
        speak(w, {slow: state.preferSlow});
      };
      elTiles.appendChild(b);
    });
  }

  function pickGoal(){
    goal = GOALS[Math.floor(Math.random()*GOALS.length)];
    elGoal.textContent = goal.t;
    elHint.textContent = (state.mode==="supported") ? "Tip: Build left to right. Subject, then Verb, then extras." : "";
    toast("Round started", "good");
    speak(goal.t, {slow:true});
  }

  function hasCat(cat){ return sentence.some(t=>t.cat===cat); }
  function orderOk(order){
    let i=0;
    for(const tok of sentence){
      if(tok.cat===order[i]) i++;
      if(i>=order.length) return true;
    }
    return false;
  }

  function check(){
    if(!goal){ toast("Press Start first"); return; }
    const missing = goal.need.filter(c=>!hasCat(c));
    if(missing.length){
      streak=0; elStreak.textContent=String(streak);
      toast("Missing: " + missing.join(", "), "bad");
      speak("Missing " + missing.join(", "), {slow:true});
      return;
    }
    if(goal.order && !orderOk(goal.order)){
      streak=0; elStreak.textContent=String(streak);
      toast("Try the order in the goal", "bad");
      speak("Try the order", {slow:true});
      return;
    }
    score += 10 + Math.min(10, streak*2);
    streak += 1;
    elScore.textContent=String(score);
    elStreak.textContent=String(streak);
    toast("Success!", "good");
    speak("Nice job!", {slow: state.preferSlow});
    if(state.mode==="supported"){ sentence=[]; renderSlots(); }
    pickGoal();
  }

  function saySentence(){
    const txt = sentence.map(t=>t.w).join(" ").replace(/\s+/g," ").trim();
    if(!txt){ toast("Nothing to read yet"); return; }
    speak(txt, {slow: state.preferSlow});
  }

  function clearAll(){ sentence=[]; renderSlots(); toast("Cleared"); }

  qsa('button[data-cat]').forEach(btn=>{
    btn.onclick = ()=>{
      activeCat = btn.getAttribute("data-cat");
      qsa('button[data-cat]').forEach(b=>b.classList.remove("primary"));
      btn.classList.add("primary");
      renderTiles();
      toast("Tiles: " + btn.textContent);
    };
  });

  qs("#startBtn").onclick = pickGoal;
  qs("#checkBtn").onclick = check;
  qs("#sayBtn").onclick   = saySentence;
  qs("#clearBtn").onclick = clearAll;

  qsa('button[data-cat]').find(b=>b.getAttribute("data-cat")==="S").classList.add("primary");
  renderSlots(); renderTiles();
})();
'@

$f1 = Join-Path $pub "wordiness-sentence-builder-studio.html"
Write-Utf8NoBom $f1 (Build-Page "Wordiness - Sentence Builder Studio" "Tap-to-build sentences (structure + parts of speech)." $BODY1 $JS1)

# ---------------------------
# Game 2: Connector Switchboard
# ---------------------------
$BODY2 = @'
<div class="grid">
  <div class="card">
    <div class="hd">
      <div>
        <div class="title">Goal</div>
        <div class="hint">Pick a connector that makes the meaning clear, then press <b>Check</b>.</div>
        <div class="bigGoal" id="goalText">Press Start.</div>
      </div>
      <div class="kpi">
        <div class="chip">Score <b id="score">0</b></div>
        <div class="chip">Round <b id="round">0</b></div>
      </div>
    </div>
    <div class="bd">
      <div class="slotrow" id="sentence" style="align-items:flex-start"></div>
      <div class="hr"></div>
      <div class="pillrow">
        <button class="primary" id="startBtn" type="button">Start</button>
        <button id="checkBtn" type="button">Check</button>
        <button id="sayBtn" type="button">Hear</button>
        <button id="nextBtn" type="button">Next</button>
      </div>
      <div class="small" id="hintBox" style="margin-top:10px"></div>
    </div>
  </div>

  <div class="card">
    <div class="hd">
      <div>
        <div class="title">Connector options</div>
        <div class="hint">Supported mode shows fewer choices + a meaning hint.</div>
      </div>
      <div class="kpi"><div class="chip">Pick 1</div></div>
    </div>
    <div class="bd">
      <div class="tilewrap" id="choices"></div>
      <div class="hr"></div>
      <div class="small">Meaning types: <span class="chip">cause</span> <span class="chip">contrast</span> <span class="chip">time</span> <span class="chip">condition</span></div>
    </div>
  </div>
</div>
'@

$JS2 = @'
(function(){
  const {qs, toast, speak, state, escapeHtml} = window.__WORDINESS__;

  const ITEMS = [
    {a:"I wore a coat", b:"it was cold", ans:"because", type:"cause"},
    {a:"We can play outside", b:"it stops raining", ans:"if", type:"condition"},
    {a:"I wanted to go", b:"I was too tired", ans:"but", type:"contrast"},
    {a:"She practised", b:"she improved", ans:"so", type:"cause"},
    {a:"We packed our bags", b:"we left early", ans:"then", type:"time"},
    {a:"We will start", b:"everyone is ready", ans:"when", type:"time"},
    {a:"He smiled", b:"he was nervous", ans:"although", type:"contrast"}
  ];

  const CHOICES = [
    {w:"because", type:"cause"},
    {w:"so", type:"cause"},
    {w:"but", type:"contrast"},
    {w:"although", type:"contrast"},
    {w:"when", type:"time"},
    {w:"then", type:"time"},
    {w:"if", type:"condition"},
    {w:"and", type:"time"}
  ];

  let idx=0, score=0, round=0, selected=null, started=false;

  const elGoal = qs("#goalText");
  const elScore= qs("#score");
  const elRound= qs("#round");
  const elSentence= qs("#sentence");
  const elChoices= qs("#choices");
  const elHint= qs("#hintBox");

  function pick(){
    idx = Math.floor(Math.random()*ITEMS.length);
    selected=null;
    render();
  }

  function optionsForMode(){
    if(state.mode==="standard") return CHOICES;
    const it = ITEMS[idx];
    const ans = it.ans;
    const rel = CHOICES.filter(c=>c.w===ans);
    const sameType = CHOICES.filter(c=>c.type===it.type && c.w!==ans).slice(0,1);
    const other = CHOICES.filter(c=>c.type!==it.type).slice(0,2);
    return rel.concat(sameType).concat(other).sort(()=>Math.random()-.5);
  }

  function render(){
    const it = ITEMS[idx];
    elGoal.textContent = "Choose the best connector.";
    elSentence.innerHTML =
      '<div style="flex:1; min-width:260px"><div class="slot filled" style="justify-content:flex-start">' + escapeHtml(it.a) + '</div></div>' +
      '<div class="slot filled" style="min-width:140px">' + (selected ? escapeHtml(selected) : "____") + '</div>' +
      '<div style="flex:1; min-width:260px"><div class="slot filled" style="justify-content:flex-start">' + escapeHtml(it.b) + '</div></div>';

    elChoices.innerHTML="";
    optionsForMode().forEach(c=>{
      const b = document.createElement("button");
      b.type="button";
      b.className="tile" + (selected===c.w ? " good" : "");
      b.textContent = c.w;
      b.onclick = ()=>{
        selected = c.w;
        speak(c.w, {slow: state.preferSlow});
        render();
      };
      elChoices.appendChild(b);
    });

    if(state.mode==="supported"){
      elHint.textContent = "Hint: " + (it.type==="cause" ? "reason / result" : it.type==="contrast" ? "opposite / surprise" : it.type==="time" ? "when / next" : "rule / condition");
    } else elHint.textContent = "";

    elScore.textContent=String(score);
    elRound.textContent=String(round);
  }

  function check(){
    if(!started){ toast("Press Start"); return; }
    if(!selected){ toast("Pick a connector"); return; }
    const it=ITEMS[idx];
    if(selected===it.ans){
      score += 10; round += 1;
      toast("Correct!", "good");
      speak("Correct", {slow: state.preferSlow});
      pick();
    } else {
      score = Math.max(0, score-2);
      toast("Try again", "bad");
      speak("Try again", {slow:true});
      render();
    }
  }

  function say(){
    const it=ITEMS[idx];
    const conn = selected || it.ans;
    speak(it.a + " " + conn + " " + it.b, {slow: state.preferSlow});
  }

  qs("#startBtn").onclick = ()=>{ started=true; score=0; round=0; pick(); toast("Started","good"); };
  qs("#checkBtn").onclick = check;
  qs("#sayBtn").onclick   = say;
  qs("#nextBtn").onclick  = ()=>{ if(!started){toast("Press Start"); return;} pick(); };

  render();
})();
'@

$f2 = Join-Path $pub "wordiness-connector-switchboard.html"
Write-Utf8NoBom $f2 (Build-Page "Wordiness - Connector Switchboard" "Connect ideas with because / but / so / when / if ..." $BODY2 $JS2)

# ---------------------------
# Game 3: Parts of Speech Spotlight
# ---------------------------
$BODY3 = @'
<div class="grid">
  <div class="card">
    <div class="hd">
      <div>
        <div class="title">Goal</div>
        <div class="hint">Tap the words that match the target (verbs/nouns/adjectives/adverbs). Press <b>Check</b>.</div>
        <div class="bigGoal" id="goalText">Press Start.</div>
      </div>
      <div class="kpi">
        <div class="chip">Score <b id="score">0</b></div>
        <div class="chip">Round <b id="round">0</b></div>
      </div>
    </div>
    <div class="bd">
      <div class="pillrow">
        <button class="primary" id="startBtn" type="button">Start</button>
        <button id="checkBtn" type="button">Check</button>
        <button id="sayBtn" type="button">Hear</button>
        <button id="newBtn" type="button">New sentence</button>
      </div>
      <div class="small" id="hintBox" style="margin-top:10px"></div>
      <div class="hr"></div>
      <div class="tilewrap" id="words"></div>
    </div>
  </div>

  <div class="card">
    <div class="hd">
      <div>
        <div class="title">Support tools</div>
        <div class="hint">Spacing helps visual tracking (great on tablets).</div>
      </div>
      <div class="kpi"><div class="chip">Tweak</div></div>
    </div>
    <div class="bd">
      <div class="small">Font size</div>
      <input type="range" id="fs" min="14" max="26" value="18" style="width:100%">
      <div class="hr"></div>
      <div class="small">Word spacing</div>
      <input type="range" id="ws" min="6" max="22" value="10" style="width:100%">
      <div class="hr"></div>
      <div class="small">Supported mode: fewer distractors + a hint.</div>
    </div>
  </div>
</div>
'@

$JS3 = @'
(function(){
  const {qs, toast, speak, state} = window.__WORDINESS__;

  const SENTENCES = [
    {w:[
      {t:"The", p:"det"},{t:"curious", p:"adj"},{t:"child", p:"noun"},{t:"found", p:"verb"},{t:"a", p:"det"},{t:"tiny", p:"adj"},{t:"shell", p:"noun"},{t:"outside", p:"adv"}
    ], hint:"Verb = action word (found)"},
    {w:[
      {t:"We", p:"pron"},{t:"quickly", p:"adv"},{t:"packed", p:"verb"},{t:"our", p:"det"},{t:"bags", p:"noun"},{t:"because", p:"conj"},{t:"it", p:"pron"},{t:"was", p:"verb"},{t:"late", p:"adj"}
    ], hint:"Adverbs often end -ly (quickly)"},
    {w:[
      {t:"My", p:"det"},{t:"friend", p:"noun"},{t:"can", p:"verb"},{t:"carefully", p:"adv"},{t:"build", p:"verb"},{t:"a", p:"det"},{t:"model", p:"noun"}
    ], hint:"Verbs include helper verbs (can)"}
  ];

  const TARGETS = [
    {key:"verb", label:"verbs"},
    {key:"noun", label:"nouns"},
    {key:"adj",  label:"adjectives"},
    {key:"adv",  label:"adverbs"}
  ];

  let idx=0, target=null, score=0, round=0, started=false;
  let picks = new Set();

  const elGoal=qs("#goalText");
  const elWords=qs("#words");
  const elScore=qs("#score");
  const elRound=qs("#round");
  const elHint=qs("#hintBox");

  function pickRound(){
    idx = Math.floor(Math.random()*SENTENCES.length);
    target = TARGETS[Math.floor(Math.random()*TARGETS.length)];
    picks.clear();
    render();
    speak("Find " + target.label, {slow:true});
  }

  function currentWords(){
    const s = SENTENCES[idx];
    if(state.mode==="standard") return s.w;
    return s.w.filter(w=>w.p===target.key || w.p==="det" || w.p==="pron" || w.p==="conj");
  }

  function render(){
    const s = SENTENCES[idx];
    elGoal.textContent = "Find: " + (target ? target.label : "...");
    elHint.textContent = (state.mode==="supported" && s.hint) ? ("Hint: " + s.hint) : "";
    elScore.textContent=String(score);
    elRound.textContent=String(round);

    elWords.style.gap = (qs("#ws").value||10) + "px";
    elWords.style.fontSize = (qs("#fs").value||18) + "px";

    const words = currentWords();
    elWords.innerHTML="";
    words.forEach((w, i)=>{
      const b=document.createElement("button");
      b.type="button";
      b.className="tile" + (picks.has(i) ? " good" : "");
      b.textContent=w.t;
      b.onclick = ()=>{
        if(picks.has(i)) picks.delete(i); else picks.add(i);
        render();
        speak(w.t, {slow: state.preferSlow});
      };
      elWords.appendChild(b);
    });
  }

  function check(){
    if(!started){ toast("Press Start"); return; }
    const words = currentWords();
    let correct=0, wrong=0;
    words.forEach((w,i)=>{
      const picked = picks.has(i);
      if(picked && w.p===target.key) correct++;
      if(picked && w.p!==target.key) wrong++;
    });
    const totalTarget = words.filter(w=>w.p===target.key).length;

    if(correct===totalTarget && wrong===0){
      score += 10; round += 1;
      toast("Perfect!", "good");
      speak("Perfect", {slow: state.preferSlow});
      pickRound();
    } else {
      score = Math.max(0, score-1);
      toast("Got " + correct + "/" + totalTarget + ". Try again.", "bad");
      speak("Try again", {slow:true});
      Array.from(elWords.children).forEach((el,i)=>{
        const w=words[i];
        if(picks.has(i) && w.p!==target.key){ el.classList.add("bad"); setTimeout(()=>el.classList.remove("bad"), 650); }
      });
      elScore.textContent=String(score);
    }
    elRound.textContent=String(round);
  }

  function say(){
    const s=SENTENCES[idx];
    const txt = s.w.map(w=>w.t).join(" ").replace(/\s+/g," ").trim();
    speak(txt, {slow: state.preferSlow});
  }

  qs("#startBtn").onclick = ()=>{ started=true; score=0; round=0; pickRound(); toast("Started","good"); };
  qs("#checkBtn").onclick = check;
  qs("#newBtn").onclick   = ()=>{ if(!started){toast("Press Start"); return;} pickRound(); };
  qs("#sayBtn").onclick   = say;

  qs("#fs").oninput = render;
  qs("#ws").oninput = render;

  render();
})();
'@

$f3 = Join-Path $pub "wordiness-parts-of-speech-spotlight.html"
Write-Utf8NoBom $f3 (Build-Page "Wordiness - Parts of Speech Spotlight" "Find verbs, nouns, adjectives, adverbs (tap-to-select)." $BODY3 $JS3)

# Manifest update (optional)
$manifest = Join-Path $pub "manifest.json"
$newEntries = @(
  @{ file="wordiness-sentence-builder-studio.html"; title="Sentence Builder Studio"; desc="Tap-to-build sentences (structure + parts of speech)."; tags=@("grammar","parts-of-speech","sentence-structure","tts"); seedable=$false; order=1200 },
  @{ file="wordiness-connector-switchboard.html"; title="Connector Switchboard"; desc="Choose connectors (because/but/so/when/if) to link ideas."; tags=@("grammar","connectors","cohesion","tts"); seedable=$false; order=1210 },
  @{ file="wordiness-parts-of-speech-spotlight.html"; title="Parts of Speech Spotlight"; desc="Tap the words that match the target (verbs/nouns/adjectives/adverbs)."; tags=@("grammar","parts-of-speech","attention","tts"); seedable=$false; order=1220 }
)
Update-ManifestIfPresent $manifest $newEntries

Write-Host ""
Write-Host "Wrote:"
Write-Host " - public/wordiness/wordiness-sentence-builder-studio.html"
Write-Host " - public/wordiness/wordiness-connector-switchboard.html"
Write-Host " - public/wordiness/wordiness-parts-of-speech-spotlight.html"
Write-Host ""
Write-Host "Next:"
Write-Host "  npm run dev"
Write-Host "  open http://localhost:3000/wordiness"
