import fs from "node:fs";
const SPIN = new Set(["J1J2","Heisenberg","TFIsing"]);
for (const id of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(`data/${id}.json`, "utf8"));
  const f = SPIN.has(d.model) ? 4 * d.n_sites : d.n_sites;
  console.log(`\n=== ${id}  (${d.n_sites} sites, BC ${d.boundary}, ${JSON.stringify(d.params)}) ${SPIN.has(d.model)?"[S.S per site]":"[per site]"}`);
  const sorted = [...d.rows].sort((a,b) => a.energy - b.energy);
  for (const r of sorted) {
    const eps = (r.energy / f);
    const flag = r.bound_type === "variational" ? " " : r.bound_type === "projected" ? "P" : r.bound_type === "extrapolated" ? "X" : "?";
    console.log(`  ${flag} ${eps.toFixed(7)}  V=${r.v_score?r.v_score.toExponential(1):"  n/a "}  ${(r.provenance||"").padEnd(9)} ${r.method.slice(0,52)}`);
  }
  const best = sorted.find(r => r.bound_type === "variational");
  console.log(`  --> RECORD (strict variational bound): ${(best.energy/f).toFixed(7)}  ${best.method.slice(0,55)}`);
}
