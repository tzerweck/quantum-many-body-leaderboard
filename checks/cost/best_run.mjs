// A configuration run more than once is stored as its best run (Tristan, 2026-09-25): the lowest
// final energy among its protocol-v1.4 runs that stand (finite, not diverged, R-hat < 1.05). Runs
// of one configuration differ although the seed is the same, because XLA's GPU arithmetic is not
// deterministic and a hard optimisation (the triangular lattice) amplifies it.
//
// Every run is kept in results/runs/<name>--<slurm job>.json with its trace; results/<name>.json is
// the chosen one, and only it becomes a row (add_cost_runs.mjs reads results/*.json). Run after
// every `euler/sync.sh --fetch`, from the repo root:
//     node checks/cost/best_run.mjs
// DMRG is deterministic and run once; its results files are left alone.
import fs from "node:fs";
import path from "node:path";

const DIR = "checks/cost/results", RUNS = path.join(DIR, "runs");
fs.mkdirSync(RUNS, { recursive: true });
const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const stands = r => r.schema === "qmbl-cost-run-1" && r.resources && Number.isFinite(r.energy) && !r.diverged && r.r_hat < 1.05;

// 1. A freshly fetched results file is a run: keep it under runs/ if it is not there yet.
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".json"))) {
  const r = read(path.join(DIR, f));
  if (r.schema !== "qmbl-cost-run-1" || !r.resources) continue;
  const name = f.replace(/\.json$/, ""), job = r.hardware.slurm_job_id;
  const dst = path.join(RUNS, `${name}--${job}.json`);
  if (fs.existsSync(dst)) continue;
  fs.copyFileSync(path.join(DIR, f), dst);
  const trace = path.join(DIR, `${name}.trace.jsonl`);
  if (fs.existsSync(trace)) fs.copyFileSync(trace, path.join(RUNS, `${name}--${job}.trace.jsonl`));
}

// 2. The best run of each configuration becomes results/<name>.json.
const byName = new Map();
for (const f of fs.readdirSync(RUNS).filter(f => f.endsWith(".json"))) {
  const [name, job] = f.replace(/\.json$/, "").split("--");
  const r = read(path.join(RUNS, f));
  if (!stands(r)) continue;
  (byName.get(name) ?? byName.set(name, []).get(name)).push({ job, r });
}
for (const [name, runs] of [...byName].sort()) {
  const best = runs.sort((a, b) => a.r.energy - b.r.energy)[0];
  const out = { ...best.r, best_of: { runs: runs.length, jobs: runs.map(x => x.job).sort() } };
  fs.writeFileSync(path.join(DIR, `${name}.json`), JSON.stringify(out, null, 1));
  const trace = path.join(RUNS, `${name}--${best.job}.trace.jsonl`);
  if (fs.existsSync(trace)) fs.copyFileSync(trace, path.join(DIR, `${name}.trace.jsonl`));
  console.log(`${name}: job ${best.job}, E/site ${best.r.energy_per_site_SS.toFixed(6)} (best of ${runs.length})`);
}
