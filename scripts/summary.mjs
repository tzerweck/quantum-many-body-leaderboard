// Recompute data/_summary.json from the FINAL data tree.
//
// emit.mjs used to write this file, which meant the counts only ever described the
// VarBench import: every row added afterwards by add_literature.mjs and
// add_sweep_rows.mjs was missing, and the README disagreed with the data it shipped.
// This runs last in build.sh instead, so one file has one writer and the counts are
// of what is actually on disk.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { recordEligible, exactEligible, isSampled, noErrorMetrics, publishedMethod, methodLabel } from "./units.mjs";

export function collect() {
  const instances = [];
  for (const m of fs.readdirSync("data")) {
    const dir = path.join("data", m);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir))
      instances.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  }
  return instances.sort((a, b) => a.instance_id.localeCompare(b.instance_id));
}

// A row's anchor id: the instance id, sanitised, and a hash of what the row claims. The
// table page puts it on the row and the committed figures link their marks to it. Not the
// row's position in its file: a row added or removed would shift every later link onto a
// different row without anything failing. A hash moves only with the row itself, and a
// figure left older than its data then links an id no row has, which site.mjs refuses to
// build. Identical rows would share a hash, so a repeat is numbered in file order (none
// exist as of 2026-09-16). The published method string, not the short name, so the ids that
// existed before the names (2026-09-17) still land on their rows.
const rowKey = r => `${r.energy}|${publishedMethod(r)}|${r.reference}`;
export function rowId(inst, r) {
  const key = rowKey(r), repeat = inst.rows.filter(x => rowKey(x) === key).indexOf(r);
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 8);
  return `r-${inst.instance_id.replace(/[^\w-]/g, "_")}-${hash}${repeat > 0 ? `-${repeat + 1}` : ""}`;
}

// The record for an instance is its state-of-the-art energy (RULES.md 6): the exact
// energy where the instance is solved, otherwise the lowest unflagged energy of any other
// kind, with or without an error bar. Eligibility itself lives in units.mjs and is not restated here - two copies of that
// rule would drift, and the one in units.mjs is what records.mjs already rules by.
// Returns null where no row qualifies: that is a real state of the table, not an
// error, and the README reports how often it happens.
//
// Before 2026-09-16 an exact row could never hold the record and a solved instance was
// reported as having "nothing to compete for". That inherited VarBench's use of exact
// energies as references for the V-score rather than as results, and it read as if
// exact diagonalization were not the state of the art on the instances it solves.
export function recordOf(inst) {
  return exactRecordOf(inst) ?? lowestEnergyOf(inst);
}

// The most precise eligible exact row, not the lowest: exact rows are estimates of one
// number, so among several the lowest is the luckiest, not the best. Exact
// diagonalization (no error bar) outranks sign-problem-free QMC, and a smaller error bar
// outranks a larger one; only then does the energy order them. Where two exact rows
// disagree beyond their stated precision that is a defect to raise on the row, not a
// ranking question.
export function exactRecordOf(inst) {
  return inst.rows.filter(exactEligible)
    .sort((a, b) => (a.sigma ?? 0) - (b.sigma ?? 0) || a.energy - b.energy)[0] ?? null;
}

// Lowest unflagged energy that is not exact - variational, projected or extrapolated: the
// record where no exact row exists, and the closest challenger where one does. The
// medal-table views count only instances where this IS the record (RULES.md 7).
export function lowestEnergyOf(inst) {
  return [...inst.rows].sort((a, b) => a.energy - b.energy).find(recordEligible) ?? null;
}

export function summarize(instances) {
  const s = {
    instances: instances.length, rows: 0,
    // The sector minima in an instance's `spectrum` (DATA.md) are levels, not results:
    // `rows` and every count by row leave them out, and they are counted here alone.
    spectrum_entries: 0,
    by_bound: {}, by_source: {}, by_provenance: {},
    vscore_rows: 0, no_variance: 0, no_sigma: 0, no_error_metrics: 0, flagged: 0,
    // Rows VarBench computed itself rather than collected from a paper, and the subset
    // of those that currently hold the record of an unsolved instance - i.e. where no
    // published result has ever beaten the benchmark's own reference run. VarBench's
    // own exact diagonalizations are baseline rows too and hold records, but "beatable"
    // is a question about unsolved instances, so they are not counted here.
    baseline_rows: 0, baseline_records: 0,
    // held_by_exact: the instance is solved and the exact energy is the record.
    // held_by_variational / _projected / _extrapolated: no exact row, so the lowest
    // unflagged energy is, and this is its kind.
    // The none_* keys say why an instance has neither, in the order they are tested.
    records: { held: 0, held_by_exact: 0, held_by_variational: 0, held_by_projected: 0, held_by_extrapolated: 0,
      none_flagged: 0, none_sector_only: 0, none_unclassified: 0, none_no_rows: 0 },
    // Unflagged sampled energies published without an error bar. They rank like any other
    // row (RULES.md 6, since 2026-10-08); an error bar would let close results share a rank.
    sampled_no_sigma: { rows: 0, instances: 0 },
    needs_review: [],
  };
  for (const inst of instances) {
    s.spectrum_entries += inst.spectrum?.length ?? 0;
    for (const r of inst.rows) {
      s.rows++;
      const key = r.bound_type || "needs-review";
      s.by_bound[key] = (s.by_bound[key] || 0) + 1;
      s.by_source[r.source] = (s.by_source[r.source] || 0) + 1;
      s.by_provenance[r.provenance] = (s.by_provenance[r.provenance] || 0) + 1;
      if (r.v_score != null) s.vscore_rows++;
      if (r.energy_variance == null || Number.isNaN(r.energy_variance)) s.no_variance++;
      if (r.sigma == null || Number.isNaN(r.sigma)) s.no_sigma++;
      if (noErrorMetrics(r)) s.no_error_metrics++;
      if (r.baseline) s.baseline_rows++;
      if (r.defect) s.flagged++;
      if (!r.bound_type) s.needs_review.push(`${inst.instance_id}: "${methodLabel(r)}"`);
    }
    const rec = recordOf(inst);
    const noSigmaHere = inst.rows.filter(r => r.bound_type !== "exact" && !r.defect && isSampled(r) && r.sigma == null).length;
    s.sampled_no_sigma.rows += noSigmaHere;
    if (noSigmaHere) s.sampled_no_sigma.instances++;

    if (rec) {
      s.records.held++;
      s.records[`held_by_${rec.bound_type}`]++;
      if (rec.baseline && rec.bound_type !== "exact") s.baseline_records++;
      continue;
    }
    // Same order as noRecordReason() in readme_table.mjs.
    s.records[`none_${noRecordKey(inst)}`]++;
  }
  return s;
}

// Why an instance has no record, as a key into summary.records. Since 2026-10-08 every
// unflagged row that is not a sector-resolved exact one can hold it, so only flags and
// missing rows leave an instance without. readme_table.mjs turns the key into the cell
// text, so the reasons under the table and the counts beneath it are one computation.
export function noRecordKey(inst) {
  if (inst.rows.some(r => r.defect)) return "flagged";
  if (inst.rows.some(r => r.bound_type === "exact")) return "sector_only";
  if (inst.rows.some(r => !r.bound_type)) return "unclassified";
  return "no_rows";
}

// Side effect only when run directly: readme_table.mjs imports collect/recordOf/summarize
// from here, and an import must not rewrite data/_summary.json as a surprise.
if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  const summary = summarize(collect());
  fs.writeFileSync("data/_summary.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}
