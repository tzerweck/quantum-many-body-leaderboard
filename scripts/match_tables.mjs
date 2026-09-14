// Map harvested table cells (sweep-tables.tsv) onto QMBL instances and rank what is
// worth reading. This is the step that turns 2000 numbers into a worklist.
//
// A cell is a CANDIDATE for an instance when the paper is about that model and lattice
// and the cell's size token matches the instance's. It is then scored by where it sits
// relative to the instance's current record, in the instance's own per-site convention:
//
//   BEATS   below the record       -> a new record, or a convention error. Read it.
//   FILLS   within 1% above        -> a legitimate new row for a stale instance.
//   far     more than 1% off       -> almost always a different quantity. Suppressed.
//
// Nothing here writes a row. Unit conventions, boundary conditions and symmetry sectors
// are decided by reading the paper (RULES.md 2, 5); this only says which paper to open.
import fs from "node:fs";
import path from "node:path";
import { perSiteDivisor, recordEligible } from "./units.mjs";

const tsv = f => {
  const [h, ...rest] = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  const keys = h.split("\t");
  // trailing empty fields are dropped by split, so seed every key with ""
  return rest.map(l => {
    const c = l.split("\t");
    return Object.fromEntries(keys.map((k, i) => [k, c[i] ?? ""]));
  });
};

// paper-level model tags, for the many tables whose caption names no model
const paperModels = {}, paperMeta = {};
for (const r of tsv("sweep-fulltext.tsv")) {
  paperModels[r.arxiv] = r.models || "";
  paperMeta[r.arxiv] = { pr: r.peer_reviewed, jr: r.journal_ref || "", ti: r.title || "" };
}

// Which lattice/model words must appear for a cell to be about this instance.
const LATTICE_WORD = {
  triangular: /triangular/i, kagome: /kagome/i, pyrochlore: /pyrochlore/i,
  shuriken: /shuriken/i, "shastry-sutherland": /Shastry/i,
};
const instanceTokens = inst => {
  const t = new Set([`N=${inst.n_sites}`]);
  const lat = inst.lattice.toLowerCase();
  const m = lat.match(/(\d+)x(\d+)(?:x(\d+))?$/);          // rectangular-4x16, kagome-8x8
  if (m) t.add(m[0]);
  const r = Math.round(Math.sqrt(inst.n_sites));
  if (r * r === inst.n_sites) { t.add(`${r}x${r}`); t.add(`L=${r}`); }
  const c = Math.round(Math.cbrt(inst.n_sites / 4));        // pyrochlore: 4 sites per cell
  if (lat.includes("pyrochlore") && 4 * c ** 3 === inst.n_sites) { t.add(`${c}x${c}x${c}`); t.add(`L=${c}`); }
  if (lat.includes("kagome") && inst.n_sites % 3 === 0) {   // kagome: 3 sites per cell
    const k = Math.round(Math.sqrt(inst.n_sites / 3));
    if (3 * k * k === inst.n_sites) { t.add(`${k}x${k}`); t.add(`L=${k}`); }
  }
  return t;
};

// --- instance discipline (RULES.md 2) -------------------------------------------
// A Hubbard energy is only comparable at the same filling and the same t'. Both are
// stated in the caption or the column header, and getting either wrong manufactures a
// record: arXiv:2604.25775's t'=-0.2 column matches the t'=0 16x16 instance on size
// alone and sits 0.4% "below" its record, and the same paper's delta=1/8 number looks
// like a record against any instance with a different electron count.

// doping delta = 1 - n, where n = 2 Nf / Ns. Written as n_h, delta, or "1/8 doping".
const instanceDoping = inst =>
  inst.params?.Nf == null ? null : 1 - (2 * inst.params.Nf) / inst.n_sites;

const FRAC = /\b([0-9])\s*\/\s*([0-9]{1,2})\b/;
function statedDoping(txt) {
  const m = txt.match(/(?:n\s*_?\{?h\}?|\bdelta\b|δ|doping|hole density)\s*[=:]?\s*([0-9.]+|[0-9]\s*\/\s*[0-9]{1,2})/i);
  if (!m) return null;
  const f = m[1].match(FRAC);
  const v = f ? +f[1] / +f[2] : parseFloat(m[1]);
  return Number.isFinite(v) ? v : null;
}
// "half filling" / "half-filled" is delta = 0
const statedHalfFilling = txt => /half[- ]fill/i.test(txt);

// t' is 0 unless the instance id says otherwise; VarBench marks the variants _t12
const instanceTprime = inst => (/_t12/.test(inst.instance_id) ? "nonzero" : "zero");
function statedTprime(txt) {
  // ar5iv renders "t'=-0.2" with spaces around the minus: "t ′ = - 0.2"
  const m = txt.match(/t\s*['′]\s*(?:\/\s*t\s*)?=\s*(-?\s*[0-9.]+)/i);
  if (!m) return null;
  return parseFloat(m[1].replace(/\s+/g, "")) === 0 ? "zero" : "nonzero";
}

// A cell that is itself an exact reference or an extrapolation is not a variational
// record claim; it is still worth seeing, but labelled so it is never imported as one.
const cellKind = txt =>
  /\bED\b|exact diag|exact\b|\bDMRG.*m\s*=\s*∞|m\s*=\s*∞/i.test(txt) ? "exact/limit"
  : /extrap|zero[- ]?var|ξ\s*→\s*∞|→\s*∞/i.test(txt) ? "extrapolated"
  : /AFQMC|fixed[- ]node|\bGFMC\b|constrained/i.test(txt) ? "projected?"
  : "variational?";

const instances = [];
for (const m of fs.readdirSync("data")) {
  const d = path.join("data", m);
  if (!fs.statSync(d).isDirectory()) continue;
  for (const f of fs.readdirSync(d)) instances.push(JSON.parse(fs.readFileSync(path.join(d, f), "utf8")));
}

const cells = tsv("sweep-tables.tsv").map(c => ({
  ...c, value: +c.value, err: c.err ? +c.err : null,
  label: c.row_label, col: c.col_header,
}));
const hits = [];

for (const inst of instances) {
  const div = perSiteDivisor(inst);
  if (div == null) continue;
  const rec = [...inst.rows].sort((a, b) => a.energy - b.energy).find(recordEligible);
  if (!rec) continue;
  const recEps = rec.energy / div;
  const fresh = inst.rows.some(r => r.source !== "varbench@2024-10-22");
  const toks = instanceTokens(inst);
  const lat = inst.lattice.toLowerCase();
  const latRe = Object.entries(LATTICE_WORD).find(([k]) => lat.includes(k))?.[1] ?? null;

  for (const c of cells) {
    const tags = (c.models || paperModels[c.arxiv] || "");
    const blob = `${c.caption} ${c.label} ${c.col} ${paperMeta[c.arxiv]?.ti || ""}`;
    // model family must match
    if (inst.model === "Hubbard" && !/Hubbard/i.test(tags)) continue;
    if (inst.model === "TFIsing" && !/TFIsing/i.test(tags)) continue;
    if (inst.model === "tV" && !/tV/i.test(tags)) continue;
    if (inst.model === "J1J2" && !/J1J2/i.test(tags)) continue;
    if (inst.model === "Heisenberg" && !/Heisenberg|kagome|triangular|pyrochlore|shuriken/i.test(tags)) continue;
    // exotic lattices must be named somewhere; square/chain are the default and are not
    if (latRe && !latRe.test(blob) && !latRe.test(tags)) continue;
    if (!latRe && /kagome|pyrochlore|shuriken/i.test(blob)) continue;   // not our lattice
    // size must match
    if (![...toks].some(t => (c.sizes || "").split(",").includes(t))) continue;

    // Hubbard: filling and t' must agree, or the comparison is meaningless
    let fillNote = "";
    if (inst.model === "Hubbard" || inst.model === "tV") {
      const want = instanceDoping(inst);
      const got = statedDoping(blob);
      if (got != null && want != null) {
        if (Math.abs(got - want) > 0.005) continue;
      } else if (statedHalfFilling(blob) && want != null && Math.abs(want) > 0.005) {
        continue;
      } else if (got == null && !statedHalfFilling(blob)) {
        fillNote = ` filling=UNSTATED(instance delta=${want?.toFixed(4)})`;
      }
      const tp = statedTprime(blob);
      if (tp && tp !== instanceTprime(inst)) continue;
    }

    const rel = (c.value - recEps) / Math.abs(recEps);
    if (Math.abs(rel) > 0.01) continue;                                // different quantity
    hits.push({ inst: inst.instance_id, fresh, recEps, rec: rec.method, ...c, rel,
      // classify from the row label and column header only - the caption names every
      // method in the table, so including it marks every row "exact"
      kind: cellKind(`${c.label} ${c.col}`), fillNote,
      verdict: c.value < recEps ? "BEATS" : "FILLS" });
  }
}

// one line per (instance, paper, value); drop exact repeats of the same number
const seen = new Set();
const uniq = hits.filter(h => {
  const k = `${h.inst}|${h.arxiv}|${h.value}`;
  return seen.has(k) ? false : (seen.add(k), true);
});
uniq.sort((a, b) => (a.verdict === b.verdict ? a.rel - b.rel : a.verdict === "BEATS" ? -1 : 1));

console.log(`${cells.length} harvested cells x ${instances.length} instances -> ${uniq.length} candidates\n`);
for (const h of uniq) {
  const meta = paperMeta[h.arxiv] || {};
  console.log(`${h.verdict}  ${h.inst.padEnd(34)} ${h.value.toFixed(7)}${h.err ? `(${h.err})` : ""}  vs record ${h.recEps.toFixed(7)}  ${(h.rel * 100).toFixed(3)}%  [${h.kind}]${h.fillNote}`);
  console.log(`        arXiv:${h.arxiv} ${meta.pr === "yes" ? "PEER" : "prep"}  [${h.sizes}]  row="${h.label.slice(0, 46)}" col="${h.col.slice(0, 28)}"`);
  console.log(`        ${meta.ti?.slice(0, 96) || ""}`);
}
const byInst = {};
uniq.forEach(h => (byInst[h.inst] ||= []).push(h.verdict));
console.log(`\n${Object.keys(byInst).length} instances have at least one candidate; ${uniq.filter(h => h.verdict === "BEATS").length} cells sit below a current record.`);
