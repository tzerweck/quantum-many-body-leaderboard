// Give every row its short method name, detail and family from scripts/method_names.mjs,
// keeping the published string as `method_as_published`. Runs after every script that
// matches rows by their published method string (defects, removals), so those keep working.
//
//   node scripts/apply_method_names.mjs             rewrite data/
//   node scripts/apply_method_names.mjs --dry FILE  write the review table to FILE, touch nothing
import fs from "node:fs"; import path from "node:path";
import { lookup, FIXED_NODE_ABOVE, FAMILY } from "./method_names.mjs";
import { family } from "./views.mjs";

const dry = process.argv[2] === "--dry" ? process.argv[3] : null;
const COMPUTE_KEYS = ["parameters", "samples", "bond_dimension"];
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
  if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith(".json") && !f.startsWith("_")) files.push(p); } })("data");

const unmapped = new Map(), conflicts = [], review = new Map(), collisions = [];
let renamed = 0;

function named(rows, i) {
  const r = rows[i], published = r.method_as_published ?? r.method;
  if (published !== FIXED_NODE_ABOVE) return lookup(published);
  const above = rows[i - 1], trial = above && lookup(above.method_as_published ?? above.method);
  if (!trial || trial[0] !== "VMC") return null;
  return ["Fixed-node GFMC", `trial state: VMC, ${trial[1]}`, { family: "AFQMC / GFMC" }];
}

for (const p of files.sort()) {
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const out = inst.rows.map((r, i) => {
    const published = r.method_as_published ?? r.method;
    const entry = named(inst.rows, i);
    if (!entry) { unmapped.set(published, (unmapped.get(published) || 0) + 1); return r; }
    const [method, detail0, extra = {}] = entry;
    const split = extra.extrapolated && r.bound_type === "extrapolated";
    const detail = split ? extra.extrapolated : detail0;
    const numbers = split ? {} : Object.fromEntries(COMPUTE_KEYS.filter(k => extra[k] != null).map(k => [k, extra[k]]));
    const row = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === "method") Object.assign(row, { method, method_detail: detail, method_as_published: published,
        family: extra.family ?? FAMILY[method] ?? family(published), ...(extra.sector ? { sector: extra.sector } : {}) });
      else if (!["method_detail", "method_as_published", "family", "sector"].includes(k)) row[k] = v;
    }
    if (Object.keys(numbers).length) {
      const said = `method string: "${published}"`;
      if (!row.compute) row.compute = { parameters: null, gpu_hours: null, device: null, n_devices: null, samples: null,
        wall_clock: null, cpu_core_hours: null, bond_dimension: null, iterations: null, reported_as: said,
        source: "the row's published method string (scripts/method_names.mjs, 2026-09-17)", scope: "row", confidence: "high",
        note: "Only the numbers the method string states; nothing else about this run's cost is recorded." };
      for (const [k, v] of Object.entries(numbers)) {
        if (row.compute[k] == null) { row.compute[k] = v; if (!row.compute.reported_as.includes(said)) row.compute.reported_as += ` || ${said}`; }
        else if (row.compute[k] !== v) conflicts.push(`${inst.instance_id}: ${k} compute ${row.compute[k]} vs method string ${v} "${published}"`);
      }
    }
    const key = `${published}\t${method}\t${detail}\t${row.family}\t${extra.sector ?? ""}\t${numbers.bond_dimension ?? ""}\t${numbers.parameters ?? ""}\t${numbers.samples ?? ""}`;
    review.set(key, (review.get(key) || 0) + 1);
    renamed++;
    return row;
  });
  // Rows that now read the same in the table: same name, detail, sector, bond dimension and kind.
  const seen = new Map();
  for (const r of out) {
    const k = [r.method, r.method_detail, r.sector, r.compute?.bond_dimension, r.bound_type].join("|");
    if (seen.has(k) && seen.get(k).energy !== r.energy)
      collisions.push(`${inst.instance_id}: "${r.method}" "${r.method_detail}" ${seen.get(k).energy} [${seen.get(k).method_as_published}] vs ${r.energy} [${r.method_as_published}]`);
    else seen.set(k, r);
  }
  if (!dry) { inst.rows = out; fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n"); }
}

for (const [m, n] of unmapped) console.log(`UNMAPPED ${n}x "${m}"`);
for (const c of conflicts) console.log(`CONFLICT ${c}`);
for (const c of collisions) console.log(`SAME-LOOKING ${c}`);
if (dry) {
  const lines = [...review].map(([k, n]) => `${n}\t${k}`)
    .sort((a, b) => a.split("\t")[2].localeCompare(b.split("\t")[2]) || a.split("\t")[3].localeCompare(b.split("\t")[3]));
  fs.writeFileSync(dry, "rows\tpublished\tmethod\tdetail\tfamily\tsector\tbond_dimension\tparameters\tsamples\n" + lines.join("\n") + "\n");
}
console.log(`method names: ${renamed} rows named, ${[...unmapped.values()].reduce((a, b) => a + b, 0)} unmapped, ${conflicts.length} compute conflicts, ${collisions.length} same-looking pairs${dry ? `; review table ${dry}` : ""}`);
