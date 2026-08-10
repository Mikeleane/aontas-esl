/* Aontas ESL Wordiness seed bridge v2
   Legacy games can continue calling:
     window.__WORDINESS_SEED_BRIDGE__.getSeed()
   getSeed() always exposes BOTH text and seedText for the selected route.
   The stored payload remains schema-v2 with standard/supported variants.
*/
(function(){
  "use strict";
  var KEY = "wordiness_seed_json";

  function parseJson(value){
    try { return JSON.parse(String(value || "")); } catch (_) { return null; }
  }

  function cleanText(value){ return String(value || "").replace(/\s+/g, " ").trim(); }

  function splitSentences(text){
    var clean = cleanText(text);
    if(!clean) return [];
    return (clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
      .map(function(item){ return item.trim().replace(/\s+/g, " "); })
      .filter(Boolean)
      .slice(0, 100);
  }

  function extractWords(text){
    var matches = String(text || "").toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || [];
    var seen = Object.create(null), out = [];
    matches.forEach(function(word){
      if(out.length >= 500 || seen[word]) return;
      seen[word] = true; out.push(word);
    });
    return out;
  }

  function connectors(sentences){
    var list = ["because","although","however","therefore","while","when","if","but","so","then","and","or","before","after","unless","since"];
    var out = [];
    sentences.some(function(sentence){
      var lower = " " + sentence.toLowerCase() + " ";
      var found = list.find(function(item){ return lower.indexOf(" " + item + " ") >= 0; });
      if(found) out.push({ sentence: sentence, connector: found });
      return out.length >= 80;
    });
    return out;
  }

  function buildVariant(value){
    var source = value && typeof value === "object" ? value : {};
    var text = cleanText(source.text || source.seedText || value);
    var sentences = Array.isArray(source.sentences) && source.sentences.length ? source.sentences : splitSentences(text);
    var words = Array.isArray(source.words) && source.words.length ? source.words : extractWords(text);
    var rawStructures = source.structures && typeof source.structures === "object" ? source.structures : {};
    var rawConnectors = Array.isArray(rawStructures.connectors) ? rawStructures.connectors : connectors(sentences);
    return { text: text, seedText: text, sentences: sentences, words: words, structures: { connectors: rawConnectors } };
  }

  function parseVariant(value){
    var token = String(value || "").toLowerCase();
    return (token === "supported" || token === "adapted" || token === "b") ? "supported" : "standard";
  }

  function normalize(seed){
    seed = seed && typeof seed === "object" ? seed : {};
    var meta = seed.meta && typeof seed.meta === "object" ? seed.meta : {};
    var variants = seed.variants && typeof seed.variants === "object" ? seed.variants : {};
    var standardRaw = variants.standard || seed.standard || seed;
    var supportedRaw = variants.supported || seed.supported || seed.SUPPORTED || seed.adapted || standardRaw;
    var standard = buildVariant(standardRaw);
    var supported = buildVariant(supportedRaw);
    if(!standard.text && supported.text) standard = buildVariant(supported);
    if(!supported.text && standard.text) supported = buildVariant(standard);
    return {
      schemaVersion: 2,
      cefrLevel: String(seed.cefrLevel || meta.cefrLevel || "B1").toUpperCase(),
      textType: String(seed.textType || meta.textType || "article"),
      activeVariant: parseVariant(seed.activeVariant || meta.mode),
      variants: { standard: standard, supported: supported },
      meta: {
        createdAt: String(meta.createdAt || new Date().toISOString()),
        source: String(meta.source || "wordiness-bridge"),
        title: String(meta.title || "")
      }
    };
  }

  function decodeHashSeed(){
    try{
      var hash = String(location.hash || "");
      var match = hash.match(/(?:^|[&#])seed=([^&]+)/i);
      if(!match) return null;
      var b64url = decodeURIComponent(match[1]);
      var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      while(b64.length % 4) b64 += "=";
      var binary = atob(b64);
      var escaped = "";
      for(var i=0;i<binary.length;i++) escaped += "%" + ("00" + binary.charCodeAt(i).toString(16)).slice(-2);
      return parseJson(decodeURIComponent(escaped));
    }catch(_){ return null; }
  }

  function hashVariant(){
    var match = String(location.hash || "").match(/(?:^|[&#])variant=(standard|supported)/i);
    return match ? parseVariant(match[1]) : null;
  }

  function fromLocal(){
    try { return parseJson(localStorage.getItem(KEY) || ""); } catch (_) { return null; }
  }

  function getPack(){ return normalize(decodeHashSeed() || fromLocal() || {}); }

  function getSeed(){
    var pack = getPack();
    var mode = hashVariant() || pack.activeVariant || "standard";
    var selected = pack.variants[mode] || pack.variants.standard;
    return {
      schemaVersion: 2,
      cefrLevel: pack.cefrLevel,
      textType: pack.textType,
      activeVariant: mode,
      text: selected.text,
      seedText: selected.text,
      sentences: selected.sentences,
      words: selected.words,
      structures: selected.structures,
      standard: pack.variants.standard,
      supported: pack.variants.supported,
      meta: {
        createdAt: pack.meta.createdAt,
        source: pack.meta.source,
        title: pack.meta.title,
        mode: mode
      }
    };
  }

  function setSeed(seed){
    var pack = normalize(seed);
    try { localStorage.setItem(KEY, JSON.stringify(pack)); } catch (_) {}
    return pack;
  }

  function setVariant(variant){
    var pack = getPack();
    pack.activeVariant = parseVariant(variant);
    return setSeed(pack);
  }

  window.__WORDINESS_SEED_BRIDGE__ = {
    KEY: KEY,
    getPack: getPack,
    getSeed: getSeed,
    setSeed: setSeed,
    setVariant: setVariant,
    normalize: normalize
  };
})();
