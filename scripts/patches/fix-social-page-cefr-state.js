const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "social", "page.tsx");
let s = fs.readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";

const targetLine = '  const [cefrLevel, setCefrLevel] = useState<string>("B1");';

// 1) Remove ALL existing occurrences of the cefrLevel state line (bad placement etc)
const before = s;
s = s.split(eol).filter(line => line.trim() !== targetLine.trim()).join(eol);

// 2) Insert it right before tongueInCheek state
const needle = "const [tongueInCheek, setTongueInCheek]";
const idx = s.indexOf(needle);

if (idx === -1) {
  console.error("Could not find tongueInCheek state to anchor insertion.");
  process.exit(1);
}

// Insert at the beginning of the line containing needle
const lineStart = s.lastIndexOf(eol, idx);
const at = lineStart === -1 ? 0 : lineStart + eol.length;

s = s.slice(0, at) + targetLine + eol + s.slice(at);

fs.writeFileSync(file, s, "utf8");
console.log("✅ Fixed CEFR state placement in app/social/page.tsx");
