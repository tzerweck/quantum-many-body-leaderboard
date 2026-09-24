// QMBL-measured ED cost (DATA.md, "What an exact diagonalization costs: qmbl_ed_cost"; Tristan,
// 2026-09-23/24). An exact energy does not depend on who computed it, so its cost is a property
// of the instance, not of a row: QMBL diagonalizes the instance itself (checks/cost/ed/run_ed.py),
// and a run that reproduces the stored exact energy becomes the instance field `qmbl_ed_cost`.
// A run that does not reproduce it attaches nothing and is printed. Public text names the CPU,
// never the cluster.
import fs from "node:fs";
import path from "node:path";

const DIR = "checks/cost/ed/results";
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith(".json")).sort() : [];
const isED = r => r.bound_type === "exact" && /diagonal|\bED\b|Lanczos/i.test(`${r.method || ""} ${r.method_as_published || ""}`);
let attached = 0;
const refused = [];

for (const f of files) {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  const p = `data/${res.instance_id}.json`;
  if (!fs.existsSync(p)) { refused.push(`${f}: no instance ${res.instance_id}`); continue; }
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!res.reproduces_stored) { refused.push(`${res.instance_id}: E = ${res.energy} against stored ${res.stored_exact} (rel ${res.relative_difference.toExponential(1)})`); continue; }
  // The exact row it reproduced; where several print the same energy, the first is drawn.
  const row = inst.rows.find(r => isED(r) && Math.abs(r.energy - res.energy) <= 1e-8 * Math.abs(r.energy));
  if (!row) { refused.push(`${res.instance_id}: no exact-diagonalization row at ${res.energy}`); continue; }
  const x = res.resources || {};
  inst.qmbl_ed_cost = {
    core_hours: +res.cpu_core_hours.toFixed(5),
    wall_clock: res.timing.wall_hms,
    cores: res.cores,
    cpu: res.hardware.cpu,
    energy: res.energy,
    reproduces: { energy: row.energy, method: row.method_as_published ?? row.method, relative_difference: +res.relative_difference.toExponential(2) },
    sector: { conserved: res.sector.conserved, dimension: res.sector.dimension, nonzeros: res.sector.nonzeros, lattice_symmetries: "none" },
    lanczos_steps: res.lanczos_steps,
    peak_memory_gb: +res.peak_rss_gb.toFixed(2),
    code: `NetKet ${res.software.netket} (sparse matrix) and SciPy ${res.software.scipy} eigsh (ARPACK Lanczos)`,
    note: `Measured by QMBL, not reported: wall-clock from process start to the eigenvalue on ${res.cores} core${res.cores === 1 ? "" : "s"} ` +
      `(imports ${res.timing.import_seconds.toFixed(0)} s, Hamiltonian ${res.timing.build_seconds.toFixed(0)} s, sparse matrix ${res.timing.sparse_seconds.toFixed(0)} s, ` +
      `Lanczos ${res.timing.solve_seconds.toFixed(0)} s); core_hours = wall-clock x cores.` +
      (x.cpu_utilisation != null ? ` Process CPU time ${Math.round(100 * x.cpu_utilisation)} % of wall-clock x cores` +
        (x.core_mhz ? `, core clock ${(x.core_mhz.mean / 1000).toFixed(2)} GHz on average` : "") + (x.node_load ? `, node load ${x.node_load.mean} of ${x.node_cpus} CPUs` : "") + "." : ""),
    script: res.software.script,
    results_file: `${DIR}/${f}`,
    commit: res.software.commit,
    measured_on: (res.timing.ended_utc || "").slice(0, 10),
  };
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
  attached++;
}
console.log(`QMBL ED cost: ${attached} instances from ${files.length} results files${refused.length ? `, ${refused.length} not attached` : ""}`);
for (const r of refused) console.log(`  NOT ATTACHED ${r}`);
