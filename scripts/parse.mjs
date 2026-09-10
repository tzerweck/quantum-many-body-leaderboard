import fs from "node:fs";
import path from "node:path";

const SRC = process.env.VB || "vendor/varbench";
const MODELS = ["Heisenberg", "Hubbard", "Impurity", "J1J2", "TFIsing", "tV"];

const splitCols = (s) =>
  s.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")
    .map((x) => x.trim().replace(/\s+/g, " "));

const REQUIRED = ["energy", "energy variance", "method"];

export function readTable(file) {
  const rows = [];
  let headers = null;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!headers) {
      const low = line.toLowerCase();
      if (REQUIRED.every((k) => low.includes(k))) headers = splitCols(line);
      continue;
    }
    if (!line || line.includes("---")) continue;
    const cols = splitCols(line);
    if (cols.every((c) => !c)) continue;
    while (cols.length < headers.length) cols.push("");
    const row = {};
    headers.forEach((h, i) => (row[h.toLowerCase()] = cols[i]));
    rows.push(row);
  }
  return { headers, rows };
}

// "0.79(3)" -> 0.79 ; "" -> null
export const num = (s) => {
  if (s == null) return null;
  const t = String(s).trim().replace(/\((\d+)\)$/, "");
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
};

export function instances() {
  const out = [];
  for (const m of MODELS) {
    const dir = path.join(SRC, m);
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".md") || f === "README.md") continue;
      out.push({ model: m, file: path.join(dir, f), stem: f.slice(0, -3) });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inst = instances();
  const methods = new Map();
  let nrows = 0, badEnergy = 0, noVar = 0, noSigma = 0;
  for (const it of inst) {
    const { rows } = readTable(it.file);
    for (const r of rows) {
      nrows++;
      const e = num(r["energy"]);
      if (e === null || Number.isNaN(e)) badEnergy++;
      const v = num(r["energy variance"]);
      if (v === null || Number.isNaN(v)) noVar++;
      const s = num(r["sigma"]);
      if (s === null || Number.isNaN(s)) noSigma++;
      const k = r["method"] || "(blank)";
      methods.set(k, (methods.get(k) || 0) + 1);
    }
  }
  console.log(`instances=${inst.length} rows=${nrows} bad_energy=${badEnergy} no_variance=${noVar} no_sigma=${noSigma}`);
  console.log(`distinct_method_strings=${methods.size}`);
  const sorted = [...methods].sort((a, b) => b[1] - a[1]);
  fs.writeFileSync("methods.txt", sorted.map(([k, c]) => `${String(c).padStart(4)}  ${k}`).join("\n") + "\n");
  console.log(sorted.slice(0, 45).map(([k, c]) => `${String(c).padStart(4)}  ${k}`).join("\n"));
}
