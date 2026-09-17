// Apply corrections.mjs and verifications.mjs to the built rows. Runs after apply_relabels.mjs,
// apply_defects.mjs and apply_removals.mjs, whose matches are written against the uncorrected
// values, and before apply_method_names.mjs and validate.mjs, which must see the corrected ones.
//
// Every entry is matched against the rows as they stand BEFORE this script changes anything,
// so two corrections on one row (say energy and sigma) both match the original energy.
import fs from "node:fs";
import { CORRECTIONS } from "./corrections.mjs";
import { VERIFICATIONS } from "./verifications.mjs";
import { vScore, publishedMethod } from "./units.mjs";

const FIELDS = new Set(["energy", "sigma", "energy_variance", "dof", "einf", "method", "bound_type", "reference", "peer_reviewed", "provenance", "baseline", "defect"]);
const entries = [
  ...CORRECTIONS.map(e => ({ kind: "correction", ...e })),
  ...VERIFICATIONS.map(e => ({ kind: "verified", ...e })),
];

const byInstance = new Map();
for (const e of entries) {
  if (e.kind === "correction" && !FIELDS.has(e.field)) throw new Error(`correction on unknown field "${e.field}" (${e.match.instance})`);
  // A flag is lifted by correcting `defect` to null, so the lift is recorded on the row
  // (RULES.md 10). Anything else about a defect belongs in defects.mjs.
  if (e.kind === "correction" && e.field === "defect" && e.to !== null)
    throw new Error(`defect may only be corrected to null (${e.match.instance})`);
  if (!byInstance.has(e.match.instance)) byInstance.set(e.match.instance, []);
  byInstance.get(e.match.instance).push(e);
}

let corrected = 0, verified = 0, miss = 0;
for (const [id, list] of byInstance) {
  const p = `data/${id}.json`;
  if (!fs.existsSync(p)) { console.log(`MISS instance ${id}`); miss += list.length; continue; }
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  // resolve every match first, on the unmodified rows
  const resolved = list.map(e => [e, inst.rows.filter(r =>
    publishedMethod(r) === e.match.method && (e.match.energy == null || Math.abs(r.energy - e.match.energy) < 1e-9))]);
  for (const [e, rows] of resolved) {
    if (rows.length !== 1) { console.log(`MISS ${rows.length} rows match ${id} "${e.match.method}" ${e.match.energy ?? ""}`); miss++; continue; }
    const [r] = rows;
    const { match, kind, ...rec } = e;
    if (kind === "correction") {
      r.corrections = [...(r.corrections || []), { ...rec, from: r[e.field] }];
      r[e.field] = e.to;
      if (e.field === "bound_type") r.bound_type_reason = `corrected: ${e.reason}`;
      corrected++;
    } else {
      if (r.verified && r.provenance !== "imported") r.verified.second_read = rec;
      else r.verified = { ...rec, secondary_of: null };
      verified++;
    }
    // v_score is derived, never supplied (DATA.md): recompute from the row's final inputs
    r.v_score = vScore(r.energy_variance, r.dof, r.energy, r.einf);
  }
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`corrected ${corrected} fields, verified ${verified} rows, ${miss} unmatched`);
if (miss) process.exit(1);
