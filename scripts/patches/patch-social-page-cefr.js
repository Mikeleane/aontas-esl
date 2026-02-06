const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "social", "page.tsx");
if (!fs.existsSync(file)) {
  console.error("Missing file:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";
const changed = [];

function addOnce(label, fn) {
  const before = s;
  s = fn(s);
  if (s !== before) changed.push(label);
}

function insertAfterFirstMatch(regex, insert) {
  const m = s.match(regex);
  if (!m || m.index == null) return false;
  const idx = m.index + m[0].length;
  s = s.slice(0, idx) + insert + s.slice(idx);
  return true;
}

function insertBeforeSubstring(substr, insert) {
  const idx = s.indexOf(substr);
  if (idx === -1) return false;
  // insert at start of the line containing substr
  const lineStart = s.lastIndexOf(eol, idx);
  const at = lineStart === -1 ? 0 : lineStart + eol.length;
  s = s.slice(0, at) + insert + s.slice(at);
  return true;
}

addOnce("add cefrLevel state", (t) => {
  if (/const\s*\[\s*cefrLevel\s*,\s*setCefrLevel\s*\]/.test(t)) return t;

  const insert =
    '  const [cefrLevel, setCefrLevel] = useState<string>("B1");' + eol;

  // Try to place after first existing useState hook
  const re = /const\s*\[[^\]]+\]\s*=\s*useState[^\n]*\r?\n/;
  const m = t.match(re);
  if (m && m.index != null) {
    const idx = m.index + m[0].length;
    return t.slice(0, idx) + insert + t.slice(idx);
  }

  // Fallback: place after "use client" and imports (best effort)
  const impEnd = t.indexOf(eol + eol);
  if (impEnd !== -1) {
    return t.slice(0, impEnd + 2) + insert + t.slice(impEnd + 2);
  }

  return t + eol + insert;
});

addOnce("send cefrLevel to /api/social-thread", (t) => {
  const apiIdx = t.indexOf("/api/social-thread");
  if (apiIdx === -1) return t;

  const jsonIdx = t.indexOf("JSON.stringify", apiIdx);
  if (jsonIdx === -1) return t;

  const braceIdx = t.indexOf("{", jsonIdx);
  if (braceIdx === -1) return t;

  const look = t.slice(braceIdx, braceIdx + 200);
  if (look.includes("cefrLevel")) return t;

  return t.slice(0, braceIdx + 1) + " cefrLevel, " + t.slice(braceIdx + 1);
});

addOnce("add CEFR dropdown near tongueInCheek", (t) => {
  if (t.includes(">CEFR<") || t.includes("CEFR level")) return t;

  const block =
    '            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>' + eol +
    '              <span style={{ fontWeight: 800 }}>CEFR</span>' + eol +
    '              <select' + eol +
    '                value={cefrLevel}' + eol +
    '                onChange={(e) => setCefrLevel(e.target.value)}' + eol +
    '                style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid rgba(15,23,42,.18)" }}' + eol +
    '              >' + eol +
    '                {["A1","A2","B1","B2","C1","C2"].map((L) => (' + eol +
    '                  <option key={L} value={L}>{L}</option>' + eol +
    '                ))}' + eol +
    '              </select>' + eol +
    '            </label>' + eol;

  // Insert above first checkbox usage if possible
  const needle = "checked={tongueInCheek}";
  const idx = t.indexOf(needle);
  if (idx !== -1) {
    const lineStart = t.lastIndexOf(eol, idx);
    const at = lineStart === -1 ? 0 : lineStart + eol.length;
    return t.slice(0, at) + block + t.slice(at);
  }

  // fallback: don’t change JSX if we can’t place it safely
  return t;
});

if (!changed.length) {
  console.log("No changes needed (already patched).");
} else {
  fs.writeFileSync(file, s, "utf8");
  console.log("Patched:", changed.join(", "));
}
