# Add-WordinessFocusGames.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $enc = New-Object System.Text.UTF8Encoding($false)
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

$pub = Join-Path $PWD "public\wordiness"
if (!(Test-Path $pub)) { New-Item -ItemType Directory -Force -Path $pub | Out-Null }

# ---- Game 1: Confusables Hunt (p/b/d/q) ----
$game1 = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Wordiness: Confusables Hunt (p/b/d/q)</title>
  <style>
    :root{
      --bg:#070a12;
      --panel:rgba(255,255,255,.06);
      --stroke:rgba(255,255,255,.12);
      --text:rgba(238,242,255,.92);
      --muted:rgba(238,242,255,.68);
      --good:rgba(34,197,94,.9);
      --bad:rgba(239,68,68,.9);
      --tap:44px;
      --r:18px;
    }
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    html,body{height:100%}
    body{
      margin:0;
      background:radial-gradient(1200px 700px at 20% -10%, rgba(99,102,241,.25), transparent 55%),
                 radial-gradient(900px 600px at 90% 10%, rgba(56,189,248,.18), transparent 55%),
                 var(--bg);
      color:var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      min-height:100dvh;
      padding:16px 12px calc(16px + env(safe-area-inset-bottom,0px));
    }
    header{
      display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      max-width:1100px;margin:0 auto 12px;
    }
    .brand{
      display:flex;gap:10px;align-items:center;
      padding:10px 12px;border:1px solid var(--stroke);
      background:linear-gradient(to bottom, rgba(255,255,255,.07), rgba(255,255,255,.03));
      border-radius:20px;
      box-shadow:0 18px 50px rgba(0,0,0,.35);
      backdrop-filter: blur(10px);
    }
    .brand img{width:34px;height:34px;border-radius:10px;object-fit:contain}
    h1{margin:0;font-size:18px;letter-spacing:.2px}
    .sub{margin:2px 0 0;color:var(--muted);font-size:13px}
    .panel{
      max-width:1100px;margin:0 auto;
      border:1px solid var(--stroke);
      background:var(--panel);
      border-radius:22px;
      padding:14px;
      box-shadow:0 24px 70px rgba(0,0,0,.38);
      backdrop-filter: blur(10px);
    }
    .controls{
      display:grid;
      grid-template-columns: repeat(12, 1fr);
      gap:10px;
      margin-bottom:12px;
    }
    .control{
      grid-column: span 6;
      border:1px solid var(--stroke);
      background:rgba(0,0,0,.18);
      border-radius:16px;
      padding:10px 10px;
    }
    .control label{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;color:var(--muted)}
    .control input[type="range"]{width:100%}
    .row{
      display:flex;flex-wrap:wrap;gap:10px;align-items:center;
      padding-top:6px;
    }
    button, .chip{
      min-height:var(--tap);
      border-radius:999px;
      border:1px solid var(--stroke);
      background:rgba(255,255,255,.06);
      color:var(--text);
      padding:10px 12px;
      font-weight:650;
      letter-spacing:.15px;
      cursor:pointer;
      user-select:none;
      touch-action:manipulation;
    }
    button:hover{background:rgba(255,255,255,.09)}
    .chip{
      font-weight:700;
      background:rgba(0,0,0,.22);
    }
    .grid{
      display:grid;
      grid-template-columns: repeat(6, 1fr);
      gap:10px;
    }
    @media (max-width:900px){ .grid{grid-template-columns: repeat(4, 1fr);} }
    @media (max-width:620px){ .grid{grid-template-columns: repeat(2, 1fr);} }
    .word{
      min-height:54px;
      border-radius:16px;
      border:1px solid var(--stroke);
      background:rgba(0,0,0,.18);
      padding:12px 12px;
      display:flex;align-items:center;justify-content:center;
      text-align:center;
      font-size:18px;
      font-weight:750;
      letter-spacing:.4px;
      cursor:pointer;
      user-select:none;
    }
    .word.small{font-size:16px}
    .word.good{outline:3px solid rgba(34,197,94,.55); background:rgba(34,197,94,.10)}
    .word.bad{outline:3px solid rgba(239,68,68,.45); background:rgba(239,68,68,.10)}
    .footer{
      display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;
      margin-top:12px;
      color:var(--muted);
      font-size:13px;
    }
    .stat{display:flex;gap:10px;flex-wrap:wrap}
    .stat span{padding:6px 10px;border:1px solid var(--stroke);border-radius:999px;background:rgba(0,0,0,.18)}
    .hint{
      margin-top:8px;
      padding:10px 12px;
      border-radius:16px;
      border:1px dashed rgba(255,255,255,.18);
      background:rgba(0,0,0,.16);
      color:var(--muted);
      font-size:13px;
      line-height:1.35;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <img id="crest" src="/wordiness/crest.png" alt="Crest" />
      <div>
        <h1>Confusables Hunt</h1>
        <div class="sub">Tap the words that contain <b>p</b>, <b>b</b>, <b>d</b>, or <b>q</b>. Quick focus training + letter awareness.</div>
      </div>
    </div>
    <div class="brand" style="align-items:flex-end">
      <div style="text-align:right">
        <div class="sub">Wordiness</div>
        <div style="font-weight:800;font-size:14px">Focus Game 1</div>
      </div>
    </div>
  </header>

  <div class="panel">
    <div class="controls">
      <div class="control" style="grid-column: span 6;">
        <label>Mode <span id="modeLabel" class="chip">Standard</span></label>
        <div class="row">
          <button id="modeStandard" type="button">Standard</button>
          <button id="modeSupported" type="button">Supported</button>
          <span class="chip">Supported = fewer words + more time</span>
        </div>
      </div>

      <div class="control" style="grid-column: span 6;">
        <label>Round length <span id="timeLabel" class="chip">30s</span></label>
        <input id="timeRange" type="range" min="10" max="90" step="5" value="30" />
        <div class="row">
          <button id="startBtn" type="button">Start Round</button>
          <button id="newSetBtn" type="button">New Word Set</button>
          <button id="ttsBtn" type="button">TTS: Off</button>
        </div>
      </div>

      <div class="control" style="grid-column: span 6;">
        <label>Words on screen <span id="countLabel" class="chip">24</span></label>
        <input id="countRange" type="range" min="8" max="42" step="2" value="24" />
        <div class="row">
          <button id="rowScanBtn" type="button">Row Scan: Off</button>
          <span class="chip" id="targetsChip">Targets: p b d q</span>
        </div>
      </div>

      <div class="control" style="grid-column: span 6;">
        <label>Difficulty <span id="diffLabel" class="chip">Mixed</span></label>
        <div class="row">
          <button id="diffEasy" type="button">Easy</button>
          <button id="diffMixed" type="button">Mixed</button>
          <button id="diffHard" type="button">Hard</button>
        </div>
        <div class="hint">Easy uses shorter, familiar words. Hard adds longer distractors and more similar shapes.</div>
      </div>
    </div>

    <div id="grid" class="grid" aria-label="Word grid"></div>

    <div class="footer">
      <div class="stat">
        <span>Time: <b id="timeLeft">—</b></span>
        <span>Score: <b id="score">0</b></span>
        <span>Correct: <b id="correct">0</b></span>
        <span>Misses: <b id="misses">0</b></span>
      </div>
      <div class="stat">
        <span>Tip: scan left-to-right like reading.</span>
      </div>
    </div>
  </div>

<script>
(function(){
  const grid = document.getElementById('grid');
  const timeLeftEl = document.getElementById('timeLeft');
  const scoreEl = document.getElementById('score');
  const correctEl = document.getElementById('correct');
  const missesEl = document.getElementById('misses');

  const modeLabel = document.getElementById('modeLabel');
  const timeRange = document.getElementById('timeRange');
  const timeLabel = document.getElementById('timeLabel');
  const countRange = document.getElementById('countRange');
  const countLabel = document.getElementById('countLabel');
  const ttsBtn = document.getElementById('ttsBtn');
  const rowScanBtn = document.getElementById('rowScanBtn');

  const targets = ['p','b','d','q'];

  let speakOnClick = false;
  let rowScan = false;
  let difficulty = 'mixed';
  let running = false;
  let timer = null;
  let endAt = 0;

  let score = 0, correct = 0, misses = 0;

  const easyWords = [
    "bed","bad","pad","pig","big","dig","dip","quip","queen","back","duck","quip","drop","bake","pupil","pebble","quad","quack",
    "paper","rabbit","book","bubble","bread","panda","pocket","badge","puddle","cupboard","bucket","dragon"
  ];
  const hardWords = [
    "quadrilateral","disobedient","backpack","phosphorus","bandwidth","prodigious","debunked","equilibrium",
    "ambidextrous","suboptimal","pseudonym","quartermaster","breadcrumb","abductions","misplaced","backdrop",
    "debarked","doppelganger","biquadratic","compoundable","quadrupled","debriefing"
  ];
  const distractors = [
    "same","time","rain","train","stone","home","school","lunch","play","garden","winter","summer","music","story","friend","family",
    "castle","forest","river","mountain","teacher","classroom","library","planet","comet","orange","yellow"
  ];

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function containsAnyTarget(w){
    const s = w.toLowerCase();
    return targets.some(ch => s.includes(ch));
  }

  function speak(text){
    try{
      if(!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    }catch(e){}
  }

  function updateLabels(){
    timeLabel.textContent = timeRange.value + "s";
    countLabel.textContent = countRange.value;
  }

  function setMode(mode){
    if(mode === 'supported'){
      modeLabel.textContent = "Supported";
      // gentle defaults
      timeRange.value = Math.max(35, +timeRange.value);
      countRange.value = Math.min(20, +countRange.value);
    }else{
      modeLabel.textContent = "Standard";
    }
    updateLabels();
    buildGrid();
  }

  function setDifficulty(d){
    difficulty = d;
    document.getElementById('diffLabel').textContent = d === 'easy' ? 'Easy' : (d === 'hard' ? 'Hard' : 'Mixed');
    buildGrid();
  }

  function pickWords(n){
    let pool = [];
    if(difficulty === 'easy') pool = easyWords.concat(distractors);
    else if(difficulty === 'hard') pool = hardWords.concat(easyWords).concat(distractors);
    else pool = easyWords.concat(hardWords.slice(0, 10)).concat(distractors);

    // ensure enough targets appear: force ~40% target words
    const targetPool = pool.filter(containsAnyTarget);
    const nonPool = pool.filter(w => !containsAnyTarget(w));

    const targetCount = Math.max(3, Math.round(n * 0.42));
    const nonCount = Math.max(0, n - targetCount);

    const picked = [];
    shuffle(targetPool.slice()).slice(0, targetCount).forEach(w => picked.push(w));
    shuffle(nonPool.slice()).slice(0, nonCount).forEach(w => picked.push(w));

    return shuffle(picked);
  }

  function buildGrid(){
    const n = +countRange.value;
    const words = pickWords(n);
    grid.innerHTML = "";
    words.forEach((w, idx) => {
      const btn = document.createElement('div');
      btn.className = 'word' + (w.length>9 ? ' small':'' );
      btn.textContent = w;
      btn.dataset.word = w;
      btn.dataset.target = containsAnyTarget(w) ? "1" : "0";
      btn.dataset.hit = "0";
      btn.setAttribute('role','button');
      btn.setAttribute('tabindex','0');
      btn.addEventListener('click', () => onWordClick(btn));
      btn.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWordClick(btn);} });
      grid.appendChild(btn);
    });

    if(rowScan){
      // add subtle row separation by wrapping grid with background stripes
      grid.style.gap = "12px";
    } else {
      grid.style.gap = "10px";
    }
  }

  function onWordClick(el){
    const w = el.dataset.word || el.textContent;
    if(speakOnClick) speak(w);

    if(!running) return;

    if(el.dataset.hit === "1") return;
    el.dataset.hit = "1";

    if(el.dataset.target === "1"){
      correct++;
      score += 10;
      el.classList.add('good');
    }else{
      misses++;
      score = Math.max(0, score - 6);
      el.classList.add('bad');
    }
    updateStats();
  }

  function updateStats(){
    scoreEl.textContent = String(score);
    correctEl.textContent = String(correct);
    missesEl.textContent = String(misses);
  }

  function startRound(){
    running = true;
    score = 0; correct = 0; misses = 0;
    updateStats();
    // clear feedback classes
    Array.from(grid.children).forEach(el => { el.classList.remove('good','bad'); el.dataset.hit="0"; });

    const secs = +timeRange.value;
    endAt = Date.now() + secs*1000;
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 150);
  }

  function tick(){
    const ms = endAt - Date.now();
    const s = Math.max(0, Math.ceil(ms/1000));
    timeLeftEl.textContent = running ? (s + "s") : "—";
    if(running && ms <= 0){
      running = false;
      clearInterval(timer);
      timer = null;
      timeLeftEl.textContent = "Done";
    }
  }

  // controls wiring
  document.getElementById('modeStandard').addEventListener('click', () => setMode('standard'));
  document.getElementById('modeSupported').addEventListener('click', () => setMode('supported'));
  document.getElementById('startBtn').addEventListener('click', startRound);
  document.getElementById('newSetBtn').addEventListener('click', buildGrid);

  document.getElementById('diffEasy').addEventListener('click', () => setDifficulty('easy'));
  document.getElementById('diffMixed').addEventListener('click', () => setDifficulty('mixed'));
  document.getElementById('diffHard').addEventListener('click', () => setDifficulty('hard'));

  timeRange.addEventListener('input', updateLabels);
  countRange.addEventListener('input', () => { updateLabels(); buildGrid(); });

  ttsBtn.addEventListener('click', () => {
    speakOnClick = !speakOnClick;
    ttsBtn.textContent = "TTS: " + (speakOnClick ? "On" : "Off");
  });

  rowScanBtn.addEventListener('click', () => {
    rowScan = !rowScan;
    rowScanBtn.textContent = "Row Scan: " + (rowScan ? "On" : "Off");
    buildGrid();
  });

  // crest fallback
  const crest = document.getElementById('crest');
  crest.addEventListener('error', () => { crest.src = "/wordiness/crest.png"; }, { once:true });

  updateLabels();
  buildGrid();
})();
</script>
</body>
</html>
'@

# ---- Game 2: Order Finder (patterns like cdf / bac) ----
$game2 = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Wordiness: Order Finder (letter combos)</title>
  <style>
    :root{
      --bg:#070a12;
      --panel:rgba(255,255,255,.06);
      --stroke:rgba(255,255,255,.12);
      --text:rgba(238,242,255,.92);
      --muted:rgba(238,242,255,.68);
      --good:rgba(34,197,94,.9);
      --bad:rgba(239,68,68,.9);
      --tap:44px;
    }
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    html,body{height:100%}
    body{
      margin:0;
      background:radial-gradient(1200px 700px at 20% -10%, rgba(99,102,241,.25), transparent 55%),
                 radial-gradient(900px 600px at 90% 10%, rgba(56,189,248,.18), transparent 55%),
                 var(--bg);
      color:var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      min-height:100dvh;
      padding:16px 12px calc(16px + env(safe-area-inset-bottom,0px));
    }
    header{
      display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      max-width:1100px;margin:0 auto 12px;
    }
    .brand{
      display:flex;gap:10px;align-items:center;
      padding:10px 12px;border:1px solid var(--stroke);
      background:linear-gradient(to bottom, rgba(255,255,255,.07), rgba(255,255,255,.03));
      border-radius:20px;
      box-shadow:0 18px 50px rgba(0,0,0,.35);
      backdrop-filter: blur(10px);
    }
    .brand img{width:34px;height:34px;border-radius:10px;object-fit:contain}
    h1{margin:0;font-size:18px;letter-spacing:.2px}
    .sub{margin:2px 0 0;color:var(--muted);font-size:13px}
    .panel{
      max-width:1100px;margin:0 auto;
      border:1px solid var(--stroke);
      background:var(--panel);
      border-radius:22px;
      padding:14px;
      box-shadow:0 24px 70px rgba(0,0,0,.38);
      backdrop-filter: blur(10px);
    }
    .controls{
      display:grid;
      grid-template-columns: repeat(12, 1fr);
      gap:10px;
      margin-bottom:12px;
    }
    .control{
      grid-column: span 6;
      border:1px solid var(--stroke);
      background:rgba(0,0,0,.18);
      border-radius:16px;
      padding:10px 10px;
    }
    .control label{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13px;color:var(--muted)}
    .control input[type="range"]{width:100%}
    .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding-top:6px;}
    button, .chip{
      min-height:var(--tap);
      border-radius:999px;
      border:1px solid var(--stroke);
      background:rgba(255,255,255,.06);
      color:var(--text);
      padding:10px 12px;
      font-weight:650;
      cursor:pointer;
      user-select:none;
      touch-action:manipulation;
    }
    button:hover{background:rgba(255,255,255,.09)}
    .chip{font-weight:800;background:rgba(0,0,0,.22)}
    .grid{
      display:grid;
      grid-template-columns: repeat(6, 1fr);
      gap:10px;
    }
    @media (max-width:900px){ .grid{grid-template-columns: repeat(4, 1fr);} }
    @media (max-width:620px){ .grid{grid-template-columns: repeat(2, 1fr);} }
    .word{
      min-height:54px;
      border-radius:16px;
      border:1px solid var(--stroke);
      background:rgba(0,0,0,.18);
      padding:12px 12px;
      display:flex;align-items:center;justify-content:center;
      text-align:center;
      font-size:18px;
      font-weight:780;
      letter-spacing:.35px;
      cursor:pointer;
      user-select:none;
    }
    .word.small{font-size:16px}
    .word.good{outline:3px solid rgba(34,197,94,.55); background:rgba(34,197,94,.10)}
    .word.bad{outline:3px solid rgba(239,68,68,.45); background:rgba(239,68,68,.10)}
    .footer{
      display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;
      margin-top:12px;
      color:var(--muted);
      font-size:13px;
    }
    .stat{display:flex;gap:10px;flex-wrap:wrap}
    .stat span{padding:6px 10px;border:1px solid var(--stroke);border-radius:999px;background:rgba(0,0,0,.18)}
    .hint{
      margin-top:8px;
      padding:10px 12px;
      border-radius:16px;
      border:1px dashed rgba(255,255,255,.18);
      background:rgba(0,0,0,.16);
      color:var(--muted);
      font-size:13px;
      line-height:1.35;
    }
    .patternBox{
      display:flex;gap:8px;align-items:center;flex-wrap:wrap;
      padding:10px 12px;border-radius:16px;border:1px solid rgba(255,255,255,.16);
      background:rgba(0,0,0,.16);
      margin-bottom:10px;
    }
    .patternBig{
      font-size:20px;font-weight:900;letter-spacing:.8px;
      padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.20);
      background:rgba(255,255,255,.06);
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <img id="crest" src="/wordiness/crest.png" alt="Crest" />
      <div>
        <h1>Order Finder</h1>
        <div class="sub">Tap words that contain the pattern letters <b>in order</b> (like reading). Great for scanning + sequencing.</div>
      </div>
    </div>
    <div class="brand" style="align-items:flex-end">
      <div style="text-align:right">
        <div class="sub">Wordiness</div>
        <div style="font-weight:800;font-size:14px">Focus Game 2</div>
      </div>
    </div>
  </header>

  <div class="panel">
    <div class="patternBox">
      <span class="chip">Pattern:</span>
      <span id="patternDisplay" class="patternBig">bac</span>
      <span class="chip" id="modeDisplay">In-order</span>
      <span class="chip" id="ttsDisplay">TTS Off</span>
    </div>

    <div class="controls">
      <div class="control" style="grid-column: span 6;">
        <label>Mode <span class="chip">How strict?</span></label>
        <div class="row">
          <button id="modeInOrder" type="button">In-order (b…a…c)</button>
          <button id="modeExact" type="button">Exact substring (“bac”)</button>
        </div>
        <div class="hint">In-order: letters appear in sequence anywhere in the word. Exact: the letters must be adjacent.</div>
      </div>

      <div class="control" style="grid-column: span 6;">
        <label>Round length <span id="timeLabel" class="chip">35s</span></label>
        <input id="timeRange" type="range" min="10" max="90" step="5" value="35" />
        <div class="row">
          <button id="startBtn" type="button">Start Round</button>
          <button id="newPatternBtn" type="button">New Pattern</button>
          <button id="newSetBtn" type="button">New Word Set</button>
        </div>
      </div>

      <div class="control" style="grid-column: span 6;">
        <label>Words on screen <span id="countLabel" class="chip">24</span></label>
        <input id="countRange" type="range" min="8" max="42" step="2" value="24" />
        <div class="row">
          <button id="supportedBtn" type="button">Supported Defaults</button>
          <button id="ttsBtn" type="button">TTS: Off</button>
        </div>
      </div>

      <div class="control" style="grid-column: span 6;">
        <label>Patterns <span class="chip">classroom set</span></label>
        <div class="row">
          <button class="pat" data-p="cdf">cdf</button>
          <button class="pat" data-p="bac">bac</button>
          <button class="pat" data-p="str">str</button>
          <button class="pat" data-p="ght">ght</button>
          <button class="pat" data-p="tion">tion</button>
          <button class="pat" data-p="spr">spr</button>
        </div>
      </div>
    </div>

    <div id="grid" class="grid" aria-label="Word grid"></div>

    <div class="footer">
      <div class="stat">
        <span>Time: <b id="timeLeft">—</b></span>
        <span>Score: <b id="score">0</b></span>
        <span>Correct: <b id="correct">0</b></span>
        <span>Misses: <b id="misses">0</b></span>
      </div>
      <div class="stat">
        <span>Tip: point with your finger as you scan.</span>
      </div>
    </div>
  </div>

<script>
(function(){
  const grid = document.getElementById('grid');
  const timeLeftEl = document.getElementById('timeLeft');
  const scoreEl = document.getElementById('score');
  const correctEl = document.getElementById('correct');
  const missesEl = document.getElementById('misses');
  const patternDisplay = document.getElementById('patternDisplay');
  const modeDisplay = document.getElementById('modeDisplay');
  const ttsDisplay = document.getElementById('ttsDisplay');

  const timeRange = document.getElementById('timeRange');
  const timeLabel = document.getElementById('timeLabel');
  const countRange = document.getElementById('countRange');
  const countLabel = document.getElementById('countLabel');

  let pattern = "bac";
  let mode = "inorder"; // inorder | exact
  let speakOnClick = false;

  let running = false;
  let timer = null;
  let endAt = 0;

  let score = 0, correct = 0, misses = 0;

  const wordBank = [
    "backpack","alphabet","candle","decaf","codify","confident","cafeteria","cardiff","accident","pacific","abacus","bacon",
    "brace","bracket","cabbage","cabinet","scaffold","classified","certificate","difficult","deficit","doctor","factory","different",
    "strength","straight","street","straw","string","strange","stripes","light","night","bright","thought","brought","eight",
    "action","station","nation","fraction","motion","portion","caption","fiction","spray","spring","spread","sprout","surprise",
    "craft","draft","gift","shift","chest","castle","forest","friend","family","teacher","classroom","library","planet","comet"
  ];

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j=(Math.random()*(i+1))|0;
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function inOrderMatch(word, pat){
    word = word.toLowerCase();
    pat = pat.toLowerCase();
    let idx = 0;
    for(let i=0;i<word.length && idx<pat.length;i++){
      if(word[i] === pat[idx]) idx++;
    }
    return idx === pat.length;
  }

  function exactMatch(word, pat){
    return word.toLowerCase().includes(pat.toLowerCase());
  }

  function isTarget(word){
    return mode === "exact" ? exactMatch(word, pattern) : inOrderMatch(word, pattern);
  }

  function speak(text){
    try{
      if(!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    }catch(e){}
  }

  function updateLabels(){
    timeLabel.textContent = timeRange.value + "s";
    countLabel.textContent = countRange.value;
    patternDisplay.textContent = pattern;
    modeDisplay.textContent = (mode === "exact") ? "Exact" : "In-order";
    ttsDisplay.textContent = speakOnClick ? "TTS On" : "TTS Off";
  }

  function pickWords(n){
    // Ensure some targets appear by injecting
    const pool = shuffle(wordBank.slice());
    const targets = pool.filter(w => isTarget(w));
    const non = pool.filter(w => !isTarget(w));

    const wantTargets = Math.max(3, Math.round(n*0.35));
    const picked = [];
    shuffle(targets).slice(0, wantTargets).forEach(w => picked.push(w));
    shuffle(non).slice(0, Math.max(0, n - picked.length)).forEach(w => picked.push(w));
    return shuffle(picked);
  }

  function buildGrid(){
    const n = +countRange.value;
    const words = pickWords(n);
    grid.innerHTML = "";
    words.forEach(w => {
      const el = document.createElement('div');
      el.className = 'word' + (w.length>9 ? ' small':'' );
      el.textContent = w;
      el.dataset.word = w;
      el.dataset.target = isTarget(w) ? "1" : "0";
      el.dataset.hit = "0";
      el.setAttribute('role','button');
      el.setAttribute('tabindex','0');
      el.addEventListener('click', () => onClick(el));
      el.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(el);} });
      grid.appendChild(el);
    });
  }

  function onClick(el){
    const w = el.dataset.word || el.textContent;
    if(speakOnClick) speak(w);

    if(!running) return;
    if(el.dataset.hit === "1") return;
    el.dataset.hit = "1";

    if(el.dataset.target === "1"){
      correct++; score += 10;
      el.classList.add('good');
    } else {
      misses++; score = Math.max(0, score - 6);
      el.classList.add('bad');
    }
    scoreEl.textContent = String(score);
    correctEl.textContent = String(correct);
    missesEl.textContent = String(misses);
  }

  function startRound(){
    running = true;
    score = 0; correct = 0; misses = 0;
    scoreEl.textContent = "0";
    correctEl.textContent = "0";
    missesEl.textContent = "0";
    Array.from(grid.children).forEach(el => { el.classList.remove('good','bad'); el.dataset.hit="0"; });

    endAt = Date.now() + (+timeRange.value)*1000;
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 150);
  }

  function tick(){
    const ms = endAt - Date.now();
    const s = Math.max(0, Math.ceil(ms/1000));
    timeLeftEl.textContent = running ? (s + "s") : "—";
    if(running && ms <= 0){
      running = false;
      clearInterval(timer);
      timer = null;
      timeLeftEl.textContent = "Done";
    }
  }

  function newPattern(){
    const presets = ["cdf","bac","str","ght","tion","spr","mp","br","cl","gr","ch","sh","th","wh"];
    pattern = presets[(Math.random()*presets.length)|0];
    updateLabels();
    buildGrid();
  }

  // Controls
  document.getElementById('modeInOrder').addEventListener('click', () => { mode="inorder"; updateLabels(); buildGrid(); });
  document.getElementById('modeExact').addEventListener('click', () => { mode="exact"; updateLabels(); buildGrid(); });

  document.getElementById('startBtn').addEventListener('click', startRound);
  document.getElementById('newPatternBtn').addEventListener('click', newPattern);
  document.getElementById('newSetBtn').addEventListener('click', buildGrid);

  document.getElementById('supportedBtn').addEventListener('click', () => {
    timeRange.value = Math.max(40, +timeRange.value);
    countRange.value = Math.min(20, +countRange.value);
    updateLabels();
    buildGrid();
  });

  document.getElementById('ttsBtn').addEventListener('click', () => {
    speakOnClick = !speakOnClick;
    updateLabels();
  });

  document.querySelectorAll('button.pat').forEach(btn => {
    btn.addEventListener('click', () => {
      pattern = btn.dataset.p || pattern;
      updateLabels();
      buildGrid();
    });
  });

  timeRange.addEventListener('input', updateLabels);
  countRange.addEventListener('input', () => { updateLabels(); buildGrid(); });

  // crest fallback
  const crest = document.getElementById('crest');
  crest.addEventListener('error', () => { crest.src = "/wordiness/crest.png"; }, { once:true });

  updateLabels();
  buildGrid();
})();
</script>
</body>
</html>
'@

Write-Utf8NoBom (Join-Path $pub "wordiness-focus-confusables-pbdq.html") $game1
Write-Utf8NoBom (Join-Path $pub "wordiness-focus-order-finder.html") $game2

Write-Host "Wrote:"
Write-Host " - public/wordiness/wordiness-focus-confusables-pbdq.html"
Write-Host " - public/wordiness/wordiness-focus-order-finder.html"

# ---- Optional: add to manifest if it exists ----
$manifest = Join-Path $pub "manifest.json"
if (Test-Path $manifest) {
  $raw = Get-Content $manifest -Raw -Encoding UTF8
  $obj = $raw | ConvertFrom-Json

  if ($null -eq $obj.games) { $obj | Add-Member -NotePropertyName games -NotePropertyValue @() }

  function Add-Game([string]$file,[string]$title,[string]$desc,[string[]]$tags,[bool]$seedable,[int]$order){
    if ($obj.games | Where-Object { $_.file -eq $file }) { return }
    $obj.games += [pscustomobject]@{
      file = $file
      title = $title
      desc = $desc
      tags = $tags
      seedable = $seedable
      order = $order
    }
  }

  Add-Game "wordiness-focus-confusables-pbdq.html" "Confusables Hunt (p/b/d/q)" "Tap words containing p, b, d or q. Fast scanning + letter awareness." @("focus","dyslexia-friendly","letter-awareness","executive-function","tts") $false 1100
  Add-Game "wordiness-focus-order-finder.html" "Order Finder (letter combos)" "Tap words where the pattern letters appear in order (or exact mode)." @("focus","sequencing","executive-function","phonics","tts") $true 1110

  $json = $obj | ConvertTo-Json -Depth 20
  Write-Utf8NoBom $manifest $json
  Write-Host "Updated manifest.json"
} else {
  Write-Host "No manifest.json found under public/wordiness (skipped manifest update)."
}

Write-Host "Done."
