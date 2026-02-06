const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "app", "api", "social-thread", "route.ts");
let s = fs.readFileSync(file, "utf8");
const eol = s.includes("\r\n") ? "\r\n" : "\n";

const lines = s.split(/\r?\n/);

let fixed = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('"3) Keep Supported as access support') && !line.trim().endsWith('",') && !line.trim().endsWith('"')) {
    // Replace entire line with a safe, closed string + comma
    const indent = line.match(/^\s*/)?.[0] ?? "";
    lines[i] = indent + '"3) Keep Supported as access support (clearer language / shorter sentences / scaffolds) WITHOUT changing the learning target AND WITHOUT downgrading the CEFR level.",';
    fixed++;
  }

  // Also catch the case where the line ends with a period but still no closing quote
  if (line.includes('"3) Keep Supported as access support') && line.trim().endsWith("CEFR level.") && !line.trim().endsWith('".') && !line.includes('",')) {
    const indent = line.match(/^\s*/)?.[0] ?? "";
    lines[i] = indent + '"3) Keep Supported as access support (clearer language / shorter sentences / scaffolds) WITHOUT changing the learning target AND WITHOUT downgrading the CEFR level.",';
    fixed++;
  }

  // If it already has the content but missing the comma, normalize
  if (line.includes('"3) Keep Supported as access support') && line.trim().endsWith('"') && !line.trim().endsWith('",')) {
    lines[i] = line + ",";
    fixed++;
  }
}

const out = lines.join(eol);
fs.writeFileSync(file, out, "utf8");
console.log("✅ Fixed unterminated Supported string. Lines changed:", fixed);
