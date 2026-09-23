// What a row cost, read out of its `compute` block (DATA.md). Shared by the cost figures
// (pareto.mjs) and the site (site.mjs), which says per instance how many energies state a
// cost, so both count the same rows.
//
// Hours are GPU-hours where stated, devices x wall-clock where that is what the paper says
// (multiplied here, once, and marked `derived`), or CPU core-hours. A GPU-hour and a CPU
// core-hour keep their unit and are never converted into each other; the stored fields
// are never derived.

// Total durations only. Anything per step, per sweep or cumulative over several sizes is
// not this run's wall-clock and stays unparsed; the row then has no hours. A rounded total
// ("around 4.5 GPU days") is still a total and parses; "within a day" is a bound and does not.
export function wallClockHours(s) {
  if (!s) return null;
  s = s.trim().toLowerCase().replace(/^(?:about|around|approximately|roughly|~)\s*/, "");
  if (/per |cumulative|step|iteration|sweep|multiplication|within/.test(s)) return null;
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
  let m;
  if ((m = s.match(/^(\d+):(\d{2}):(\d{2})(?:\s*\(hh:mm:ss\))?$/))) return +m[1] + m[2] / 60 + m[3] / 3600;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:gpu[- ])?(?:h|hours?|hrs?)\b/))) return +m[1];
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:gpu[- ])?(?:d|days?)\b/))) return 24 * m[1];
  if ((m = s.match(/^([a-z]+)\s*days?$/)) && words[m[1]]) return 24 * words[m[1]];
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:min|minutes?)$/))) return m[1] / 60;
  return null;
}

// Hours for a row's compute block: { value, unit: "gpu" | "cpu", derived }, or null.
export function hoursOf(c) {
  if (!c) return null;
  if (c.gpu_hours != null) return { value: c.gpu_hours, unit: "gpu", derived: false };
  if (c.n_devices != null && c.wall_clock) {
    const h = wallClockHours(c.wall_clock);
    if (h != null) return { value: c.n_devices * h, unit: "gpu", derived: true };
  }
  if (c.cpu_core_hours != null) return { value: c.cpu_core_hours, unit: "cpu", derived: false };
  return null;
}

export const parametersOf = c => (c?.parameters > 0 ? { value: c.parameters, unit: "params", derived: false } : null);

// A cost figure needs at least this many costed energies on its instance; below it the
// site says how many state a cost instead of drawing one mark on an axis.
export const MIN_COSTED = 2;

// Where an instance's own cost figure is written, relative to the repository root; the
// estimated-FLOPs figure (flops.mjs) sits beside it under figures/flops/.
export const costFigureName = inst => `cost/${inst.instance_id.replace("/", "--")}`;
export const flopsFigureName = inst => `flops/${inst.instance_id.replace("/", "--")}`;
export const paramsFigureName = inst => `params/${inst.instance_id.replace("/", "--")}`;
