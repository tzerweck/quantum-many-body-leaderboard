// Definitions shared by the two views of the table that are not the record book:
// STATS.md (stats.mjs) and the figures (figures.mjs). A chart that counted "contested"
// or "tensor network" differently from the table printed beside it would contradict
// that table, so both import these rather than keeping a copy each.

// A record on an instance nobody else has attempted says something very different from
// a record won against nine rivals. "Contested" is the cut used throughout both views.
export const CONTESTED = 5;
export const variationalRows = i => i.rows.filter(r => r.bound_type === "variational");

// Families are matched by regular expression against the `method` string, first match
// wins, in this order - so a row naming both an architecture and its optimiser lands in
// the architecture it names first.
export const FAMILIES = [
  ["tensor network", /\bdmrg\b|\bmps\b|\bpeps\b|tensor.?network|\bmera\b/i],
  ["transformer / ViT", /transformer|\bvit\b|attention|\bctwf\b/i],
  ["CNN / ResNet", /\bcnn\b|convnext|resnet|conv layer|\bace\b|\bscale\b/i],
  ["RNN", /\brnn\b/i],
  ["RBM", /\brbm\b/i],
  ["backflow / Pfaffian", /backflow|\bnnbf\b|pfaffian|\bhfps\b|hidden.?fermion/i],
  ["classic VMC", /gutzwiller|jastrow|\bbcs\b|spin liquid|\bmvmc\b|slater/i],
  ["AFQMC / GFMC", /afqmc|fixed.?node|\bgfmc\b|\bvafqmc\b/i],
  ["VQE / circuit", /\bvqe\b|circuit|statevector/i],
];
export const family = m => FAMILIES.find(([, re]) => re.test(m || ""))?.[0] ?? "other";
