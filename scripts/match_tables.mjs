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
// Papers fetched as PDFs after the full-text scan are missing from sweep-fulltext.tsv, and
// without a title the lattice exclusion below cannot see what a paper is about: arXiv:
// 2010.03563's pyrochlore N = 64 energy matched a 64-site Hubbard instance, and they were
// all labelled preprints. The candidate pool carries title and review status for every one.
for (const r of tsv("sweep-candidates.tsv"))
  paperMeta[r.arxiv] ||= { pr: r.peer_reviewed, jr: r.journal_ref || "", ti: r.title || "" };
// Papers citing VarBench or the FTPS paper, fetched for the Impurity screen, are in neither
// file. A journal DOI (anything but arXiv's own 10.48550) marks a published version.
for (const r of tsv("sweep-cites.tsv").filter(r => r.arxiv))
  paperMeta[r.arxiv] ||= { pr: r.doi && !/^10\.48550\//i.test(r.doi) ? "yes" : "no", jr: r.venue || "", ti: r.title || "" };

// Which lattice/model words must appear for a cell to be about this instance.
const LATTICE_WORD = {
  triangular: /triangular/i, kagome: /kagome/i, pyrochlore: /pyrochlore/i,
  shuriken: /shuriken/i, "shastry-sutherland": /Shastry/i,
};
const instanceTokens = inst => {
  const t = new Set([`N=${inst.n_sites}`]);
  const lat = inst.lattice.toLowerCase();
  // On a chain the linear size IS the site count, and chain papers label their tables
  // with L far more often than with N. Without this every chain instance could only ever
  // be matched by a table that happened to say "N =", which no 1D paper does.
  if (lat === "chain") t.add(`L=${inst.n_sites}`);
  const m = lat.match(/(\d+)x(\d+)(?:x(\d+))?$/);          // rectangular-4x16, kagome-8x8
  if (m) t.add(m[0]);
  // L x L only when the lattice name states no dimensions of its own: rectangular-4x16 has
  // 64 sites but is not 8x8, and pyrochlore-4x4x4_256 is not 16x16.
  const r = Math.round(Math.sqrt(inst.n_sites));
  if (!m && r * r === inst.n_sites) { t.add(`${r}x${r}`); t.add(`L=${r}`); }
  const c = Math.round(Math.cbrt(inst.n_sites / 4));        // pyrochlore: 4 sites per cell
  if (lat.includes("pyrochlore") && 4 * c ** 3 === inst.n_sites) { t.add(`${c}x${c}x${c}`); t.add(`L=${c}`); }
  if (lat.includes("kagome") && inst.n_sites % 3 === 0) {   // kagome: 3 sites per cell
    const k = Math.round(Math.sqrt(inst.n_sites / 3));
    if (3 * k * k === inst.n_sites) { t.add(`${k}x${k}`); t.add(`L=${k}`); }
  }
  if (lat.includes("shuriken") && inst.n_sites % 6 === 0) { // shuriken: 6 sites per cell
    const k = Math.round(Math.sqrt(inst.n_sites / 6));
    if (6 * k * k === inst.n_sites) { t.add(`${k}x${k}`); t.add(`L=${k}`); }
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

// --- the coupling that names the instance ------------------------------------------
// Within a family, instances differ ONLY by a coupling: J1J2 by J2, tV by V, TFIsing by
// the transverse field h. Nothing checked it, so a cell matched on size alone - which is
// how one 4x4 spinless-fermion energy came back as a candidate for BOTH tV/square_16_P_5_0.01
// and tV/square_16_P_5_0.1, two different Hamiltonians. Same failure mode as the t' case
// in RULES.md 2, and higher volume: J1J2 is the largest family on the board and the
// 2026-09-14 PDF pass had to verify every J2 label by hand for exactly this reason.
//
// A table often states several values at once ("for J2 = 0.4, 0.6 and 0.8"), so all of
// them are collected: the cell survives if the instance's coupling is among them.
const COUPLING = {
  // NOT alpha: in an NQS paper "alpha = 1" is the hidden-unit density, not a coupling,
  // and treating it as J2 would reject most of the largest family on the board.
  J1J2:    { key: "J2", re: /(?:J\s*_?\{?2\}?\s*\/\s*J\s*_?\{?1\}?|J\s*_?\{?2\}?|J\s*['′]\s*\/\s*J)\s*[=:]\s*/gi },
  tV:      { key: "V",  re: /(?:V\s*\/\s*t|\bV\b)\s*[=:]\s*/gi },
  TFIsing: { key: "h",  re: /(?:h\s*\/\s*J|\bh\b|\bΓ\b|transverse[- ]field(?:\s+strength)?)\s*[=:]\s*/gi },
};
// values may be decimals or fractions, in a comma/"and"-separated list
const NUMLIST = /^\s*((?:[0-9]*\.?[0-9]+(?:\s*\/\s*[0-9]+)?)(?:\s*(?:,|and|&)\s*[0-9]*\.?[0-9]+(?:\s*\/\s*[0-9]+)?)*)/;
const asNum = s => { const f = s.match(/^([0-9.]+)\s*\/\s*([0-9.]+)$/); return f ? +f[1] / +f[2] : parseFloat(s); };

function statedCoupling(txt, spec) {
  const vals = [];
  spec.re.lastIndex = 0;
  for (const m of txt.matchAll(spec.re)) {
    const tail = txt.slice(m.index + m[0].length, m.index + m[0].length + 40);
    const l = tail.match(NUMLIST);
    if (!l) continue;
    for (const p of l[1].split(/\s*(?:,|and|&)\s*/)) {
      const v = asNum(p.trim());
      if (Number.isFinite(v)) vals.push(v);
    }
  }
  return vals;
}

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
// Certification papers (arXiv:2310.05844, 2604.01555) print SDP relaxation energies, which
// are LOWER bounds and sit below the ground state by construction - 83 false candidates,
// most of them "below the record". An explicit label or header decides; the caption only
// when those name no method, because a caption like "SDP lower bound compared to QMC"
// covers the reference columns too. A bare "QMC" header is the reference column of a
// variational paper, not its result.
const LOWER = /lower[- ]bound|\bE?SDP\b/i;
const cellKind = (txt, caption = "") =>
  LOWER.test(txt) ? "lower bound"
  : /\bED\b|exact diag|exact\b|\bDMRG.*m\s*=\s*∞|m\s*=\s*∞/i.test(txt) ? "exact/limit"
  : /extrap|zero[- ]?var|ξ\s*→\s*∞|→\s*∞/i.test(txt) ? "extrapolated"
  : /AFQMC|\bQMC\b|fixed[- ]node|\bGFMC\b|constrained/i.test(txt) ? "projected?"
  : LOWER.test(caption) ? "lower bound?"
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

// Papers rejected as a whole in SWEEP.md: every energy in them is a thermodynamic-limit
// value, so no cell can map onto a finite instance. They also keep resurfacing, because
// iPEPS tables are indexed by bond dimension and the harvester reads a bare "4" row label
// as a linear size - arXiv:2211.16932's chi_B = 4, 6, 8 rows match the 96-, 216- and
// 384-site shuriken clusters. Suppressed here, but counted in the summary.
//
// The two certification papers are here for the same reason, read 2026-09-15: every energy
// in them is an SDP lower bound or a reference value quoted from ED, DMRG, QMC or NQS work.
// The lower-bound rule below catches most of their cells, but layout mode glues the ratio
// column "(Eexact - ESDP)/|Eexact|" onto its neighbours, and 22 cells came out headed
// "|Eexact|" or "value" and passed as exact or variational.
const REJECTED = {
  "2211.16932": "iPEPS/iPESS on the infinite shuriken lattice",
  "2510.04907": "iPEPS on infinite triangular and kagome lattices",
  "2310.05844": "SDP lower bounds and quoted references",
  "2604.01555": "SDP lower bounds and quoted references",
};

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

    // Boundary conditions are part of the instance (RULES.md 2) and nothing checked them.
    // arXiv:2605.13807's transverse-field Ising chains are OPEN; matched on size alone its
    // N = 32 value came back as a candidate for TFIsing/chain_32_P_1, which is PERIODIC,
    // sitting 0.92% away - a gap that is the boundary condition, not an improvement.
    // Mixed boundaries (PA, PO) are skipped: a paper states those too rarely to test.
    const wantOpen = inst.boundary === "O", wantPeriodic = inst.boundary === "P";
    if (wantOpen || wantPeriodic) {
      const saysOpen = /\bOBC\b|open boundar|open chain|\bopen\b\s+(?:chain|lattice|system)/i.test(blob);
      const saysPeriodic = /\bPBC\b|periodic boundar|\btorus\b|periodic chain/i.test(blob);
      if (saysOpen && !saysPeriodic && wantPeriodic) continue;
      if (saysPeriodic && !saysOpen && wantOpen) continue;
    }

    // The coupling that distinguishes this instance from its siblings must agree, and
    // WHERE it is stated decides the question. A caption routinely enumerates every
    // value in the table ("J2 = 0.0, 0.2, 0.4, 0.6, 0.7"), so reading the caption alone
    // lets every column match every sibling instance. The column header is specific to
    // this cell and wins; the row label is next; the caption is only a fallback for
    // tables that have neither.
    let coupNote = "";
    const spec = COUPLING[inst.model];
    if (spec) {
      const want = inst.params?.[spec.key];
      let got = [], from = "";
      for (const [src, txt] of [["col", c.col], ["row", c.label], ["caption", c.caption]]) {
        got = statedCoupling(txt || "", spec);
        if (got.length) { from = src; break; }
      }
      if (want != null) {
        if (got.length && !got.some(v => Math.abs(v - want) < 1e-6)) continue;
        if (!got.length) coupNote = ` ${spec.key}=UNSTATED(instance ${spec.key}=${want})`;
        else if (from === "caption") coupNote = ` ${spec.key} from caption only`;
      }
    }
    // a plain Heisenberg instance is J2 = 0; a stated nonzero J2 is a different model
    if (inst.model === "Heisenberg") {
      const j2 = statedCoupling(blob, COUPLING.J1J2);
      if (j2.length && !j2.some(v => v === 0)) continue;
    }

    const rel = (c.value - recEps) / Math.abs(recEps);
    if (Math.abs(rel) > 0.01) continue;                                // different quantity
    hits.push({ inst: inst.instance_id, fresh, recEps, rec: rec.method, ...c, rel,
      // classify from the row label and column header - the caption names every method in
      // the table, so it is consulted only for lower bounds and only as a fallback
      kind: cellKind(`${c.label} ${c.col}`, c.caption), fillNote: fillNote + coupNote,
      verdict: c.value < recEps ? "BEATS" : "FILLS" });
  }
}

// one line per (instance, paper, value); drop exact repeats of the same number
const seen = new Set();
const all = hits.filter(h => {
  const k = `${h.inst}|${h.arxiv}|${h.value}`;
  return seen.has(k) ? false : (seen.add(k), true);
});
const suppressed = all.filter(h => REJECTED[h.arxiv]);
const bounds = all.filter(h => !REJECTED[h.arxiv] && h.kind.startsWith("lower bound"));
const uniq = all.filter(h => !REJECTED[h.arxiv] && !h.kind.startsWith("lower bound"));
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
if (suppressed.length) {
  const per = {};
  suppressed.forEach(h => (per[h.arxiv] = (per[h.arxiv] || 0) + 1));
  console.log(`${suppressed.length} candidates from rejected papers suppressed: ` +
    Object.entries(per).map(([id, n]) => `arXiv:${id} x${n} (${REJECTED[id]})`).join("; "));
}
if (bounds.length) {
  const per = {};
  bounds.forEach(h => (per[h.arxiv] = (per[h.arxiv] || 0) + 1));
  console.log(`${bounds.length} lower-bound cells left out: ` +
    Object.entries(per).map(([id, n]) => `arXiv:${id} x${n}`).join("; "));
}
