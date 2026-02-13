/**
 * Dedupe stage/cefrLevel re-declarations in generate-pack route.
 * Keeps the FIRST `let x =` and turns later `let x =` into `x =`.
 */
const fs = require("fs");

const file = "app/api/reading/generate-pack/route.tsx";
if (!fs.existsSync(file)) {
  console.error("Missing:", file);
  process.exit(1);
}

let s = fs.readFileSync(file, "utf8");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
fs.writeFileSync(file + ".bak_dedup_" + stamp, s, "utf8");

function dedupLet(name) {
  const re = new RegExp(`\\blet\\s+${name}\\s*=`, "g");
  let n = 0;
  s = s.replace(re, (m) => (n++ === 0 ? m : `${name} =`));
  return n;
}

function dedupConst(name) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=`, "g");
  let n = 0;
  s = s.replace(re, (m) => (n++ === 0 ? m : `${name} =`));
  return n;
}

const counts = {
  let_cefrLevel: dedupLet("cefrLevel"),
  let_stage: dedupLet("stage"),
  let_schoolClass: dedupLet("schoolClass"),
  let_klass: dedupLet("klass"),
  const_cefrLevel: dedupConst("cefrLevel"),
  const_stage: dedupConst("stage"),
  const_schoolClass: dedupConst("schoolClass"),
  const_klass: dedupConst("klass"),
};

fs.writeFileSync(file, s, "utf8");

console.log("✅ Patched:", file);
console.log("🧷 Backup:", file + ".bak_dedup_" + stamp);
console.log("Counts:", counts);
