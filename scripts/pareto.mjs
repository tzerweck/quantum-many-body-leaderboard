// Generate figures/energy-vs-compute*.svg: what each published energy cost in GPU-hours
// against how far it sits from its instance's reference. This is the accuracy-versus-cost
// view the field argues about informally, drawn from the `compute` blocks (DATA.md) - and
// only from them, so it is as sparse as the papers are: after the 2026-09-16 pass 12 rows
// state GPU-hours and 13 more state a device count and a wall-clock.
//
// Two rules decide what can appear. The stored fields are never derived (DATA.md), so a
// row that says "20 A100 for four days" carries those three facts and a null gpu_hours;
// this figure multiplies devices by wall-clock at draw time and marks such a point as
// derived, which is the one place that product exists. CPU core-hours never share an
// axis with GPU-hours - a conversion between them would be an argument - so the 52 rows
// that state CPU time are counted in the footnote and not drawn.
//
// The reference is the exact energy where one exists, else the record (as in
// size_accuracy.mjs); a row that is itself the record has no distance and sits in the
// band above the plot. Cost runs along x and accuracy up y on an inverted log scale, as
// in the size figures: closer to the reference is higher. Nothing here says how
// converged a record is.
import { recordEligible } from "./units.mjs";
import { collect, recordOf, exactRecordOf } from "./summary.mjs";
import { FAMILIES, family } from "./views.mjs";
import { W, PAD, n, text, hline, dot, legend, header, footnote, doc, textWidth, writer, log, logScale, pow10 } from "./chart.mjs";

const OUT = "figures";
const instances = collect();
const { write, written } = writer(OUT);

// Total durations only. Anything per step, per sweep or cumulative over several sizes is
// not this run's wall-clock and stays unparsed; the row then has no point on this figure.
export function wallClockHours(s) {
  if (!s) return null;
  s = s.trim().toLowerCase();
  if (/per |cumulative|step|iteration|sweep|multiplication|within|about|around|~/.test(s)) return null;
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
  let m;
  if ((m = s.match(/^(\d+):(\d{2}):(\d{2})(?:\s*\(hh:mm:ss\))?$/))) return +m[1] + m[2] / 60 + m[3] / 3600;
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:h|hours?|hrs?)\b/))) return +m[1];
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:d|days?)\b/))) return 24 * m[1];
  if ((m = s.match(/^([a-z]+)\s*days?$/)) && words[m[1]]) return 24 * words[m[1]];
  if ((m = s.match(/^(\d+(?:\.\d+)?)\s*(?:min|minutes?)$/))) return m[1] / 60;
  return null;
}

// GPU-hours for a row: stated, or devices x wall-clock, or nothing.
function gpuHours(c) {
  if (!c) return null;
  if (c.gpu_hours != null) return { hours: c.gpu_hours, derived: false };
  if (c.n_devices != null && c.wall_clock) {
    const h = wallClockHours(c.wall_clock);
    if (h != null) return { hours: c.n_devices * h, derived: true };
  }
  return null;
}

const MODEL = { J1J2: "J1-J2", Heisenberg: "Heisenberg", Hubbard: "Hubbard", TFIsing: "TFIM", tV: "t-V", Impurity: "impurity" };
function instLabel(i) {
  const lat = i.lattice.replace(/^rectangular-/, "").replace(/^square$/, `${Math.sqrt(i.n_sites)}×${Math.sqrt(i.n_sites)}`);
  const extra = i.params.J2 != null ? `, J2 = ${i.params.J2}` : i.params.U != null ? `, U = ${i.params.U}` : "";
  return `${MODEL[i.model] ?? i.model} ${lat}${/×|x/.test(lat) ? "" : ` ${i.n_sites}`}${extra}`;
}

const pts = [], cpuRows = [];
let stated = 0, derived = 0;
for (const inst of instances) {
  const exact = exactRecordOf(inst);
  const ref = exact ? { row: exact, kind: "exact" } : (r => r && { row: r, kind: "record" })(recordOf(inst));
  for (const r of inst.rows) {
    if (r.compute?.cpu_core_hours != null) cpuRows.push(r);
    const g = gpuHours(r.compute);
    if (!g || r.defect || !ref) continue;
    if (g.derived) derived++; else stated++;
    const holder = r === ref.row;
    pts.push({ r, inst, fam: family(r.method), hours: g.hours, derived: g.derived, holder, refKind: ref.kind,
      gap: holder ? 0 : Math.abs(r.energy - ref.row.energy) / Math.abs(ref.row.energy), eligible: recordEligible(r) });
  }
}

// Four categorical slots, assigned in FAMILIES order to the families present; a fifth
// family and beyond fold into grey rather than take a colour the palette does not have.
const present = [...FAMILIES.map(f => f[0]), "other"].filter(f => pts.some(p => p.fam === f));
const slot = new Map(present.map((f, k) => [f, k < 4 ? k : null]));

write("energy-vs-compute", t => {
  const h = header(t, "What a published energy cost, against how far it sits from the reference",
    `${pts.length} energies whose papers state what they cost in GPU-hours (${stated}) or as a device count and a wall-clock (${derived}), ` +
    "on the instances they were computed for. Distance is from the exact energy where one exists, else from the record, and closer is higher; a record holder sits in the band above the plot.");
  const items = present.map(f => ({ kind: "dot", color: slot.get(f) == null ? t.recessive[1] : t.series[slot.get(f)], label: f }));
  const lg = legend(t, [...items, { kind: "ring", color: t.ink2, label: "GPU-hours derived from devices × wall-clock" }], h.bottom + 34);
  const band = lg.bottom + 40, top = band + 30, bottom = top + 320, left = PAD + 62, right = W - PAD - 8;
  const hs = pts.map(p => p.hours);
  const x0 = 10 ** Math.floor(log(Math.min(...hs))), x1 = 10 ** Math.ceil(log(Math.max(...hs)));
  const gaps = pts.filter(p => !p.holder).map(p => p.gap);
  const y0 = 10 ** Math.floor(log(Math.min(...gaps))), y1 = 10 ** Math.ceil(log(Math.max(...gaps)));
  const X = logScale(x0, x1, left, right), Y = logScale(y0, y1, top, bottom);
  const parts = [h.svg, lg.svg];
  for (let k = log(y0); k <= log(y1); k++) {
    parts.push(hline(left, right, Y(10 ** k), t.grid));
    parts.push(text(left - 8, Y(10 ** k) + 4, pow10(k), { size: 11, fill: t.muted, anchor: "end", nums: true }));
  }
  for (let k = log(x0); k <= log(x1); k++)
    parts.push(text(X(10 ** k), bottom + 18, pow10(k), { size: 11, fill: t.muted, anchor: "middle", nums: true }));
  parts.push(text((left + right) / 2, bottom + 38, "GPU-hours, as reported (device model in the row)", { size: 12, fill: t.ink2, anchor: "middle" }));
  parts.push(`<text transform="translate(${n(left - 46)} ${n((top + bottom) / 2)}) rotate(-90)" font-size="12" fill="${t.ink2}" text-anchor="middle">relative distance from the reference (closer is higher)</text>`);
  parts.push(hline(left, right, band, t.grid));
  parts.push(text(left - 8, band + 4, "holds the record", { size: 9.5, fill: t.muted, anchor: "end" }));

  const color = p => slot.get(p.fam) == null ? t.recessive[1] : t.series[slot.get(p.fam)];
  const placed = pts.map(p => ({ p, x: X(p.hours), y: p.holder ? band : Y(p.gap) }));
  // The rows of one instance are joined by a faint line in order of cost - the
  // per-instance trade-off, which is what a Pareto view is - and the instance is named once,
  // beside its costliest row. Names are nudged apart vertically where two would overlap.
  const byInst = Map.groupBy(placed.filter(q => !q.p.holder), q => q.p.inst.instance_id);
  const labels = [];
  for (const qs of byInst.values()) {
    qs.sort((a, b) => a.x - b.x);
    if (qs.length > 1) parts.push(`<path d="${qs.map((q, k) => `${k ? "L" : "M"}${n(q.x)} ${n(q.y)}`).join("")}" fill="none" stroke="${t.recessive[0]}" stroke-width="1.5"/>`);
    const q = qs.at(-1), s = instLabel(q.p.inst), w = textWidth(s, 11), rightSide = q.x + 10 + w <= right;
    labels.push({ s, w, x: rightSide ? q.x + 10 : qs[0].x - 10, anchor: rightSide ? "start" : "end", y: q.y + 4 });
  }
  for (const q of placed) parts.push(dot(t, q.x, q.y, color(q.p), !q.p.derived));
  labels.sort((a, b) => a.y - b.y);
  for (let a = 1; a < labels.length; a++) {
    const prev = labels[a - 1], cur = labels[a];
    const span = l => (l.anchor === "start" ? [l.x, l.x + l.w] : [l.x - l.w, l.x]);
    const [p0, p1] = span(prev), [c0, c1] = span(cur);
    if (c0 < p1 && p0 < c1 && cur.y - prev.y < 13) cur.y = prev.y + 13;
  }
  for (const l of labels) parts.push(text(l.x, l.y, l.s, { size: 11, fill: t.ink2, anchor: l.anchor }));
  // Record holders are listed under the plot rather than labelled at their marks.
  const holders = placed.filter(q => q.p.holder).sort((a, b) => a.x - b.x)
    .map(q => `${instLabel(q.p.inst)} (${q.p.r.method.split(/\s*[(,]/)[0].trim()}, ${Math.round(q.p.hours)} GPU-h${q.p.derived ? ", derived" : ""})`);
  const hl = holders.length ? footnote(t, `Record holders in the top band, cheapest first: ${holders.join("; ")}.`, bottom + 66) : { svg: "", bottom: bottom + 40 };
  parts.push(hl.svg);

  const fn = footnote(t, `Stored fields are never derived: a row stating "20 A100 for four days" carries those facts and no GPU-hours, and the product is taken here, ` +
    `once, and marked. GPU generations are not normalised. ${cpuRows.length} further rows state CPU core-hours and are not drawn: CPU and GPU time do not share an axis. ` +
    "Filled marks in the size figures mean record-eligible; here they mean GPU-hours as stated.", hl.bottom + 26);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "What a published energy cost, against how far it sits from the reference",
    pts.map(p => `${instLabel(p.inst)}: ${p.r.method.split(/\s*[(,]/)[0]} ${Math.round(p.hours)} GPU-h${p.derived ? " (derived)" : ""}, distance ${p.holder ? "0 (record)" : p.gap.toExponential(1)}`).join("; "), parts);
});

console.log(`${OUT}/: ${written.length} files (energy vs compute: ${pts.length} rows, ${stated} stated + ${derived} derived GPU-hours; ${cpuRows.length} CPU-hour rows not drawn)`);
