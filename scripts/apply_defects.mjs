import fs from "node:fs";
import { DEFECTS, SHARED } from "./defects.mjs";
let hit = 0;
for (const d of DEFECTS) {
  const p = `data/${d.match.instance}.json`;
  if (!fs.existsSync(p)) { console.log(`MISS instance ${d.match.instance}`); continue; }
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const rows = inst.rows.filter((r) =>
    r.method === d.match.method && (d.match.energy == null || Math.abs(r.energy - d.match.energy) < 1e-9));
  if (!rows.length) { console.log(`MISS row ${d.match.instance} "${d.match.method}"`); continue; }
  // a shared diagnosis block is attached only through an explicit `shared` key (never by flag name)
  if (d.shared && !SHARED[d.shared]) throw new Error(`no SHARED block "${d.shared}" (${d.match.instance})`);
  for (const r of rows) { r.defect = { flag: d.flag, finding: d.finding, ...(d.shared ? SHARED[d.shared] : {}), ...(d.source_entry ? { source_entry: d.source_entry } : {}) }; hit++; }
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`flagged ${hit} rows with known defects`);
