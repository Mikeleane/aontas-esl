/* KNS Wordiness Platform v1
   Shared content modes, teacher preferences, suitability checks and game status bar.
*/
(function () {
  "use strict";

  var SETTINGS_KEY = "wordiness_platform_settings_v1";
  var PACK_KEY = "wordiness_pack_seed_json";
  var ACTIVE_KEY = "wordiness_seed_json";
  var TEACHER_KEY = "wordiness_teacher_seed_json";


  var GUIDE_DATA = {
    "syllable-tiles-manual": {
      goal:"Build and blend a word from teacher-marked syllable chunks.",
      steps:["Hear the whole word.","Tap the chunks in order.","Blend the complete word and check it."],
      benefit:"Builds syllable awareness, decoding and confidence with longer words.",
      teacher:"Use teacher-reviewed divisions. The chunks are visual supports; browser TTS should model only the whole word.",
      audio:"Whole-word audio only. Do not treat isolated chunk TTS as a pronunciation model."
    },
    "syllable-tiles-smart": {
      goal:"Build a word from suggested visual chunks, then hear the whole word.",
      steps:["Choose a word.","Arrange or tap the chunks in order.","Check the word and hear it as a whole."],
      benefit:"Supports decoding, spelling memory and confident handling of multisyllabic vocabulary.",
      teacher:"Automatic chunking is a suggestion, not an answer key. Preview unfamiliar words before class.",
      audio:"Whole-word audio is safe. Suggested chunks remain visual unless reviewed by a teacher."
    },
    "calm-spell-lab": {
      goal:"Listen to a complete word and rebuild its spelling without rushing.",
      steps:["Hear the word.","Build or type it.","Check, then listen again if needed."],
      benefit:"Practises spelling, listening and working-memory strategies in a low-pressure format.",
      teacher:"Use short rounds. Helpful spelling chunks do not always equal spoken syllables.",
      audio:"The complete word may be spoken. Visual chunks should not be read as isolated sounds."
    },
    "connector-switchboard": {
      goal:"Choose the connector that makes the sentence relationship clear.",
      steps:["Read both parts.","Choose a connector.","Check why it fits."],
      benefit:"Develops cohesion, comprehension and awareness of cause, contrast, time and condition.",
      teacher:"This checks connector recognition, not independent sentence writing."
    },
    "focus-confusables": {
      goal:"Scan carefully and tap words containing the current target letters.",
      steps:["Read the target.","Scan one word at a time.","Tap matches and check your accuracy."],
      benefit:"Builds visual attention and careful letter-pattern scanning.",
      teacher:"This is a target hunt, not a diagnostic test of letter reversals."
    },
    "focus-finder": {
      goal:"Find every word in the text that matches the selected pattern.",
      steps:["Choose a pattern.","Tap matching words.","Check and notice the pattern in context."],
      benefit:"Combines rereading, visual attention, spelling patterns and vocabulary noticing.",
      teacher:"Choose a pattern with enough examples. The game now warns when a pattern is scarce."
    },
    "focus-order-finder": {
      goal:"Find letters or strings that appear in the exact requested order.",
      steps:["Read the target sequence.","Scan from left to right.","Tap the matching sequence."],
      benefit:"Practises serial attention, letter order and controlled visual scanning.",
      teacher:"Keep rounds short; this is letter-order practice rather than sentence word order."
    },
    "shapes-sounds": {
      goal:"Explore syllables, rhymes and letter patterns through three short activities.",
      steps:["Choose a tab.","Tap or drag the pieces.","Check the completed word or sound pattern."],
      benefit:"Links visual word structure with rhyme, syllable and spelling awareness.",
      teacher:"Use whole example words for sound modelling. A single vowel has no one reliable sound.",
      audio:"Letter names and whole words are safer than isolated phoneme TTS."
    },
    "morpheme-lego": {
      goal:"Build the new word that matches the clue by adding a prefix and/or suffix to the base word.",
      steps:["Read the clue and base word.","Tap a piece, then tap its slot.","Read the built word and press Check."],
      benefit:"Makes vocabulary and spelling more predictable by showing how meaningful word parts combine.",
      teacher:"Challenge mode has a fixed base. Free Build is exploratory and may create non-words.",
      audio:"Hear the complete built word. Rhythm beats may mark parts, but chunks are not spoken by TTS."
    },
    "morpheme-mixer": {
      goal:"Select the prefix, root and suffix that build the word described by the clue.",
      steps:["Read or hear the clue.","Tap a tile, then tap the matching slot.","Press Check, then Next."],
      benefit:"Strengthens morphological awareness, vocabulary and spelling-change awareness.",
      teacher:"Tap-to-place is the default. Dragging is optional where supported."
    },
    "next-tiny-step": {
      goal:"Turn an overwhelming task into one small action you can start now.",
      steps:["Write the task.","Break it into tiny steps.","Place steps in Now, Next and Later."],
      benefit:"Supports task initiation, planning and reduced working-memory load.",
      teacher:"This is an executive-function support tool, not a literacy assessment."
    },
    "parts-of-speech": {
      goal:"Tap the words that belong to the requested part of speech.",
      steps:["Read the target category.","Tap matching words.","Check and discuss tricky examples."],
      benefit:"Builds grammatical noticing in complete sentences.",
      teacher:"The sentence bank is curated. Pack text should only be added after reliable tagging or teacher review."
    },
    "sentence-builder": {
      goal:"Build a complete sentence that matches the displayed pattern.",
      steps:["Read the pattern.","Choose one tile for each required part.","Read the sentence aloud and check it."],
      benefit:"Supports sentence structure, oral rehearsal and syntactic awareness.",
      teacher:"Use feedback as guided practice, not as a complete grammar judgement."
    },
    "start-stop-reader": {
      goal:"Tap only when the word matches the rule.",
      steps:["Choose the rule and target.","Press Start Round.","Tap for matches and pause for non-matches."],
      benefit:"Practises scanning, inhibition, attention and rapid application of a word rule.",
      teacher:"Students already enjoy this game; keep the main play loop fast and familiar."
    },
    "wh-question-picker": {
      goal:"Choose the WH word that asks about the highlighted information.",
      steps:["Read the sentence.","Notice the highlighted information.","Choose Who, What, Where, When or Why."],
      benefit:"Builds question awareness and comprehension of information types.",
      teacher:"This identifies the question word; it does not require full question formation."
    },
    "word-order-rails": {
      goal:"Rebuild the sentence in its original meaningful order.",
      steps:["Read all word tiles.","Tap them in order.","Check, listen and try the next sentence."],
      benefit:"Practises syntax, sequencing and sentence memory using current class content.",
      teacher:"Supported mode can reduce choices or reveal a starting word without changing the target sentence."
    },
    "word-stress-dj": {
      goal:"Hear the whole word and tap the syllable with the strongest beat.",
      steps:["Press Hear word.","Tap the strongest syllable.","Use Hear rhythm after answering, then press Next."],
      benefit:"Develops awareness of word stress and rhythmic listening.",
      teacher:"Stress can vary by accent. Preview the selected voice and curate the word list.",
      audio:"Browser TTS speaks only the complete word. Rhythm is modelled with beats, never isolated chunk speech."
    },
    "word-stress-remix": {
      goal:"Compare whole words and match the requested stress pattern.",
      steps:["Hear word A and word B.","Listen to their beat patterns.","Choose the word that matches the target."],
      benefit:"Builds auditory discrimination and flexible awareness of stress patterns.",
      teacher:"Use curated words and classroom pronunciation. Avoid presenting TTS as the final authority.",
      audio:"Whole words plus non-speech rhythm only; written chunks are visual supports."
    },
    "working-memory-relay": {
      goal:"Remember a short word sequence and rebuild it in the same order.",
      steps:["Study the words.","Wait while they are hidden.","Rebuild the sequence from the mixed tiles."],
      benefit:"Practises working memory, sequencing and strategy use with familiar vocabulary.",
      teacher:"Supported mode changes load and timing, not the learning target."
    },
    "pace-phrase-reader": {
      goal:"Read a sentence in meaningful phrases, pausing where the ideas naturally group.",
      steps:["Tap Start.","Reveal one phrase at a time.","Read it smoothly, then tap Next phrase."],
      benefit:"Supports fluency, phrasing, punctuation awareness and comprehension.",
      teacher:"This is the fluency companion to Start–Stop Word Scanner; it does not replace that popular game.",
      audio:"TTS reads complete sentences or phrases that contain enough context; no isolated syllables."
    },
    "calm-speech": {
      goal:"Prepare, rehearse and say one useful sentence at a comfortable pace.",
      steps:["Read the sentence silently.","Hear the complete model if helpful.","Breathe, rehearse by phrases and tap I said it."],
      benefit:"Supports oral confidence, pacing, expressive phrasing and self-regulation.",
      teacher:"No microphone scoring is used. The learner reflects on effort and comfort rather than being judged by speech recognition.",
      audio:"The model is a complete sentence. Preview the browser voice before class."
    },
    "mystery-words": {
      goal:"Use context and gradual clues to identify a hidden word from the current text.",
      steps:["Read the sentence with the gap.","Reveal a clue only when needed.","Choose or type the word, then hear it in context."],
      benefit:"Develops vocabulary, prediction, spelling and use of context clues.",
      teacher:"Reward identifying which clue helped, not only guessing quickly.",
      audio:"The answer is spoken as a complete word and then inside its sentence."
    },
    "karaoke-reader": {
      goal:"Follow the highlighted words while listening or reading aloud at a comfortable pace.",
      steps:["Choose a paragraph.","Press Play.","Follow the highlight, pause or replay whenever needed."],
      benefit:"Supports tracking, fluency, repeated reading and confidence with longer text.",
      teacher:"Boundary highlighting varies by browser. The visual fallback is approximate and should not be used for phonics timing.",
      audio:"Complete sentence TTS only."
    },
    "rule-switch": {
      goal:"Respond to each word using the current rule, then adapt when the rule changes.",
      steps:["Read the rule.","Choose Yes or No for each word.","Watch for the Switch signal and apply the new rule."],
      benefit:"Practises cognitive flexibility, inhibition, attention and recovery after a rule change.",
      teacher:"Begin without a timer. Praise successful switching and self-correction."
    },
    "phrase-chunker": {
      goal:"Place phrase breaks where a sentence can be read in meaningful groups.",
      steps:["Read the whole sentence.","Tap gaps to add or remove phrase breaks.","Compare with a suggested phrasing and explain your choices."],
      benefit:"Builds fluent phrasing, syntax awareness and comprehension.",
      teacher:"More than one phrasing can be reasonable. Treat the model as a suggestion, not the only correct performance.",
      audio:"TTS reads the complete sentence and teacher-approved phrase groups, not isolated syllables."
    }
  };

  var DEFAULTS = {
    source: "pack",          // pack | builtin | teacher
    route: "standard",       // standard | supported
    voice: "",
    rate: "normal",          // normal | slow
    tts: true,
    support: "standard"      // standard | supported
  };

  function parse(value) {
    try { return JSON.parse(value); } catch (error) { return null; }
  }

  function readLocal(key) {
    try { return localStorage.getItem(key) || ""; } catch (error) { return ""; }
  }

  function writeLocal(key, value) {
    try {
      if (value === null || typeof value === "undefined") localStorage.removeItem(key);
      else localStorage.setItem(key, String(value));
    } catch (error) {}
  }

  function getBridge() {
    return window.__WORDINESS_SEED_BRIDGE__ || window.__WORDINESS__ || null;
  }

  function normaliseSeed(seed) {
    var bridge = getBridge();
    if (bridge && typeof bridge.normaliseSeed === "function") {
      return bridge.normaliseSeed(seed);
    }
    if (!seed || typeof seed !== "object") return null;
    return seed;
  }

  function getSettings() {
    var saved = parse(readLocal(SETTINGS_KEY)) || {};
    var settings = Object.assign({}, DEFAULTS, saved);
    if (!["pack", "builtin", "teacher"].includes(settings.source)) settings.source = "pack";
    if (!["standard", "supported"].includes(settings.route)) settings.route = "standard";
    if (!["standard", "supported"].includes(settings.support)) settings.support = settings.route;
    if (!["normal", "slow"].includes(settings.rate)) settings.rate = "normal";
    settings.tts = settings.tts !== false;
    return settings;
  }

  function saveSettings(patch) {
    var next = Object.assign({}, getSettings(), patch || {});
    writeLocal(SETTINGS_KEY, JSON.stringify(next));

    // Compatibility with the settings already used inside several games.
    writeLocal("wordiness_mode", next.support === "supported" ? "supported" : "standard");
    writeLocal("wordiness_tts", next.tts ? "1" : "0");
    writeLocal("wordiness_slow", next.rate === "slow" ? "1" : "0");
    if (next.voice) writeLocal("wordiness_voice", next.voice);

    applyPreferences(next);
    return next;
  }

  function splitSentences(text) {
    var flat = String(text || "").replace(/\s+/g, " ").trim();
    if (!flat) return [];
    return (flat.match(/[^.!?…]+(?:[.!?…]+(?=\s|$)|$)/gu) || [flat])
      .map(function (item) { return item.replace(/\s+/g, " ").trim(); })
      .filter(Boolean)
      .slice(0, 100);
  }

  function extractWords(text) {
    var found = String(text || "").match(/[\p{L}\p{M}]+(?:[’'-][\p{L}\p{M}]+)*/gu) || [];
    var seen = Object.create(null);
    return found.filter(function (raw) {
      var key = raw.toLocaleLowerCase();
      if (raw.length < 2 || seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 500);
  }

  function connectorsFrom(sentences) {
    var choices = ["even though", "as soon as", "because", "although", "however", "therefore", "while", "before", "after", "since", "when", "then", "but", "so", "if", "and", "or"];
    var output = [];
    (sentences || []).forEach(function (sentence) {
      if (output.length >= 80) return;
      var lower = sentence.toLocaleLowerCase();
      for (var i = 0; i < choices.length; i += 1) {
        var connector = choices[i];
        var index = lower.indexOf(" " + connector + " ");
        if (index < 0 && lower.indexOf(connector + " ") !== 0) continue;
        var actualIndex = index >= 0 ? index + 1 : 0;
        var before = sentence.slice(0, actualIndex).replace(/[\s,;:]+$/g, "").trim();
        var after = sentence.slice(actualIndex + connector.length).replace(/^[\s,;:]+/g, "").trim();
        if (before && after) output.push({ sentence: sentence, connector: connector, before: before, after: after });
        break;
      }
    });
    return output;
  }

  function makeSeed(text, meta) {
    var clean = String(text || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    var sentences = splitSentences(clean);
    var words = extractWords(clean);
    return normaliseSeed({
      version: 3,
      seedText: clean,
      text: clean,
      paragraphs: clean.split(/\n{2,}/g).map(function (x) { return x.replace(/\s+/g, " ").trim(); }).filter(Boolean),
      sentences: sentences,
      words: words,
      keyWords: words.filter(function (word) { return word.length >= 5; }).slice(0, 120),
      shortSentences: sentences.filter(function (sentence) {
        var count = extractWords(sentence).length;
        return count >= 4 && count <= 14;
      }).slice(0, 60),
      multisyllabicWords: words.filter(function (word) { return estimateSyllables(word) >= 2; }).slice(0, 160),
      spellingCandidates: words.filter(function (word) { return word.length >= 4 && word.length <= 12; }).slice(0, 160),
      structures: { connectors: connectorsFrom(sentences) },
      meta: Object.assign({ createdAt: new Date().toISOString() }, meta || {})
    });
  }

  function getBank() {
    return window.__WORDINESS_BANK__ && Array.isArray(window.__WORDINESS_BANK__.words)
      ? window.__WORDINESS_BANK__
      : { words: [], sentences: [], categories: {} };
  }

  function makeBuiltInSeed(route) {
    var bank = getBank();
    var text = (bank.sentences || []).join(" ");
    var seed = makeSeed(text, {
      source: "built-in-bank",
      title: "KNS Wordiness 500",
      mode: route === "supported" ? "SUPPORTED" : "standard",
      wordCount: (bank.words || []).length
    });
    if (seed) {
      seed.words = (bank.words || []).slice();
      seed.keyWords = seed.words.filter(function (word) { return word.length >= 5; }).slice(0, 200);
      seed.multisyllabicWords = seed.words.filter(function (word) { return estimateSyllables(word) >= 2; }).slice(0, 200);
      seed.spellingCandidates = seed.words.filter(function (word) { return word.length >= 4 && word.length <= 12; }).slice(0, 200);
    }
    return seed;
  }

  function getPackSeed() {
    var direct = normaliseSeed(parse(readLocal(PACK_KEY)));
    if (direct) return direct;
    var legacy = normaliseSeed(parse(readLocal(ACTIVE_KEY)));
    if (legacy && legacy.meta && legacy.meta.source === "reading-pack") return legacy;
    return null;
  }

  function getTeacherSeed() {
    return normaliseSeed(parse(readLocal(TEACHER_KEY)));
  }

  function setTeacherText(text, route) {
    var seed = makeSeed(text, {
      source: "teacher-text",
      title: "Teacher text",
      mode: route === "supported" ? "SUPPORTED" : "standard"
    });
    if (seed) writeLocal(TEACHER_KEY, JSON.stringify(seed));
    else writeLocal(TEACHER_KEY, null);
    return seed;
  }

  function getSeedForSource(source, route) {
    if (source === "builtin") return makeBuiltInSeed(route);
    if (source === "teacher") return getTeacherSeed();
    return getPackSeed();
  }

  function activateSource(source, route) {
    var seed = getSeedForSource(source, route);
    if (seed) {
      seed.meta = Object.assign({}, seed.meta || {}, {
        mode: route === "supported" ? "SUPPORTED" : "standard"
      });
      var bridge = getBridge();
      if (bridge && typeof bridge.setSeed === "function") bridge.setSeed(seed);
      else writeLocal(ACTIVE_KEY, JSON.stringify(seed));
    } else {
      writeLocal(ACTIVE_KEY, null);
    }
    saveSettings({ source: source, route: route, support: route });
    return seed;
  }

  function getActiveSeed() {
    if (/(?:^#|&)standalone=1(?:&|$)/i.test(String(location.hash || ""))) return null;
    var settings = getSettings();
    var selected = getSeedForSource(settings.source, settings.route);
    if (selected) return selected;
    var bridge = getBridge();
    return bridge && typeof bridge.getSeed === "function" ? bridge.getSeed() : null;
  }

  function estimateSyllables(word) {
    var value = String(word || "").toLocaleLowerCase().replace(/[^a-záéíóúüàèìòùâêîôûäëïöü]/g, "");
    if (!value) return 0;
    if (value.length <= 3) return 1;
    value = value.replace(/(?:[^laeiouy]e|ed|[^laeiouy]es)$/i, "").replace(/^y/, "");
    var groups = value.match(/[aeiouyáéíóúüàèìòùâêîôûäëïöü]+/g);
    return Math.max(1, groups ? groups.length : 1);
  }

  function wordCount(sentence) {
    return extractWords(sentence).length;
  }

  function analyse(seed) {
    seed = normaliseSeed(seed);
    var words = seed && Array.isArray(seed.words) ? seed.words : [];
    var sentences = seed && Array.isArray(seed.sentences) ? seed.sentences : [];
    var text = seed ? String(seed.seedText || seed.text || "") : "";
    var connectors = seed && seed.structures && Array.isArray(seed.structures.connectors)
      ? seed.structures.connectors
      : [];
    return {
      hasSeed: !!seed,
      textLength: text.length,
      words: words.length,
      sentences: sentences.length,
      shortSentences: sentences.filter(function (sentence) { var count = wordCount(sentence); return count >= 4 && count <= 14; }).length,
      connectors: connectors.length,
      multisyllabic: words.filter(function (word) { return estimateSyllables(word) >= 2; }).length,
      spelling: words.filter(function (word) { return word.length >= 4 && word.length <= 12; }).length,
      confusables: words.filter(function (word) { return /[bdpqmnilt]/i.test(word); }).length,
      orderWords: words.filter(function (word) { return word.length >= 4; }).length
    };
  }

  var REQUIREMENTS = {
    "syllable-tiles-smart": { key: "multisyllabic", min: 6, label: "6 suitable multisyllabic words" },
    "calm-spell-lab": { key: "spelling", min: 8, label: "8 spelling words" },
    "connector-switchboard": { key: "connectors", min: 3, label: "3 connector sentences" },
    "focus-confusables": { key: "confusables", min: 10, label: "10 target-letter words" },
    "focus-finder": { key: "textLength", min: 120, label: "a short reading text" },
    "focus-order-finder": { key: "orderWords", min: 10, label: "10 words of four letters or more" },
    "start-stop-reader": { key: "words", min: 20, label: "20 usable words" },
    "wh-question-picker": { key: "sentences", min: 5, label: "5 suitable sentences" },
    "word-order-rails": { key: "shortSentences", min: 5, label: "5 short sentences" },
    "working-memory-relay": { key: "words", min: 8, label: "8 usable words" },
    "pace-phrase-reader": { key: "sentences", min: 4, label: "4 readable sentences" },
    "calm-speech": { key: "shortSentences", min: 4, label: "4 short speaking sentences" },
    "mystery-words": { key: "spelling", min: 8, label: "8 mystery words" },
    "karaoke-reader": { key: "textLength", min: 120, label: "a short reading text" },
    "phrase-chunker": { key: "sentences", min: 4, label: "4 chunkable sentences" },
    "rule-switch": { key: "words", min: 15, label: "15 usable words" }
  };

  function readiness(gameId, seed) {
    var requirement = REQUIREMENTS[gameId];
    if (!requirement) return { state: "ready", count: 0, message: "Uses curated game content" };
    var stats = analyse(seed);
    if (!stats.hasSeed) return { state: "missing", count: 0, message: "Choose a content source" };
    var count = Number(stats[requirement.key] || 0);
    if (count >= requirement.min) return { state: "ready", count: count, message: count + " suitable items found" };
    if (count > 0) return { state: "limited", count: count, message: count + " found; built-in fallbacks may be added" };
    return { state: "limited", count: 0, message: "No suitable pack items; built-in fallbacks will be used" };
  }

  function getVoices() {
    if (!("speechSynthesis" in window)) return [];
    return (speechSynthesis.getVoices() || []).filter(function (voice) {
      return /^en([_-]|$)/i.test(voice.lang || "") || /English/i.test(voice.name || "");
    });
  }

  function chooseVoice(name) {
    var voices = getVoices();
    if (!voices.length) return null;
    if (name) {
      var exact = voices.find(function (voice) { return voice.name === name; });
      if (exact) return exact;
    }
    var preferred = voices.find(function (voice) { return /^en-IE$/i.test(voice.lang || ""); })
      || voices.find(function (voice) { return /^en-GB$/i.test(voice.lang || ""); })
      || voices.find(function (voice) { return /^en-US$/i.test(voice.lang || ""); });
    return preferred || voices[0];
  }

  function speak(text, options) {
    var settings = getSettings();
    if (!settings.tts || !("speechSynthesis" in window)) return false;
    var utterance = new SpeechSynthesisUtterance(String(text || ""));
    var voice = chooseVoice((options && options.voice) || settings.voice);
    if (voice) utterance.voice = voice;
    utterance.rate = options && options.rate ? options.rate : (settings.rate === "slow" ? 0.78 : 0.98);
    utterance.pitch = 1;
    try {
      speechSynthesis.cancel();
      setTimeout(function () { speechSynthesis.speak(utterance); }, 35);
      return true;
    } catch (error) { return false; }
  }


  function installSpeechDefaults() {
    if (!("speechSynthesis" in window) || window.__WORDINESS_SPEECH_PATCHED__) return;
    try {
      var originalSpeak = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = function (utterance) {
        var settings = getSettings();
        if (!settings.tts) return;
        if (utterance && !utterance.voice) {
          var preferred = chooseVoice(settings.voice);
          if (preferred) utterance.voice = preferred;
        }
        if (utterance && settings.rate === "slow" && (!utterance.rate || utterance.rate >= 0.9)) {
          utterance.rate = 0.78;
        }
        return originalSpeak(utterance);
      };
      window.__WORDINESS_SPEECH_PATCHED__ = true;
    } catch (error) {}
  }

  function applyPreferences(settings) {
    settings = settings || getSettings();
    if (!document || !document.documentElement) return;
    document.documentElement.dataset.wordinessSupport = settings.support;
    document.documentElement.dataset.wordinessRate = settings.rate;
    document.documentElement.classList.toggle("wordiness-supported", settings.support === "supported");
    document.documentElement.classList.toggle("wordiness-standard", settings.support !== "supported");
  }

  function labelSource(settings, seed) {
    if (settings.source === "builtin") return "Built-in 500-word bank";
    if (settings.source === "teacher") return "Teacher text";
    if (seed && seed.meta && seed.meta.title) return String(seed.meta.title);
    return "Reading Pack";
  }


  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function openGuide(gameId, title) {
    var guide = GUIDE_DATA[gameId] || {
      goal:"Complete the current challenge.",
      steps:["Read the instruction.","Try the task.","Check and use a hint if needed."],
      benefit:"Practises careful language learning through short, repeatable rounds.",
      teacher:"Preview the activity before class and keep the first round short."
    };
    var existing = document.getElementById("wordiness-guide-modal");
    if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "wordiness-guide-modal";
    modal.className = "wordiness-guide-modal";
    modal.innerHTML = '<div class="wordiness-guide-card" role="dialog" aria-modal="true" aria-labelledby="wordiness-guide-title">'
      + '<div class="wordiness-guide-head"><div><div class="wordiness-guide-kicker">Game guide</div><h2 id="wordiness-guide-title">'+escapeHtml(title || "Wordiness")+'</h2></div><button type="button" class="wordiness-guide-close" aria-label="Close guide">Close</button></div>'
      + '<section><h3>Your goal</h3><p>'+escapeHtml(guide.goal)+'</p></section>'
      + '<section><h3>How to play</h3><ol>'+guide.steps.map(function(step){return '<li>'+escapeHtml(step)+'</li>';}).join('')+'</ol></section>'
      + '<section><h3>Why this helps</h3><p>'+escapeHtml(guide.benefit)+'</p></section>'
      + '<details><summary>Teacher notes</summary><p>'+escapeHtml(guide.teacher || "")+'</p>'+(guide.audio?'<p class="wordiness-guide-audio"><strong>Audio safety:</strong> '+escapeHtml(guide.audio)+'</p>':'')+'</details>'
      + '</div>';
    document.body.appendChild(modal);
    function close(){ modal.remove(); }
    modal.addEventListener("click", function(event){ if(event.target === modal) close(); });
    modal.querySelector(".wordiness-guide-close").addEventListener("click", close);
    document.addEventListener("keydown", function esc(event){ if(event.key === "Escape"){ close(); document.removeEventListener("keydown", esc); } });
    setTimeout(function(){ var b=modal.querySelector(".wordiness-guide-close"); if(b) b.focus(); }, 0);
  }

  function playRhythm(pattern, options) {
    pattern = Array.isArray(pattern) ? pattern : [];
    if (!pattern.length) return false;
    options = options || {};
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try {
      var ctx = new AudioContextClass();
      var interval = Number(options.interval || 430) / 1000;
      pattern.forEach(function(accent, index){
        var start = ctx.currentTime + 0.05 + index * interval;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(accent ? 720 : 440, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(accent ? 0.14 : 0.075, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(start); osc.stop(start + 0.13);
      });
      setTimeout(function(){ try{ctx.close();}catch(error){} }, Math.ceil((pattern.length * interval + 0.6) * 1000));
      return true;
    } catch (error) { return false; }
  }

  function ensureGameBarStyles() {
    if (document.getElementById("wordiness-platform-styles")) return;
    var style = document.createElement("style");
    style.id = "wordiness-platform-styles";
    style.textContent = [
      ".wordiness-platform-bar{position:fixed;z-index:2147483000;left:10px;right:10px;bottom:8px;display:flex;align-items:center;gap:7px;min-height:42px;padding:6px 8px;border:1px solid rgba(17,32,48,.14);border-radius:14px;background:rgba(255,255,255,.96);box-shadow:0 10px 26px rgba(15,32,48,.18);font:700 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#142330;backdrop-filter:blur(10px)}",
      ".wordiness-platform-bar strong{font-weight:900}.wordiness-platform-bar__meta{display:flex;align-items:center;gap:6px;min-width:0;flex:1;flex-wrap:wrap}.wordiness-platform-pill{display:inline-flex;align-items:center;min-height:25px;padding:3px 7px;border-radius:999px;background:#eef3f6;color:#33414c;white-space:nowrap}.wordiness-platform-pill.is-supported{background:#e7f6eb;color:#0b6b32}.wordiness-platform-bar a,.wordiness-platform-bar button{min-height:30px;padding:5px 9px;border:1px solid #ccd8df;border-radius:9px;background:#fff;color:#142330;font:800 12px/1 system-ui;text-decoration:none;cursor:pointer}.wordiness-platform-bar button:hover,.wordiness-platform-bar a:hover{background:#f3f7f9}.wordiness-platform-bar__title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:28vw}",
      ".wordiness-guide-modal{position:fixed;z-index:2147483646;inset:0;background:rgba(4,15,28,.68);display:grid;place-items:center;padding:18px}.wordiness-guide-card{width:min(700px,100%);max-height:min(84vh,760px);overflow:auto;border-radius:22px;background:#fff;color:#142330;box-shadow:0 24px 80px rgba(0,0,0,.34);padding:22px;font:500 16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}.wordiness-guide-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:1px solid #e3eaee;padding-bottom:14px;margin-bottom:14px}.wordiness-guide-head h2{margin:2px 0 0;font-size:clamp(24px,4vw,34px);line-height:1.08}.wordiness-guide-kicker{text-transform:uppercase;letter-spacing:.12em;font-size:12px;font-weight:900;color:#35705a}.wordiness-guide-close{min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid #cbd6dc;background:#f7fafb;color:#142330;font-weight:800}.wordiness-guide-card section{padding:10px 0}.wordiness-guide-card h3{font-size:18px;margin:0 0 4px}.wordiness-guide-card p{margin:0}.wordiness-guide-card ol{margin:6px 0 0;padding-left:24px}.wordiness-guide-card li{margin:6px 0}.wordiness-guide-card details{margin-top:12px;border:1px solid #dbe5e9;border-radius:14px;background:#f7faf9;padding:12px 14px}.wordiness-guide-card summary{cursor:pointer;font-weight:900}.wordiness-guide-audio{margin-top:10px!important;padding:10px;border-radius:10px;background:#fff7dd}",
      ".wordiness-your-goal{margin:0 auto 14px;width:min(1180px,calc(100% - 24px));padding:12px 15px;border:1px solid rgba(80,160,125,.35);border-radius:14px;background:rgba(230,248,238,.96);color:#173a2b;font:700 15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif}.wordiness-your-goal strong{font-weight:950}.wordiness-settings-toggle{display:inline-flex;align-items:center;gap:6px}.wordiness-settings-panel[hidden]{display:none!important}",
      "html.wordiness-supported body{--wordiness-support-outline:3px solid rgba(28,147,74,.22)}",
      "@media(max-width:760px){.wordiness-platform-bar{left:5px;right:5px;bottom:5px}.wordiness-platform-bar__title{display:none}.wordiness-platform-pill:nth-of-type(n+3){display:none}.wordiness-platform-bar a,.wordiness-platform-bar button{padding:5px 7px}.wordiness-guide-modal{padding:8px}.wordiness-guide-card{padding:17px;border-radius:16px}}",
      "@media(prefers-reduced-motion:reduce){.wordiness-platform-bar *{scroll-behavior:auto!important;transition:none!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function mountGameBar(options) {
    options = options || {};
    if (document.getElementById("wordiness-platform-bar")) return;
    ensureGameBarStyles();
    var settings = getSettings();
    applyPreferences(settings);
    var seed = getActiveSeed();
    var bar = document.createElement("div");
    bar.id = "wordiness-platform-bar";
    bar.className = "wordiness-platform-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Wordiness game settings");

    var meta = document.createElement("div");
    meta.className = "wordiness-platform-bar__meta";

    var title = document.createElement("strong");
    title.className = "wordiness-platform-bar__title";
    title.textContent = options.title || document.title.replace(/^Wordiness\s*[—:-]?\s*/i, "") || "Wordiness";
    meta.appendChild(title);

    var source = document.createElement("span");
    source.className = "wordiness-platform-pill";
    source.textContent = labelSource(settings, seed);
    meta.appendChild(source);

    var route = document.createElement("span");
    route.className = "wordiness-platform-pill" + (settings.support === "supported" ? " is-supported" : "");
    route.textContent = settings.support === "supported" ? "Supported aids on" : "Standard play";
    meta.appendChild(route);

    if (options.gameId && REQUIREMENTS[options.gameId]) {
      var ready = readiness(options.gameId, seed);
      var status = document.createElement("span");
      status.className = "wordiness-platform-pill";
      status.textContent = ready.state === "ready" ? "Content ready ✓" : ready.message;
      meta.appendChild(status);
    }

    var guideData = GUIDE_DATA[options.gameId] || null;
    if (guideData && guideData.goal && !document.querySelector(".wordiness-your-goal")) {
      var goalStrip = document.createElement("div");
      goalStrip.className = "wordiness-your-goal";
      goalStrip.innerHTML = "<strong>Your goal:</strong> " + escapeHtml(guideData.goal);
      var first = document.body.firstElementChild;
      if (first) document.body.insertBefore(goalStrip, first); else document.body.appendChild(goalStrip);
    }

    var guide = document.createElement("button");
    guide.type = "button";
    guide.textContent = "Guide";
    guide.addEventListener("click", function(){ openGuide(options.gameId, options.title || title.textContent); });

    var sound = document.createElement("button");
    sound.type = "button";
    sound.textContent = settings.tts ? "Sound on" : "Sound off";
    sound.addEventListener("click", function () {
      settings = saveSettings({ tts: !getSettings().tts });
      sound.textContent = settings.tts ? "Sound on" : "Sound off";
      if (!settings.tts && "speechSynthesis" in window) speechSynthesis.cancel();
    });

    var hub = document.createElement("a");
    hub.href = "/wordiness";
    hub.textContent = "Hub";

    bar.appendChild(meta);
    bar.appendChild(guide);
    bar.appendChild(sound);
    bar.appendChild(hub);
    document.body.appendChild(bar);
    var currentPadding = parseFloat(getComputedStyle(document.body).paddingBottom || "0") || 0;
    document.body.style.paddingBottom = Math.max(currentPadding, 104) + "px";
  }

  var api = {
    SETTINGS_KEY: SETTINGS_KEY,
    PACK_KEY: PACK_KEY,
    ACTIVE_KEY: ACTIVE_KEY,
    TEACHER_KEY: TEACHER_KEY,
    getSettings: getSettings,
    saveSettings: saveSettings,
    makeSeed: makeSeed,
    makeBuiltInSeed: makeBuiltInSeed,
    getPackSeed: getPackSeed,
    getTeacherSeed: getTeacherSeed,
    setTeacherText: setTeacherText,
    getSeedForSource: getSeedForSource,
    activateSource: activateSource,
    getActiveSeed: getActiveSeed,
    analyse: analyse,
    readiness: readiness,
    estimateSyllables: estimateSyllables,
    getVoices: getVoices,
    chooseVoice: chooseVoice,
    speak: speak,
    playRhythm: playRhythm,
    openGuide: openGuide,
    guides: GUIDE_DATA,
    applyPreferences: applyPreferences,
    mountGameBar: mountGameBar,
    installSpeechDefaults: installSpeechDefaults
  };

  window.WordinessPlatform = api;
  applyPreferences(getSettings());
  installSpeechDefaults();
})();
