import fs from "node:fs";
import { perSiteDivisor, perSiteLabel, SPIN_MODELS, recordEligible, noErrorMetrics, boundLabel, methodLabel } from "./units.mjs";
import { exactRecordOf } from "./summary.mjs";

for (const id of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(`data/${id}.json`, "utf8"));
  const f = perSiteDivisor(d) ?? 1;
  console.log(`\n=== ${id}  (${d.n_sites} sites, BC ${d.boundary}, ${JSON.stringify(d.params)}) [${perSiteLabel(d)}]`);
  const sorted = [...d.rows].sort((a, b) => a.energy - b.energy);
  for (const r of sorted) {
    const mark = r.defect ? "!" : r.bound_type === "variational" ? " "
      : r.bound_type === "projected" ? "P" : r.bound_type === "extrapolated" ? "X" : "?";
    const v = r.v_score ? r.v_score.toExponential(1) : "  n/a ";
    // "o" = no error metric found for this row, neither a sigma nor a variance.
    const err = noErrorMetrics(r) ? "o" : " ";
    // "baseline" says more than "imported": the number is VarBench's own reference run,
    // not a result someone published as state of the art.
    const prov = r.baseline ? "baseline" : (r.provenance || "");
    console.log(`  ${mark}${err} ${(r.energy / f).toFixed(7)}  V=${v}  ${prov.padEnd(9)} ${methodLabel(r).slice(0, 50)}`);
  }
  // A spectrum's sector minima are not rows (DATA.md) and rank for nothing: one line says
  // they are there and where the lowest of them sits.
  if (d.spectrum?.length) {
    const low = d.spectrum.reduce((a, b) => (b.energy < a.energy ? b : a));
    console.log(`  +  spectrum: ${d.spectrum.length} sector minima, not rows; the lowest ${(low.energy / f).toFixed(7)} (sector ${low.sector})`);
  }
  console.log("  legend: ! flagged  P projected  X extrapolated  ? unclassified"
    + "\n          o no error metric found in the source read - needs verification, not a criticism");
  // A flagged row is listed in place but cannot hold the record (RULES.md 6.1). Suspicion is
  // enough to withhold the record, never enough to hide the row; RULES.md 10 is how a flag
  // gets lifted or upheld. Every other row can hold it, of any kind and with or without an
  // error bar (RULES.md 6, since 2026-10-08). Where the instance is solved the exact energy
  // is the record and the lowest other row is the closest challenger.
  const exact = exactRecordOf(d);
  const best = sorted.find(recordEligible);
  for (const b of sorted) {
    if (b.bound_type === "exact" || !b.defect || (best && b.energy >= best.energy)) continue;
    console.log(`  !! excluded from the record: ${(b.energy / f).toFixed(7)} [${b.defect.flag}] ${methodLabel(b).slice(0, 42)}`);
  }
  if (exact) console.log(`  --> RECORD (${boundLabel(exact)}, the instance is solved): ${(exact.energy / f).toFixed(7)}  ${methodLabel(exact).slice(0, 52)}`);
  console.log(best
    ? `  --> ${exact ? "LOWEST NON-EXACT ENERGY" : "RECORD"} (${boundLabel(best)}): ${(best.energy / f).toFixed(7)}  ${methodLabel(best).slice(0, 52)}`
    : `  --> ${exact ? "no unflagged non-exact row" : "NO RECORD"}: every row that could hold it is flagged or absent`);
}
