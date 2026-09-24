// Attach `compute` blocks (DATA.md, "What a number cost") from the compute passes.
//
// A pass is one full reading of the papers behind the rows for what the calculations
// cost: compute-rows-YYYY-MM-DD.json, one object per (instance, energy, reference) row,
// fields as DATA.md specifies plus `scope`, `confidence` and `note`. The first pass
// (2026-09-16) read all 130 papers behind the 830 non-baseline rows in full, including
// appendices and supplements; its row objects were written by the readers, and this
// script only attaches them. Passes apply in date order and a later reading of the same
// row replaces the earlier block whole, so a second pass that found the supplement wins.
//
// The rules the readers worked to, restated because they decide what a block may say:
// a field is filled only when the paper states that number (GPU-days become hours, and
// the note says so; "20 A100 for 4 days" fills n_devices, device and wall_clock and leaves
// gpu_hours null); a parameter count is evaluated from layer sizes only where the source
// states the architecture in full, with the formula in the note (medium confidence; pass
// 2026-09-24); nothing is normalised across hardware. A row whose paper states nothing gets no block at all -
// the readers' record of what they searched stays in the pass directory, not here.
import fs from "node:fs";
import path from "node:path";

const PASSES = fs.readdirSync(".").filter(f => /^compute-rows-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const BLOCK = ["parameters", "gpu_hours", "device", "n_devices", "samples", "wall_clock",
  "cpu_core_hours", "bond_dimension", "iterations", "sweep_schedule", "reported_as", "source", "scope", "confidence", "note"];

// A row's reference is `[paper](url)`, `[code](url)` or a citation string; the passes key
// on the url or the string, as the worklist that was read from did.
const refKey = ref => (ref || "").match(/\((https?:[^)]+)\)/)?.[1] ?? (ref || "");

const instances = new Map();
for (const m of fs.readdirSync("data")) {
  const dir = path.join("data", m);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const inst = JSON.parse(fs.readFileSync(p, "utf8"));
    instances.set(inst.instance_id, { path: p, inst, dirty: false });
  }
}

let attached = 0, replaced = 0, skipped = 0;
const unmatched = [];
for (const file of PASSES) {
  const date = file.slice(13, 23);
  for (const c of JSON.parse(fs.readFileSync(file, "utf8"))) {
    // A block with no quote cannot be checked against the paper and the validator rejects
    // it; the readers left reported_as empty only where nothing applies (a Hartree-Fock
    // baseline has no run to cost).
    if (!c.reported_as) { skipped++; continue; }
    const entry = instances.get(c.instance_id);
    const rows = entry?.inst.rows.filter(r => r.energy === c.energy) ?? [];
    const row = rows.length > 1 ? rows.find(r => refKey(r.reference) === c.reference) ?? null : rows[0] ?? null;
    if (!row) { unmatched.push(`${c.instance_id} ${c.energy} ${c.reference.slice(0, 50)}`); continue; }
    if (row.compute) replaced++; else attached++;
    const block = {};
    for (const k of BLOCK) block[k] = c[k] ?? null;
    // Only a DMRG run script states a sweep schedule; no other block carries the field.
    if (block.sweep_schedule == null) delete block.sweep_schedule;
    if (c.arxiv) block.source = `${block.source ?? "text"}, arXiv:${c.arxiv}`;
    block.source += ` (compute pass ${date})`;
    row.compute = block;
    entry.dirty = true;
  }
}
for (const { path: p, inst, dirty } of instances.values())
  if (dirty) fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");

console.log(`compute blocks: ${attached} attached, ${replaced} replaced, ${skipped} rows without a statement, ${unmatched.length} unmatched`);
for (const u of unmatched) console.log(`  unmatched: ${u}`);
