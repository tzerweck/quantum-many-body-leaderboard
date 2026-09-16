import fs from "node:fs"; import path from "node:path";
import { instances, readTable, num } from "./parse.mjs";
import { classify } from "./bound_type.mjs";

// model -> names of the trailing params after lattice_N_BC
const PARAMS = { J1J2:["J2"], Hubbard:["Nf","U"], tV:["Nf","V"], TFIsing:["h"], Heisenberg:[], Impurity:[] };
const NEEDS_REVIEW = new Set(["QMC","AFQMC"]); // bare strings: sign-problem-free (unbiased) vs constrained (projected)

// Clean rebuild: data/ is fully derived from vendor/ + scripts/, never edited by hand,
// so wipe it first. Without this, add_literature.mjs double-appends to instances it created.
fs.rmSync("data", { recursive: true, force: true });

const summary = { instances:0, rows:0, by_bound:{}, needs_review:[], vscore_rows:0, no_variance:0, no_sigma:0 };
for (const it of instances()) {
  const [lattice, N, BC, ...rest] = it.stem.split("_");
  const params = {};
  (PARAMS[it.model] || []).forEach((k,i) => { if (rest[i] !== undefined) params[k] = num(rest[i]); });
  const rows = readTable(it.file).rows.map((r) => {
    const method = (r["method"]||"").trim();
    let { bound_type, reason } = classify(method);
    const review = NEEDS_REVIEW.has(method) || bound_type === null;
    if (review) { bound_type = null; reason = "ambiguous: bare method string, sign-problem-free vs constrained undetermined"; }
    const energy = num(r["energy"]), sigma = num(r["sigma"]);
    const variance = num(r["energy variance"]), dof = num(r["dof"]), einf = num(r["einf"]);
    let v_score = null;
    if (variance != null && !Number.isNaN(variance) && dof && einf != null && energy !== einf)
      v_score = dof * variance / Math.pow(energy - einf, 2);
    if (v_score != null) summary.vscore_rows++;
    if (variance == null || Number.isNaN(variance)) summary.no_variance++;
    if (sigma == null || Number.isNaN(sigma)) summary.no_sigma++;
    const key = bound_type || "needs-review";
    summary.by_bound[key] = (summary.by_bound[key]||0)+1;
    if (review) summary.needs_review.push(`${it.model}/${it.stem}: "${method}"`);
    // VarBench did two different things, and its Reference column is where they are
    // told apart. A row citing a paper is one VarBench COLLECTED from the literature.
    // A row whose only reference is a run script in varbench/methods is one VarBench
    // COMPUTED itself - a baseline, run across the instance set to give the V-score a
    // denominator, not a result anybody published as state of the art. Conflating the
    // two makes a reference calculation look like a defended SOTA claim.
    const reference = r["reference"] || "";
    const citesPaper = /\[paper\]|arxiv|doi\.org|10\.\d{4}\//i.test(reference);
    const baseline = !citesPaper && /github\.com\/varbench\/methods/.test(reference);
    return { energy, sigma, energy_variance: variance, dof, einf, v_score,
             method, bound_type, bound_type_reason: reason,
             reference, source: "varbench@2024-10-22", provenance: "imported",
             ...(baseline ? { baseline: true } : {}) };
  });
  const out = { model: it.model, lattice, n_sites: num(N), boundary: BC, params,
                instance_id: `${it.model}/${it.stem}`, rows };
  const dst = path.join("data", it.model); fs.mkdirSync(dst, { recursive: true });
  fs.writeFileSync(path.join(dst, it.stem + ".json"), JSON.stringify(out, null, 2) + "\n");
  summary.instances++; summary.rows += rows.length;
}
// Import stats only, deliberately NOT written to data/_summary.json: rows are still
// appended after this by add_literature.mjs and add_sweep_rows.mjs. scripts/summary.mjs
// owns that file and runs last.
console.log(JSON.stringify({ ...summary, needs_review: summary.needs_review }, null, 2));
