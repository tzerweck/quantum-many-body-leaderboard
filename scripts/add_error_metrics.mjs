// Attach an error bar or an energy variance to a row that was imported without one.
//
// A pass is error-metrics-YYYY-MM-DD.json: one object per row, naming where the number was
// found. Two kinds of source, told apart by `measured_by`:
//   - "authors": the authors' own data release (a repository, a Zenodo record, a notebook's
//     stored output) holds the variance or the error bar of the state behind the printed
//     energy, which the paper itself does not print. The case that opened this: Moss et
//     al.'s pickle behind arXiv:2505.20406 (see add_repo_data_rows.mjs).
//   - "qmbl": we measured it ourselves, on the checkpoint the authors published, with their
//     network and sampler. Only a measurement on *their* state goes on *their* row; a state
//     we trained is a new row (hub, Seeding Var(E)).
// Either way the row's `energy` stays what the paper prints; the block records where the
// added numbers came from, and `reported_as` must be found verbatim in `source_file` (parts
// separated by " | "), so a clone can check every value without the network.
//
// A number is attached only to the state it belongs to: the source's energy must agree with
// the row's within 2 combined sigma. A field the row already carries is never overwritten;
// a later pass replaces an earlier pass's block whole, as for `compute`.
//
// Conventions a source may state its variance in, converted once here (spin models store
// Pauli totals, so an S.S variance of the total energy is x16):
//   var_total_pauli   Var(H) of the stored total energy
//   var_total_SS      Var(H) in S.S units
//   var_over_n_SS     Var(H)/N in S.S units, the "rescaled energy variance sigma^2/N"
//   var_over_n2_SS    Var(H)/N^2 in S.S units, the variance of the local energy per site
//   v_score           N Var(H) / E^2 (einf = 0), converted with the source's own energy
import fs from "node:fs";
import path from "node:path";
import { SPIN_MODELS, perSiteDivisor, vScore } from "./units.mjs";

const PASSES = fs.readdirSync(".").filter(f => /^error-metrics-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const MEASURED_BY = new Set(["authors", "qmbl"]);

function varianceTotal(e, inst) {
  if (e.variance == null) return null;
  const n = inst.n_sites;
  const toPauli = SPIN_MODELS.has(inst.model) && inst.model !== "TFIsing" ? 16 : null;
  switch (e.variance_convention) {
    case "var_total_pauli": return e.variance;
    case "var_total_SS": return toPauli && e.variance * toPauli;
    case "var_over_n_SS": return toPauli && e.variance * n * toPauli;
    case "var_over_n2_SS": return toPauli && e.variance * n * n * toPauli;
    case "v_score": return inst.model !== "TFIsing" && SPIN_MODELS.has(inst.model)
      ? e.variance * (e.source_energy_per_site * perSiteDivisor(inst)) ** 2 / n : null;
    default: return undefined;
  }
}

const instances = new Map();
for (const m of fs.readdirSync("data")) {
  const dir = path.join("data", m);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const inst = JSON.parse(fs.readFileSync(p, "utf8"));
    instances.set(inst.instance_id, { path: p, inst, dirty: false });
  }
}

let attached = 0;
const problems = [];
for (const file of PASSES) {
  const date = file.slice(14, 24);
  for (const e of JSON.parse(fs.readFileSync(file, "utf8"))) {
    const at = `${e.instance_id} ${e.reference_includes}`;
    if (!MEASURED_BY.has(e.measured_by)) { problems.push(`${at}: measured_by ${e.measured_by}`); continue; }
    const text = e.source_file && fs.existsSync(e.source_file) ? fs.readFileSync(e.source_file, "utf8") : null;
    if (text == null) { problems.push(`${at}: source_file ${e.source_file} missing`); continue; }
    const absent = (e.reported_as || "").split(" | ").filter(s => !s || !text.includes(s));
    if (!e.reported_as || absent.length) { problems.push(`${at}: reported_as not verbatim in ${e.source_file}: ${absent.join(" / ")}`); continue; }
    const entry = instances.get(e.instance_id);
    if (!entry) { problems.push(`${at}: no such instance`); continue; }
    const { inst } = entry;
    const div = perSiteDivisor(inst);
    const src = e.source_energy_per_site, srcSig = e.source_sigma_per_site ?? 0;
    const rows = inst.rows.filter(r => (r.reference || "").includes(e.reference_includes) && r.bound_type === "variational"
      && Math.abs(r.energy / div - src) <= 2 * Math.hypot((r.sigma ?? 0) / div, srcSig) + 1e-9);
    if (rows.length !== 1) { problems.push(`${at}: ${rows.length} rows match E/site ${src}`); continue; }
    const row = rows[0];
    const prev = row.error_metrics;
    const set = [];
    const v = varianceTotal(e, inst);
    if (v === undefined) { problems.push(`${at}: unknown variance_convention ${e.variance_convention}`); continue; }
    if (e.variance != null && v == null) { problems.push(`${at}: ${e.variance_convention} undefined for ${inst.model}`); continue; }
    if (v != null && (row.energy_variance == null || prev?.fields?.includes("energy_variance"))) {
      row.energy_variance = +v.toPrecision(8);
      row.v_score = vScore(row.energy_variance, row.dof, row.energy, row.einf);
      set.push("energy_variance");
    }
    if (e.sigma_per_site != null && (row.sigma == null || prev?.fields?.includes("sigma"))) {
      row.sigma = +(e.sigma_per_site * div).toPrecision(6);
      set.push("sigma");
    }
    if (!set.length) { problems.push(`${at}: row already carries every field this entry offers`); continue; }
    row.error_metrics = {
      fields: set, measured_by: e.measured_by, checked_on: date, source: e.source, source_file: e.source_file,
      reported_as: e.reported_as, conversion: e.variance_convention ?? null, note: e.note ?? null,
    };
    entry.dirty = true;
    attached++;
  }
}
for (const { path: p, inst, dirty } of instances.values())
  if (dirty) fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
console.log(`error metrics attached to ${attached} rows from ${PASSES.length} pass(es)`);
if (problems.length) { problems.forEach(s => console.log("  !! " + s)); process.exitCode = 1; }
