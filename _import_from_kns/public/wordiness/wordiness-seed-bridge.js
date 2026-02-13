/* wordiness-seed-bridge.js (v1)
   Games can call: window.__WORDINESS_SEED_BRIDGE__.getSeed()
   Sources (in order):
   - URL hash: #seed=BASE64URL(JSON)
   - localStorage: wordiness_seed_json
*/
(function(){
  var KEY = "wordiness_seed_json";

  function parseJson(s){
    try { return JSON.parse(s); } catch(e){ return null; }
  }

  function fromHash(){
    try{
      var h = String(location.hash || "");
      var m = h.match(/seed=([^&]+)/i);
      if(!m) return null;
      var b64url = decodeURIComponent(m[1]);
      var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      while(b64.length % 4) b64 += "=";
      var json = atob(b64);
      return parseJson(json);
    } catch(e){ return null; }
  }

  function fromLocal(){
    try { return parseJson(localStorage.getItem(KEY) || ""); } catch(e){ return null; }
  }

  function setSeed(seed){
    try { localStorage.setItem(KEY, JSON.stringify(seed || {})); } catch(e){}
  }

  function getSeed(){
    return fromHash() || fromLocal() || null;
  }

  window.__WORDINESS_SEED_BRIDGE__ = { KEY: KEY, getSeed: getSeed, setSeed: setSeed };
})();