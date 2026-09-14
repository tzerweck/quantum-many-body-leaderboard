// Recompute data/_summary.json from the FINAL data tree.
//
// emit.mjs used to write this file, which meant the counts only ever described the
// VarBench import: every row added afterwards by add_literature.mjs and
// add_sweep_rows.mjs was missing, and the README disagreed with the data it shipped.
// This runs last in build.sh instead, so one file has one writer and the counts are
// of what is actually on disk.
import fs from "node:fs";
import path from "node:path";
import { recordEligible, isSampled, noErrorMetrics } from "./units.mjs";

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

// The record for an instance: lowest eligible variational energy (RULES.md 6, 6.1).
// Eligibility itself lives in units.mjs and is not restated here - two copies of that
// rule would drift, and the one in units.mjs is what records.mjs already rules by.
// Returns null where no row qualifies: that is a real state of the table, not an
// error, and the README reports how often it happens.
export function recordOf(inst) {
  return [...inst.rows].sort((a, b) => a.energy - b.energy).find(recordEligible) ?? null;
}

export function summarize(instances) {
  const s = {
    instances: instances.length, rows: 0,
    by_bound: {}, by_source: {}, by_provenance: {},
    vscore_rows: 0, no_variance: 0, no_sigma: 0, no_error_metrics: 0, flagged: 0,
    records: { held: 0, none_exact_only: 0, none_no_sigma: 0, none_other: 0 },
    // Sampled variational energies published without an error bar: listed, ranking for
    // nothing. `would_take_record` is the subset sitting below their instance's current
    // record, i.e. the rows where a single missing number is costing someone a record.
    blocked_on_sigma: { rows: 0, instances: 0, would_take_record: 0 },
    needs_review: [],
  };
  for (const inst of instances) {
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
      if (r.defect) s.flagged++;
      if (!r.bound_type) s.needs_review.push(`${inst.instance_id}: "${r.method}"`);
    }
    const rec = recordOf(inst);
    let blockedHere = 0;
    for (const r of inst.rows) {
      if (r.bound_type !== "variational" || r.defect || !isSampled(r.method) || r.sigma != null) continue;
      blockedHere++;
      if (!rec || r.energy < rec.energy) s.blocked_on_sigma.would_take_record++;
    }
    s.blocked_on_sigma.rows += blockedHere;
    if (blockedHere) s.blocked_on_sigma.instances++;

    if (rec) { s.records.held++; continue; }
    // Why an instance has no record decides whether it is an invitation or a fact of
    // life: a solved instance has nothing to compete for, whereas one blocked only by
    // a missing error bar becomes rankable the moment an author sends it.
    const blockedOnSigma = inst.rows.some(
      r => r.bound_type === "variational" && !r.defect && isSampled(r.method) && r.sigma == null);
    const hasExact = inst.rows.some(r => r.bound_type === "exact");
    if (blockedOnSigma) s.records.none_no_sigma++;
    else if (hasExact) s.records.none_exact_only++;
    else s.records.none_other++;
  }
  return s;
}

// Side effect only when run directly: readme_table.mjs imports collect/recordOf/summarize
// from here, and an import must not rewrite data/_summary.json as a surprise.
if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  const summary = summarize(collect());
  fs.writeFileSync("data/_summary.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
}
