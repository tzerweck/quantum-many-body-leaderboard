// Generate figures/energy-vs-compute*.svg, figures/energy-vs-parameters*.svg and one
// figures/cost/<instance>*.svg per instance with enough costed energies: on one
// instance, what the best published energies are at each cost. The question is not how
// far a number sits from the exact answer but which results are the best ones (Tristan,
// 2026-09-16), so the axis is the energy itself and the frontier runs through whatever
// holds it at each cost - an exact diagonalization with its CPU-hours as readily as a
// variational bound with its GPU-hours. Panels are per instance, as energies of different
// Hamiltonians are not comparable, and only instances with enough costed rows are drawn.
//
// Costs come from the `compute` blocks (DATA.md) and only from them, read by cost.mjs.
// Three axes: hours, parameter count, and estimated FLOPs. A GPU-hour and a CPU core-hour
// share the hours axis with different marks and are never converted into each other - the
// reader sees the unit, and DATA.md forbids any equivalence. The FLOPs axis is an estimate
// evaluated by flops.mjs from the stated parameter, sample and iteration counts (Tristan,
// 2026-09-21); it is drawn in its own figures and never on the hours axis, since turning
// one into the other is the conversion DATA.md forbids. The per-instance figures are hours
// (figures/cost/) and estimated FLOPs (figures/flops/): cost means compute (Tristan,
// 2026-09-16), and they are what the site shows, on the front page behind a badge per
// instance and in the instance's row of the table.
//
// The frontier is the staircase of results nothing beats for less: sorted by cost, a row
// is on it when its energy is below every cheaper row that could hold a record (RULES.md
// 6: a strict bound with an error bar, or a ground-state exact energy). Projections and
// extrapolations are drawn but never on the frontier, as they are not bounds.
import fs from "node:fs";
import { recordEligible, exactEligible, boundLabel, perSiteDivisor, perSiteLabel } from "./units.mjs";
import { collect, recordOf } from "./summary.mjs";
import { hoursOf, hoursOrEdOf, parametersOf, MIN_COSTED, costFigureName, flopsFigureName, paramsFigureName } from "./cost.mjs";
import { estimatedFlopsOf } from "./flops.mjs";
import { W, PAD, n, text, hline, dot, legend, header, footnote, doc, textWidth, niceStep, writer, log, logScale, pow10, shortLabel, rowHref, linked } from "./chart.mjs";

const OUT = "figures";
const instances = collect();
const { write, written } = writer(OUT);
const BOUNDS = { variational: 0, projected: 1, extrapolated: 2, exact: 3 };


const MODEL = { J1J2: "J1-J2", Heisenberg: "Heisenberg", Hubbard: "Hubbard", TFIsing: "TFIM", tV: "t-V", Impurity: "impurity" };
function instLabel(i) {
  const side = Math.sqrt(i.n_sites);
  const lat = i.lattice.replace(/^rectangular-/, "").replace(/^square$/, Number.isInteger(side) ? `${side}×${side}` : "square");
  const extra = i.params.J2 != null ? `, J2 = ${i.params.J2}` : i.params.U != null ? `, U = ${i.params.U}, n = ${(2 * i.params.Nf / i.n_sites).toFixed(3).replace(/0+$/, "")}` : "";
  const bc = { O: ", open", PO: ", cylinder", PA: ", periodic-antiperiodic", A: ", antiperiodic" }[i.boundary] ?? "";
  return `${MODEL[i.model] ?? i.model} ${lat}${/×|x/.test(lat) ? "" : ` ${i.n_sites}`}${extra}${bc}`;
}

// The costed rows of an instance under one cost accessor, which sees the compute block,
// the row and the instance (an estimate needs all three). A row on the frontier can hold
// a record; exact rows count only when they state the ground state.
function costed(inst, costOf) {
  const f = perSiteDivisor(inst);
  return inst.rows.filter(r => r.bound_type in BOUNDS && !r.defect).flatMap(r => {
    const cost = costOf(r.compute, r, inst);
    if (!cost || !(r.bound_type !== "exact" || exactEligible(r))) return [];
    return [{ r, inst, cost, e: r.energy / f, eligible: r.bound_type === "exact" ? exactEligible(r) : recordEligible(r) }];
  });
}
function frontierOf(pts) {
  const out = [];
  let best = Infinity;
  for (const p of [...pts].sort((a, b) => a.cost.value - b.cost.value || a.e - b.e)) {
    if (!p.eligible) continue;
    if (p.e < best) { best = p.e; out.push(p); }
  }
  return out;
}

// Square marks for CPU core-hours, circles for everything else. Every result is a mark and
// only a mark (Tristan, 2026-09-23): no whisker for a derived cost, which the footnote counts
// instead. Same surface ring and filled/hollow convention as dot().
function mark(t, x, y, color, filled, unit, href) {
  const out = [];
  if (unit === "cpu") {
    out.push(`<rect x="${n(x - 6.5)}" y="${n(y - 6.5)}" width="13" height="13" rx="2" fill="${t.surface}"/>`);
    out.push(filled
      ? `<rect x="${n(x - 4.5)}" y="${n(y - 4.5)}" width="9" height="9" rx="1.5" fill="${color}"/>`
      : `<rect x="${n(x - 4)}" y="${n(y - 4)}" width="8" height="8" rx="1.5" fill="${t.surface}" stroke="${color}" stroke-width="2"/>`);
  } else out.push(dot(t, x, y, color, filled));
  return linked(href, out.join(""));
}

// One instance's energies against their cost, into the box given: the energy axis is
// linear and per site, the cost axis logarithmic, the frontier as a staircase with its
// points named. Every result is a dot - an exact diagonalization or a QMC energy as much as
// a variational one - and only a result with a cost can be placed; a record that states no
// cost is named in a line of text under the axis, never drawn as a line across it
// (Tristan, 2026-09-23). QMBL's own runs are all named, so none is read as published.
// The method with its whole detail, for a key or an enlarged panel, where there is room.
const fullLabel = r => (r.computed_by === "qmbl" ? shortLabel(r) : `${r.method}${r.method_detail ? ` (${r.method_detail})` : ""}`);

// An instance's own figure: every mark named. Where three or more marks are too close to name
// in place, their region is boxed and drawn again below at its own scale. Returns the y the
// footnote starts at.
function drawInstance(t, parts, inst, pts, g) {
  const trial = [], crowd = [];
  const k0 = drawPanel(t, trial, inst, pts, { ...g, nameAll: true, keyOut: crowd });
  if (crowd.length < 3) { parts.push(...trial); return g.bottom + 70 + k0; }
  const cs = crowd.map(p => log(p.cost.value)), es = crowd.map(p => p.e);
  const espan = Math.max(Math.max(...es) - Math.min(...es), 1e-9);
  const box = { c0: 10 ** (Math.min(...cs) - 0.06), c1: 10 ** (Math.max(...cs) + 0.06), e0: Math.min(...es) - 0.2 * espan, e1: Math.max(...es) + 0.2 * espan };
  const inBox = pts.filter(p => p.cost.value >= box.c0 && p.cost.value <= box.c1 && p.e >= box.e0 && p.e <= box.e1);
  const k1 = drawPanel(t, parts, inst, pts, { ...g, nameAll: true, hide: new Set(inBox), box });
  const top2 = g.bottom + 70 + k1 + 26, bottom2 = top2 + plotHeight(inBox);
  parts.push(text(g.px, top2 - 14, "The boxed region, enlarged", { size: 11.5, fill: t.ink, weight: 600 }));
  const k2 = drawPanel(t, parts, inst, inBox, { ...g, top: top2, bottom: bottom2, nameAll: true, tight: true,
    frontIn: frontierOf(pts).filter(p => inBox.includes(p)), recNoteOn: false });
  return bottom2 + 70 + k2;
}

// An instance's own figure names every mark, so it grows with the marks it holds: 300 px for
// up to twelve, 16 px more for each beyond (the 26 rows on J1-J2 10x10's parameter axis).
const plotHeight = pts => 300 + 16 * Math.max(0, pts.length - 12);

// Labels the placement could not keep off the frontier line; the build prints them.
const labelClashes = [];

function drawPanel(t, parts, inst, pts, { px, left, right, top, bottom, xLabel, title, nameAll = false,
  hide = null, box = null, tight = false, frontIn = null, recNoteOn = true, keyOut = null }) {
  const plotH = bottom - top;
    const rec = recordOf(inst), recE = rec ? rec.energy / perSiteDivisor(inst) : null;
    const front = frontIn ?? frontierOf(pts);
    // An enlarged panel names each mark in full: its neighbours there are the ones it is confused with.
    const nameOf = p => (tight ? fullLabel(p.r) : shortLabel(p.r)) + (p.cost.measuredByQmbl ? " (cost measured by QMBL)" : "");
    if (title) parts.push(text(px, top - 14, title, { size: 12.5, fill: t.ink, weight: 600 }));
    parts.push(text(right, top - 14, perSiteLabel(inst), { size: 9.5, fill: t.muted, anchor: "end" }));
    // Cost axis: a decade either side of the data. Energy axis: linear, as in the
    // record-over-time figure, so the record and an exact energy sit where they are.
    const cs = pts.map(p => p.cost.value);
    const lo = log(Math.min(...cs)), hi = log(Math.max(...cs)), wide = Math.max(0.3 - (hi - lo), 0) / 2;
    const x0 = tight ? 10 ** (lo - 0.12 - wide) : 10 ** Math.floor(lo - 0.5), x1 = tight ? 10 ** (hi + 0.12 + wide) : 10 ** Math.ceil(hi + 0.5);
    const X = logScale(x0, x1, left, right);
    const es = pts.map(p => p.e);
    const span = Math.max(Math.max(...es) - Math.min(...es), 1e-6);
    const step = niceStep(span / 4);
    const e0 = Math.floor((Math.min(...es) - span * 0.08) / step) * step;
    const e1 = Math.ceil((Math.max(...es) + span * 0.08) / step) * step;
    const Y = e => bottom - ((e - e0) / (e1 - e0)) * plotH;
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    for (let i = 0; i <= Math.round((e1 - e0) / step); i++) {
      const v = e0 + i * step;
      parts.push(hline(left, right, Y(v), t.grid));
      parts.push(text(left - 6, Y(v) + 4, v.toFixed(decimals).replace("-", "−"), { size: 10, fill: t.muted, anchor: "end", nums: true }));
    }
    if (!tight)
      for (let k2 = Math.ceil(log(x0)); k2 <= Math.floor(log(x1)); k2++)
        parts.push(text(X(10 ** k2), bottom + 16, pow10(k2), { size: 10, fill: t.muted, anchor: "middle", nums: true }));
    else  // an enlarged range may hold no power of ten: 1, 2 and 5 of each decade
      for (let k2 = Math.floor(log(x0)); k2 <= Math.ceil(log(x1)); k2++)
        for (const m of [1, 2, 5]) {
          const v = m * 10 ** k2;
          if (v >= x0 && v <= x1) parts.push(text(X(v), bottom + 16, m === 1 ? pow10(k2) : `${m}×${pow10(k2)}`, { size: 10, fill: t.muted, anchor: "middle", nums: true }));
        }
    if (front.length > 1) {
      let d = `M${n(X(front[0].cost.value))} ${n(Y(front[0].e))}`;
      for (const p of front.slice(1)) d += `H${n(X(p.cost.value))}V${n(Y(p.e))}`;
      parts.push(`<path d="${d}" fill="none" stroke="${t.series[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.7"/>`);
    }
    for (const p of [...pts].sort((a, b) => a.eligible - b.eligible))
      parts.push(mark(t, X(p.cost.value), Y(p.e), t.series[BOUNDS[p.r.bound_type]], p.eligible, p.cost.unit, rowHref(p.inst, p.r)));
    // An instance's own figure names every mark (Tristan, 2026-09-24: a dot without a name
    // cannot be read); the small overview panels name the frontier only, where naming them
    // all piles the labels on each other. Frontier points are placed first.
    const named = new Set([...front, ...(nameAll ? pts : [])].filter(p => !hide?.has(p)));
    if (box) {
      // at least clear of the marks it frames; the panel below says what the box is
      const bx0 = X(box.c0) - 8, bx1 = X(box.c1) + 8, by0 = Y(box.e1) - 8, by1 = Y(box.e0) + 8;
      parts.push(`<rect x="${n(bx0)}" y="${n(by0)}" width="${n(bx1 - bx0)}" height="${n(by1 - by0)}" fill="none" stroke="${t.muted}" stroke-width="1" stroke-dasharray="3 3" rx="3"/>`);
    }
    // A label may not run across another mark or the frontier: of the spots it fits, the one
    // covering fewest wins (a "ViT (QMBL)" label over a published ViT's dot reads as ours, and
    // the staircase leaves every frontier point to the right, through a label placed there).
    const centres = pts.map(p => [X(p.cost.value), Y(p.e)]);
    const segs = front.slice(1).flatMap((p, i) => {
      const x0 = X(front[i].cost.value), y0 = Y(front[i].e), x1 = X(p.cost.value), y1 = Y(p.e);
      return [{ x0, x1, y0, y1: y0 }, { x0: x1, x1, y0, y1 }];
    });
    // The label's glyph box: baseline at ty + 4, cap height about 8 at 10.5 px.
    const crosses = (x0, x1, ty) => segs.filter(g => Math.max(g.x0, x0 - 1) <= Math.min(g.x1, x1 + 1) &&
      Math.max(Math.min(g.y0, g.y1), ty - 5) <= Math.min(Math.max(g.y0, g.y1), ty + 7)).length;
    const covers = (x0, x1, y, self) => centres.filter(([cx, cy]) => !(cx === self?.[0] && cy === self?.[1]) && cx + 6 > x0 && cx - 6 < x1 && Math.abs(cy - y) < 9).length + crosses(x0, x1, y);
    // Placed top to bottom, each label also avoiding the labels placed before it.
    const placed = [];
    const onLabel = c => placed.filter(l => c.x0 < l.x1 && l.x0 < c.x1 && Math.abs(c.ty - l.ty) < 12).length;
    const allLabels = [...named].sort((a, b) => front.includes(b) - front.includes(a) || Y(a.e) - Y(b.e)).map(p => {
      const s = nameOf(p), w = textWidth(s, 10.5), x = X(p.cost.value), y = Y(p.e);
      // Beside the mark on the right, then the left, then above or below it, then diagonally;
      // the first that fits the plot and covers nothing, else the one covering fewest.
      const spots = [
        { x0: x + 10, x1: x + 10 + w, ty: y, anchor: "start", lx: x + 10 },
        { x0: x - 10 - w, x1: x - 10, ty: y, anchor: "end", lx: x - 10 },
        { x0: x - 4, x1: x - 4 + w, ty: y - 20, anchor: "start", lx: x - 4 },
        { x0: x - 4, x1: x - 4 + w, ty: y + 16, anchor: "start", lx: x - 4 },
        { x0: x + 8, x1: x + 8 + w, ty: y + 14, anchor: "start", lx: x + 8 },
        { x0: x + 8, x1: x + 8 + w, ty: y - 13, anchor: "start", lx: x + 8 },
        { x0: x - 8 - w, x1: x - 8, ty: y + 14, anchor: "end", lx: x - 8 },
        { x0: x - 8 - w, x1: x - 8, ty: y - 13, anchor: "end", lx: x - 8 },
        { x0: x - 4, x1: x - 4 + w, ty: y - 32, anchor: "start", lx: x - 4 },
        { x0: x - 4, x1: x - 4 + w, ty: y + 28, anchor: "start", lx: x - 4 },
        { x0: x - w + 4, x1: x + 4, ty: y - 32, anchor: "end", lx: x + 4 },
        { x0: x - w + 4, x1: x + 4, ty: y + 28, anchor: "end", lx: x + 4 },
      ].filter(c => c.x0 >= left && c.x1 <= right && c.ty - 8 > top && c.ty + 4 < bottom);
      // In a narrow panel nothing beside the mark may fit: centred above or below it, kept inside.
      const cx = Math.min(Math.max(x - w / 2, left), right - w);
      // Then farther up or down, clear of the staircase's vertical through the mark itself.
      for (const ty of [y - 13, y + 16, y - 26, y + 29, y - 39, y + 42]) {
        if (ty - 8 <= top || ty + 4 >= bottom) continue;
        spots.push({ x0: cx, x1: cx + w, ty, anchor: "start", lx: cx });
        if (x + 8 + w <= right) spots.push({ x0: x + 8, x1: x + 8 + w, ty, anchor: "start", lx: x + 8 });
        if (x - 8 - w >= left) spots.push({ x0: x - 8 - w, x1: x - 8, ty, anchor: "end", lx: x - 8 });
      }
      const hits = c => covers(c.x0, c.x1, c.ty, [x, y]) + onLabel(c);
      const pick = spots.find(c => hits(c) === 0) ?? [...spots].sort((c1, c2) => hits(c1) - hits(c2))[0] ?? { x0: x + 10, x1: x + 10 + w, lx: x + 10, anchor: "start", ty: y };
      // In a crowd a name away from its mark's own row reads as its neighbour's: number it.
      const crowded = centres.some(([cx, cy]) => (cx !== x || cy !== y) && Math.hypot(cx - x, cy - y) < 24);
      if (nameAll && (hits(pick) > 0 || (pick.ty !== y && crowded))) return { keyed: true, s: fullLabel(p.r) + (p.cost.measuredByQmbl ? " (cost measured by QMBL)" : ""), p, dx: x, dy: y };
      placed.push(pick);
      return { s, w, x: pick.lx, anchor: pick.anchor, y: pick.ty + 4, forced: hits(pick) > 0 };
    });
    // Numbered marks, left to right, the number in the first free spot touching the mark.
    const keyed = allLabels.filter(l => l.keyed).sort((a, b) => a.dx - b.dx || a.dy - b.dy);
    keyed.forEach((k, i) => {
      const num = String(i + 1), w = textWidth(num, 9), { dx: x, dy: y } = k;
      const spots = [
        { x0: x + 7, x1: x + 7 + w, ty: y, anchor: "start", lx: x + 7 },
        { x0: x - 7 - w, x1: x - 7, ty: y, anchor: "end", lx: x - 7 },
        { x0: x - w / 2, x1: x + w / 2, ty: y - 10, anchor: "middle", lx: x },
        { x0: x - w / 2, x1: x + w / 2, ty: y + 11, anchor: "middle", lx: x },
      ];
      const hits = c => covers(c.x0, c.x1, c.ty, [x, y]) + onLabel(c);
      const pick = spots.find(c => hits(c) === 0) ?? [...spots].sort((c1, c2) => hits(c1) - hits(c2))[0];
      placed.push(pick);
      Object.assign(k, { num, x: pick.lx, y: pick.ty + 3, anchor: pick.anchor });
    });
    const labels = allLabels.filter(l => !l.keyed).sort((a, b) => a.y - b.y);
    keyOut?.push(...keyed.map(k => k.p));
    // Two keyed marks with one name are told apart by their source.
    for (const k of keyed) if (keyed.filter(o => o.s === k.s).length > 1 && k.p.r.arxiv) k.s += ` [arXiv:${k.p.r.arxiv}]`;
    // Nudged down only past labels they actually overlap, horizontally as well as vertically.
    const extent = l => l.anchor === "start" ? [l.x, l.x + l.w] : [l.x - l.w, l.x];
    labels.sort((a, b) => a.y - b.y);
    for (let a = 1; a < labels.length; a++) {
      if (!labels[a].forced) continue;
      const [a0, a1] = extent(labels[a]);
      for (let b = 0; b < a; b++) {
        const [b0, b1] = extent(labels[b]);
        if (a0 < b1 && b0 < a1 && Math.abs(labels[a].y - labels[b].y) < 12) {
          labels[a].y = labels[b].y + 12;
          // pushed onto the frontier line: step on past it
          for (let k = 0; k < 3 && crosses(a0, a1, labels[a].y - 4); k++) labels[a].y += 12;
        }
      }
    }
    for (const l of labels) {
      const [l0, l1] = extent(l);
      if (crosses(l0, l1, l.y - 4)) labelClashes.push(`${instLabel(inst)}: "${l.s}"`);
      parts.push(text(l.x, l.y, l.s, { size: 10.5, fill: t.ink2, anchor: l.anchor }));
    }
    for (const k of keyed) parts.push(text(k.x, k.y, k.num, { size: 9, fill: t.ink2, anchor: k.anchor, weight: 600 }));
    parts.push(text((left + right) / 2, bottom + 32, xLabel, { size: 10.5, fill: t.ink2, anchor: "middle" }));
    const recNote = recNoteOn && rec && !pts.some(p => p.r === rec);
    if (recNote)
      parts.push(text(left, bottom + 48, `${rec.bound_type === "exact" ? boundLabel(rec) : "record"}: ${recE.toFixed(6).replace("-", "−")} (${shortLabel(rec)}), no cost stated, not drawn`, { size: 9.5, fill: t.muted }));
    if (!keyed.length) return 0;
    // The key: "1 ViT   2 fViT ...", wrapped to the plot's width.
    const lines = [[]];
    let used = 0;
    for (const k of keyed) {
      const item = `${k.num} ${k.s}`, w = textWidth(item, 10) + textWidth("  ·  ", 10);
      if (used + w > right - left && lines.at(-1).length) { lines.push([]); used = 0; }
      lines.at(-1).push(item); used += w;
    }
    const y0 = bottom + (recNote ? 64 : 50);
    lines.forEach((l, i) => parts.push(text(left, y0 + 14 * i, l.join("  ·  "), { size: 10, fill: t.ink2 })));
    return y0 + 14 * (lines.length - 1) - (bottom + 48) + 8;
}

function costFigure({ name, title, subtitle, costOf, minRows, xLabel, legendItems, footer, describe }) {
  const panels = instances.map(inst => ({ inst, pts: costed(inst, costOf) })).filter(p => p.pts.length >= minRows)
    .sort((a, b) => b.pts.length - a.pts.length || a.inst.instance_id.localeCompare(b.inst.instance_id));
  write(name, t => {
    const cols = 3, plotH = 170, pitch = plotH + 92, panelW = (W - 2 * PAD - 2 * 30) / cols;
    const h = header(t, title, subtitle(panels));
    const lg = legend(t, legendItems(t), h.bottom + 34);
    const top0 = lg.bottom + 46;
    const parts = [h.svg, lg.svg];
    panels.forEach(({ inst, pts }, k) => {
      const col = k % cols, row = Math.floor(k / cols);
      const px = PAD + col * (panelW + 30), left = px + 54, right = px + panelW - 4;
      const top = top0 + row * pitch, bottom = top + plotH;
      drawPanel(t, parts, inst, pts, { px, left, right, top, bottom, xLabel, title: instLabel(inst) });
    });
    const y = top0 + (Math.ceil(panels.length / cols) - 1) * pitch + plotH + 70;
    const fn = footnote(t, footer(panels), y);
    parts.push(fn.svg);
    return doc(t, fn.bottom + 24, title, describe(panels), parts);
  });
  return panels;
}

const HOURS_LEGEND = t => [
  { kind: "dot", color: t.series[0], label: "Variational bound" },
  { kind: "dot", color: t.series[1], label: "Projected" },
  { kind: "dot", color: t.series[2], label: "Extrapolated" },
  { kind: "dot", color: t.series[3], label: "Exact" },
  { kind: "ring", color: t.ink2, label: "Cannot hold a record" },
  { kind: "line", color: t.series[0], label: "Frontier" },
];
// The marks, the derived hours and QMBL's own runs (Tristan, 2026-09-18 and 09-23): the
// no-conversion rule and the bound kinds are said in the page text and the legend.
function HOURS_FOOTER(all, overview = false) {
  const cpu = all.filter(p => p.cost.unit === "cpu").length, der = all.filter(p => p.cost.derived).length;
  const own = all.filter(p => p.r.computed_by === "qmbl").length;
  const ed = all.filter(p => p.cost.measuredByQmbl);
  const rows = k => `${k} row${k === 1 ? "" : "s"}`;
  return (cpu ? `Circles are GPU-hours, squares CPU core-hours (${rows(cpu)}).` : "Every mark is GPU-hours.") +
    (der ? ` For ${rows(der)} the hours are devices × wall-clock, multiplied here.` : "") +
    (own ? ` Labels marked QMBL are QMBL's own reference runs${overview ? "; each instance's own figure names all of them" : ""}.` : "") +
    (ed.length ? ` An exact energy marked "cost measured by QMBL" is placed at what diagonalizing the instance cost QMBL, on ${[...new Set(ed.map(p => `${p.inst.qmbl_ed_cost.cores} core${p.inst.qmbl_ed_cost.cores === 1 ? "" : "s"} of an ${p.inst.qmbl_ed_cost.cpu}`))].join(" or ")}, with only particle number or Sz conserved.` : "");
}
const describeHours = panels => panels.map(({ inst, pts }) => `${instLabel(inst)}: ${pts.map(p => `${shortLabel(p.r)} ${Math.round(p.cost.value)} ${p.cost.unit === "cpu" ? "CPU-h" : "GPU-h"}${p.cost.derived ? " (derived)" : ""} ${p.e.toFixed(6)}`).join(", ")}`).join("; ");

const hoursPanels = costFigure({
  name: "energy-vs-compute",
  title: "The best energies at each cost, instance by instance",
  subtitle: panels => `Every energy whose paper, or QMBL's own run, states what it cost in hours, on the ${panels.length} instances with at least two such rows. ` +
    "Colour is the kind of number; filled marks can hold a record, hollow ones cannot.",
  costOf: hoursOrEdOf, minRows: MIN_COSTED,
  xLabel: "hours, as reported",
  legendItems: HOURS_LEGEND,
  footer: panels => HOURS_FOOTER(panels.flatMap(p => p.pts), true),
  describe: describeHours,
});

// One figure per instance with at least MIN_COSTED energies costed in hours. The directory
// is emptied first, so an instance that loses a cost loses its figure rather than keeping
// a stale one the site would still inline.
const COST_DIR = "figures/cost";
fs.rmSync(COST_DIR, { recursive: true, force: true });
fs.mkdirSync(COST_DIR, { recursive: true });
const own = writer("figures");
for (const { inst, pts } of hoursPanels) {
  const name = costFigureName(inst);
  const title = `${instLabel(inst)}: the best energies at each cost`;
  own.write(name, t => {
    const h = header(t, title, "Every energy on this instance whose paper, or QMBL's own run, states what it cost in hours.");
    const lg = legend(t, HOURS_LEGEND(t), h.bottom + 34);
    const top = lg.bottom + 36, bottom = top + plotHeight(pts), left = PAD + 66, right = W - PAD - 8;
    const parts = [h.svg, lg.svg];
    const fn = footnote(t, HOURS_FOOTER(pts), drawInstance(t, parts, inst, pts, { px: PAD, left, right, top, bottom, xLabel: "hours, as reported", title: null }));
    parts.push(fn.svg);
    return doc(t, fn.bottom + 24, title, describeHours([{ inst, pts }]), parts);
  });
}

// Estimated FLOPs: the same frontier construction on the model's estimate (flops.mjs). The
// footnote counts the estimates that needed an architectural assumption.
const FLOPS_LEGEND = t => [
  { kind: "dot", color: t.series[0], label: "Variational bound" },
  { kind: "dot", color: t.series[1], label: "Projected" },
  { kind: "dot", color: t.series[2], label: "Extrapolated" },
  { kind: "ring", color: t.ink2, label: "Cannot hold a record" },
  { kind: "line", color: t.series[0], label: "Frontier" },
];
// One sentence per model drawn (flops.mjs): what it counts and what it leaves out.
const FLOPS_MODEL = {
  "nqs-v1": "Network estimates: iterations × samples × (connected configurations + sampler passes + 3) × forward-pass FLOPs, " +
    "from the counts the paper states; the optimizer's solve, symmetry projections and pre-training are not counted.",
  "dmrg-v1": "DMRG estimates: the dense tensor contractions of every sweep in the run script's schedule, plus its variance evaluations; " +
    "the saving from conserved quantum numbers is not counted, so a symmetric code does less arithmetic than this.",
};
function FLOPS_FOOTER(all) {
  const models = [...new Set(all.map(p => p.cost.estimate.model))].sort((a, b) => b.localeCompare(a));
  const low = all.filter(p => p.cost.derived).length;
  const own = all.filter(p => p.r.computed_by === "qmbl").length;
  return "Every mark is an estimate, good to an order of magnitude. " + models.map(m => FLOPS_MODEL[m]).join(" ") +
    (low ? ` ${low} of these estimate${low === 1 ? "" : "s"} needed an assumption (an architecture detail, or a Lanczos count taken from the calibration run).` : "") +
    (own ? ` Labels marked QMBL are QMBL's own reference runs (${own} row${own === 1 ? "" : "s"}).` : "");
}
const describeFlops = panels => panels.map(({ inst, pts }) => `${instLabel(inst)}: ${pts.map(p => `${shortLabel(p.r)} ${p.cost.value.toExponential(1)} FLOPs (estimated${p.cost.derived ? ", low confidence" : ""}) ${p.e.toFixed(6)}`).join(", ")}`).join("; ");

const flopsPanels = costFigure({
  name: "energy-vs-flops",
  title: "The best energies at each estimated cost in FLOPs, instance by instance",
  subtitle: panels => `Every published energy whose paper or run script states enough to estimate its cost in floating-point operations, on the ${panels.length} instances with at least two such rows. ` +
    "Colour is the kind of number; filled marks can hold a record, hollow ones cannot.",
  costOf: estimatedFlopsOf, minRows: MIN_COSTED,
  xLabel: "FLOPs, estimated",
  legendItems: FLOPS_LEGEND,
  footer: panels => FLOPS_FOOTER(panels.flatMap(p => p.pts)),
  describe: describeFlops,
});

const FLOPS_DIR = "figures/flops";
fs.rmSync(FLOPS_DIR, { recursive: true, force: true });
fs.mkdirSync(FLOPS_DIR, { recursive: true });
for (const { inst, pts } of flopsPanels) {
  const name = flopsFigureName(inst);
  const title = `${instLabel(inst)}: the best energies at each estimated cost in FLOPs`;
  own.write(name, t => {
    const h = header(t, title, "Every energy on this instance whose paper or run script states enough to estimate its cost in floating-point operations.");
    const lg = legend(t, FLOPS_LEGEND(t), h.bottom + 34);
    const top = lg.bottom + 36, bottom = top + plotHeight(pts), left = PAD + 66, right = W - PAD - 8;
    const parts = [h.svg, lg.svg];
    const fn = footnote(t, FLOPS_FOOTER(pts), drawInstance(t, parts, inst, pts, { px: PAD, left, right, top, bottom, xLabel: "FLOPs, estimated", title: null }));
    parts.push(fn.svg);
    return doc(t, fn.bottom + 24, title, describeFlops([{ inst, pts }]), parts);
  });
}

// Parameter count: the same construction on the ansatz size the paper prints, for the
// instances with at least three such rows (Tristan, 2026-09-23), overview and one figure per instance.
const PARAMS_LEGEND = t => [
  { kind: "dot", color: t.series[0], label: "Variational bound" },
  { kind: "dot", color: t.series[1], label: "Projected" },
  { kind: "dot", color: t.series[2], label: "Extrapolated" },
  { kind: "ring", color: t.ink2, label: "Cannot hold a record" },
  { kind: "line", color: t.series[0], label: "Frontier" },
];
const PARAMS_FOOTER = "Parameter counts as the papers print them; a count evaluated from a printed formula is marked medium confidence in the row. " +
  "Tensor-network bond dimensions and Monte Carlo sample counts are other costs and are not on this axis.";
const describeParams = panels => panels.map(({ inst, pts }) => `${instLabel(inst)}: ${pts.map(p => `${shortLabel(p.r)} ${p.cost.value} parameters ${p.e.toFixed(6)}`).join(", ")}`).join("; ");

const paramPanels = costFigure({
  name: "energy-vs-parameters",
  title: "The best energies at each parameter count, instance by instance",
  subtitle: panels => `Every published energy whose paper states the ansatz's parameter count, on the ${panels.length} instances with at least three such rows. ` +
    "Colour is the kind of number; filled marks can hold a record, hollow ones cannot.",
  costOf: parametersOf, minRows: 3,
  xLabel: "variational parameters",
  legendItems: PARAMS_LEGEND,
  footer: () => PARAMS_FOOTER,
  describe: describeParams,
});

const PARAMS_DIR = "figures/params";
fs.rmSync(PARAMS_DIR, { recursive: true, force: true });
fs.mkdirSync(PARAMS_DIR, { recursive: true });
for (const { inst, pts } of paramPanels) {
  const name = paramsFigureName(inst);
  const title = `${instLabel(inst)}: the best energies at each parameter count`;
  own.write(name, t => {
    const h = header(t, title, "Every energy on this instance whose paper states the ansatz's parameter count.");
    const lg = legend(t, PARAMS_LEGEND(t), h.bottom + 34);
    const top = lg.bottom + 36, bottom = top + plotHeight(pts), left = PAD + 66, right = W - PAD - 8;
    const parts = [h.svg, lg.svg];
    const fn = footnote(t, PARAMS_FOOTER, drawInstance(t, parts, inst, pts, { px: PAD, left, right, top, bottom, xLabel: "variational parameters", title: null }));
    parts.push(fn.svg);
    return doc(t, fn.bottom + 24, title, describeParams([{ inst, pts }]), parts);
  });
}

console.log(`${OUT}/: ${written.length + own.written.length} files (${hoursPanels.length} per-instance cost figures, ${flopsPanels.length} per-instance FLOPs figures, ${paramPanels.length} per-instance parameter figures; energy vs compute: ${hoursPanels.length} instances, ${hoursPanels.reduce((a, p) => a + p.pts.length, 0)} rows; ` +
  `energy vs estimated FLOPs: ${flopsPanels.length} instances, ${flopsPanels.reduce((a, p) => a + p.pts.length, 0)} rows; ` +
  `energy vs parameters: ${paramPanels.length} instances, ${paramPanels.reduce((a, p) => a + p.pts.length, 0)} rows)`);
if (labelClashes.length) console.log(`LABEL CLASHES with the frontier line (${labelClashes.length}): ${labelClashes.join("; ")}`);
