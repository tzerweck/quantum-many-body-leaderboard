import fs from "node:fs";
import { perSiteDivisor, perSiteLabel, SPIN_MODELS } from "./units.mjs";

for (const id of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(`data/${id}.json`, "utf8"));
  const f = perSiteDivisor(d) ?? 1;
  console.log(`\n=== ${id}  (${d.n_sites} sites, BC ${d.boundary}, ${JSON.stringify(d.params)}) [${perSiteLabel(d)}]`);
  const sorted = [...d.rows].sort((a, b) => a.energy - b.energy);
  for (const r of sorted) {
    const mark = r.defect ? "!" : r.bound_type === "variational" ? " "
      : r.bound_type === "projected" ? "P" : r.bound_type === "extrapolated" ? "X" : "?";
    const v = r.v_score ? r.v_score.toExponential(1) : "  n/a ";
    console.log(`  ${mark} ${(r.energy / f).toFixed(7)}  V=${v}  ${(r.provenance || "").padEnd(9)} ${r.method.slice(0, 50)}`);
  }
  // A flagged row is listed in place but cannot hold the record (RULES.md 6.1). Suspicion is
  // enough to withhold the record, never enough to hide the row; RULES.md 10 is how a flag
  // gets lifted or upheld.
  const best = sorted.find(r => r.bound_type === "variational" && !r.defect);
  for (const b of sorted)
    if (b.bound_type === "variational" && b.defect && (!best || b.energy < best.energy))
      console.log(`  !! excluded from the record: ${(b.energy / f).toFixed(7)} [${b.defect.flag}] ${b.method.slice(0, 42)}`);
  console.log(best
    ? `  --> RECORD (strict variational bound): ${(best.energy / f).toFixed(7)}  ${best.method.slice(0, 52)}`
    : `  --> NO RECORD: every variational row is flagged or absent`);
}
