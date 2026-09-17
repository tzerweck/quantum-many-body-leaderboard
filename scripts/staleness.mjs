// Which instances most likely have a beaten record? Rank refresh targets.
// Signal 1: no post-2024 row at all (nothing from the 2025-26 sweep).
// Signal 2: the record's V-score - high means lots of room, so the frontier moved.
import fs from "node:fs"; import path from "node:path";
import { perSiteDivisor, perSiteLabel, methodLabel } from "./units.mjs";
const rows = [];
for (const m of fs.readdirSync("data")) {
  const dir = path.join("data", m); if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    const i = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const rec = [...i.rows].filter(r => r.bound_type === "variational").sort((a,b)=>a.energy-b.energy)[0];
    if (!rec) continue;
    const fresh = i.rows.some(r => r.source === "literature-2025-26");
    const d = perSiteDivisor(i);
    rows.push({ id: i.instance_id, n: i.n_sites, fresh, v: rec.v_score,
      eps: d ? rec.energy/d : null, unit: perSiteLabel(i), method: methodLabel(rec).slice(0,44) });
  }
}
const stale = rows.filter(r => !r.fresh && r.v != null).sort((a,b)=>b.v-a.v);
console.log(`instances=${rows.length}  with a 2025-26 row=${rows.filter(r=>r.fresh).length}  stale with a V-score=${stale.length}\n`);
console.log("TOP REFRESH TARGETS (stale, ranked by the record's V-score = room left):");
for (const r of stale.slice(0, 20))
  console.log(`  V=${r.v.toExponential(1)}  ${r.id.padEnd(38)} ${r.eps!=null?r.eps.toFixed(6):"-"}  ${r.method}`);
const noV = rows.filter(r => !r.fresh && r.v == null);
console.log(`\n${noV.length} stale instances have NO V-score on the record (no variance reported) - invisible to this ranking.`);
