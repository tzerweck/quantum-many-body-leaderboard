// A diagonalization resolved by symmetry sector states the lowest energy in each sector, and
// only the ground state's sector is a ground-state energy. That row stays a row and holds the
// record; every other sector's minimum leaves the rows for the instance's `spectrum` (DATA.md;
// Tristan, ruled 2026-09-16 and reconfirmed 2026-09-30 for J1J2/triangular_48_P_0.125). A level
// of the spectrum is not a result, and as a row it had to be excluded by every consumer in turn.
//
// Runs once the rows are final, after the overlays and the method names (which assign `sector`):
// a correction or verification written against a sector row lands on it before it moves, and
// each entry keeps the complete row. Which sector is the ground state is a ruling
// (groundStateExact, units.mjs), never a guess, so an instance with no ground-state row keeps its
// sector rows as rows, printed here and reported by the validator.
import fs from "node:fs"; import path from "node:path";
import { groundStateExact } from "./units.mjs";

const files = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
  if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith(".json") && !f.startsWith("_")) files.push(p); } })("data");

let moved = 0, instances = 0;
const kept = [];
for (const p of files.sort()) {
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const minima = inst.rows.filter(r => r.sector && !groundStateExact(r));
  if (!minima.length) continue;
  if (!inst.rows.some(groundStateExact)) { kept.push(`${inst.instance_id}: ${minima.length} sector rows, no ground-state row`); continue; }
  inst.rows = inst.rows.filter(r => !minima.includes(r));
  // Lowest first, as a spectrum is read; the sector breaks a tie so the file never reorders.
  inst.spectrum = [...(inst.spectrum ?? []), ...minima]
    .sort((a, b) => a.energy - b.energy || a.sector.localeCompare(b.sector));
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
  moved += minima.length; instances++;
}
console.log(`spectrum: ${moved} sector minima moved off the rows of ${instances} instance${instances === 1 ? "" : "s"}${kept.length ? `, ${kept.length} kept` : ""}`);
for (const k of kept) console.log(`  KEPT AS ROWS ${k}`);
