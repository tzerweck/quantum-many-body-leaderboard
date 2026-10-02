// Apply corrections.mjs and verifications.mjs to the built rows. Runs after apply_relabels.mjs,
// apply_defects.mjs and apply_removals.mjs, whose matches are written against the uncorrected
// values, and before apply_method_names.mjs and validate.mjs, which must see the corrected ones.
//
// Every entry is matched against the rows as they stand BEFORE this script changes anything,
// so two corrections on one row (say energy and sigma) both match the original energy.
import fs from "node:fs";
import { CORRECTIONS } from "./corrections.mjs";
import { VERIFICATIONS } from "./verifications.mjs";
import { vScore, publishedMethod, isSampled } from "./units.mjs";

const FIELDS = new Set(["energy", "sigma", "energy_variance", "dof", "einf", "method", "bound_type", "reference", "peer_reviewed", "provenance", "baseline", "sampled", "defect"]);
// Fields inside a block another script writes: a compute pass's statement (add_compute.mjs) and a
// verification's note. A pass that is read again rewrites its block, so an entry here states what it
// replaces, `from`, or for text the one passage it rewrites, `edit: [old, new]`, and the build stops
// when the block no longer holds that, rather than overwrite a newer reading unseen. A correction
// never creates a block: a statement nobody recorded is a compute pass's to add.
const NESTED = {
  compute: new Set(["parameters", "gpu_hours", "device", "n_devices", "samples", "wall_clock", "cpu_core_hours",
    "bond_dimension", "iterations", "reported_as", "source", "scope", "confidence", "note"]),
  verified: new Set(["note"]),
};
// The instance's own definition (RULES.md 2): the entry's match names the instance alone, states the
// value it replaces, and that value stays on the instance, in its `corrections`.
const INSTANCE_FIELDS = new Set(["params"]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const entries = [
  ...CORRECTIONS.map(e => ({ kind: "correction", ...e })),
  ...VERIFICATIONS.map(e => ({ kind: "verified", ...e })),
];

const byInstance = new Map();
for (const e of entries) {
  if (e.kind === "correction") {
    const [block, key] = e.field.split(".");
    if (key ? !NESTED[block]?.has(key) : !FIELDS.has(block) && !INSTANCE_FIELDS.has(block))
      throw new Error(`correction on unknown field "${e.field}" (${e.match.instance})`);
    if (e.edit !== undefined && !(Array.isArray(e.edit) && e.edit.length === 2 && e.edit.every(s => typeof s === "string" && s) && !("to" in e)))
      throw new Error(`edit is [old passage, new passage] and replaces to (${e.match.instance} ${e.field})`);
    if ((key || INSTANCE_FIELDS.has(e.field)) && !("from" in e) && e.edit === undefined)
      throw new Error(`${e.field} states what it replaces: from, or edit for a passage of text (${e.match.instance})`);
    if (INSTANCE_FIELDS.has(e.field) !== (e.match.method === undefined))
      throw new Error(`${e.field}: ${INSTANCE_FIELDS.has(e.field) ? "an instance field is matched by the instance alone" : "a row is matched by its method string"} (${e.match.instance})`);
  }
  // A flag is lifted by correcting `defect` to null, so the lift is recorded on the row
  // (RULES.md 10). Anything else about a defect belongs in defects.mjs.
  if (e.kind === "correction" && e.field === "defect" && e.to !== null)
    throw new Error(`defect may only be corrected to null (${e.match.instance})`);
  // `sampled` states whether the energy is a Monte Carlo estimate (RULES.md 6): yes or no.
  if (e.kind === "correction" && e.field === "sampled" && typeof e.to !== "boolean")
    throw new Error(`sampled may only be corrected to true or false (${e.match.instance})`);
  if (!byInstance.has(e.match.instance)) byInstance.set(e.match.instance, []);
  byInstance.get(e.match.instance).push(e);
}

let corrected = 0, verified = 0, miss = 0;
for (const [id, list] of byInstance) {
  const p = `data/${id}.json`;
  if (!fs.existsSync(p)) { console.log(`MISS instance ${id}`); miss += list.length; continue; }
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  // resolve every match first, on the unmodified rows; an instance field resolves to the instance
  const resolved = list.map(e => [e, INSTANCE_FIELDS.has(e.field) ? [inst] : inst.rows.filter(r =>
    publishedMethod(r) === e.match.method && (e.match.energy == null || Math.abs(r.energy - e.match.energy) < 1e-9))]);
  // A row has no `sampled` until an entry states it; what the entry replaces is the verdict
  // the row had, i.e. its method string's, read before a `method` entry can change the string.
  const sampledBefore = new Map(inst.rows.map(r => [r, isSampled(r)]));
  for (const [e, rows] of resolved) {
    if (rows.length !== 1) { console.log(`MISS ${rows.length} rows match ${id} "${e.match.method}" ${e.match.energy ?? ""}`); miss++; continue; }
    const [r] = rows;
    const { match, kind, ...rec } = e;
    if (kind === "correction") {
      const [block, key] = e.field.split(".");
      const holder = key ? r[block] : r, name = key ?? block;
      const from = e.field === "sampled" ? sampledBefore.get(r) : holder?.[name];
      const parts = e.edit && typeof from === "string" ? from.split(e.edit[0]) : null;
      const stale = !holder ? `no ${block} block`
        : e.edit ? (parts?.length !== 2 ? `the passage to rewrite is not in it exactly once: "${e.edit[0].slice(0, 60)}"` : null)
        : "from" in e && !same(from, e.from) ? `holds ${JSON.stringify(from)?.slice(0, 80)}, the entry replaces ${JSON.stringify(e.from)?.slice(0, 80)}` : null;
      if (stale) { console.log(`MISS ${id} "${e.match.method ?? ""}" ${e.match.energy ?? ""} ${e.field}: ${stale}`); miss++; continue; }
      const to = parts ? parts.join(e.edit[1]) : e.to;
      r.corrections = [...(r.corrections || []), { ...rec, from, ...(parts ? { to } : {}) }];
      holder[name] = to;
      if (e.field === "bound_type") r.bound_type_reason = `corrected: ${e.reason}`;
      corrected++;
      if (r === inst) continue;
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
