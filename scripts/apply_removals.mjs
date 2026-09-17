import fs from "node:fs";
import { REMOVALS } from "./removals.mjs";
let removed = 0;
for (const d of REMOVALS) {
  const p = `data/${d.match.instance}.json`;
  if (!fs.existsSync(p)) { console.log(`MISS instance ${d.match.instance}`); continue; }
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const hit = r => r.method === d.match.method && (d.match.energy == null || Math.abs(r.energy - d.match.energy) < 1e-9);
  const n = inst.rows.filter(hit).length;
  if (n !== 1) { console.log(`MISS ${n} rows match ${d.match.instance} "${d.match.method}"`); continue; }
  inst.rows = inst.rows.filter(r => !hit(r));
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
  removed++;
}
console.log(`removed ${removed} of ${REMOVALS.length} rows listed in scripts/removals.mjs`);
