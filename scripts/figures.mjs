// Generate figures/*.svg - the README numbers, drawn. The drawing kit is chart.mjs.
import { recordEligible, perSiteDivisor, perSiteLabel } from "./units.mjs";
import { collect, recordOf } from "./summary.mjs";
import { sources } from "./enrich_sources.mjs";
import { citeRef, paperYear } from "./cite.mjs";
import { CONTESTED, FAMILIES, variationalRows } from "./views.mjs";
import { W, PAD, n, text, hline, hbar, vbar, onFill, dot, slashed, legend, header, footnote, doc, textWidth, pct, niceStep, writer, shortLabel } from "./chart.mjs";
import { layoutLabels, insetFrame, meets } from "./labels.mjs";

const OUT = "figures";
const cache = sources();
const instances = collect();
const byId = new Map(instances.map(i => [i.instance_id, i]));
const { write, written } = writer(OUT);

const yearOf = r => paperYear(r, cache);

// ---------------------------------------------------------- 1. the record over time
// Curated like the README frontier table, and for the same reason: these are the two
// instances the field competes on, and between them they show both kinds of story - a
// record taken again and again, and a record that newer, lower-looking numbers did not take.
const FRONTIER = [
  ["J1J2/square_100_P_0.5", "J1-J2 square 10×10, J2 = 0.5"],
  ["Hubbard/square_256_P_112_8", "Hubbard square 16×16, U = 8, n = 0.875"],
];
const BOUNDS = { variational: 0, projected: 1, extrapolated: 2 };


function frontierPanel([id, title]) {
  const inst = byId.get(id);
  const rec = recordOf(inst);
  const rows = inst.rows.filter(r => r.bound_type in BOUNDS);
  const f = perSiteDivisor(inst);
  const pts = rows.filter(yearOf).map(r => ({
    r, year: yearOf(r), eligible: recordEligible(r), e: r.energy / f,
    gap: (r.energy - rec.energy) / Math.abs(rec.energy),
  }));
  // Within a year, spread the marks sideways in energy order so none hides another, the
  // year's marks together no wider than 0.8 of a year.
  const byYear = Map.groupBy(pts, p => p.year);
  for (const group of byYear.values()) {
    group.sort((a, b) => a.gap - b.gap);
    const gapX = Math.min(0.3, 0.8 / group.length);
    group.forEach((p, k) => { p.dx = (k - (group.length - 1) / 2) * gapX; });
  }
  // The standing record: lowest eligible energy published up to each year.
  const steps = [];
  for (const year of [...byYear.keys()].sort()) {
    const best = Math.min(...byYear.get(year).filter(p => p.eligible).map(p => p.e));
    if (Number.isFinite(best) && (!steps.length || best < steps.at(-1).e)) steps.push({ year, e: best });
  }
  const bestProjected = pts.filter(p => p.r.bound_type === "projected").sort((a, b) => a.gap - b.gap)[0];
  for (const p of pts) p.labelled = p.r === rec || p.gap < 0 || p === bestProjected;
  return { title, pts, steps, rec, recE: rec.energy / f, unit: perSiteLabel(inst), undated: rows.length - pts.length,
    undatedQmbl: rows.filter(r => !yearOf(r) && r.computed_by === "qmbl").length };
}

// A panel's standing-record line and staircase on X/Y, up to `right`, as drawn and as segments.
function recordLine(t, parts, panel, X, Y, left, right) {
  const y = Y(panel.recE), segs = [{ x0: left, x1: right, y0: y, y1: y }];
  parts.push(hline(left, right, y, t.ink2));
  if (panel.steps.length) {
    let d = `M${n(X(panel.steps[0].year))} ${n(Y(panel.steps[0].e))}`;
    for (const s of panel.steps.slice(1)) d += `H${n(X(s.year))}V${n(Y(s.e))}`;
    parts.push(`<path d="${d}H${n(right)}" fill="none" stroke="${t.ink2}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    panel.steps.forEach((st, i) => {
      const next = panel.steps[i + 1], xa = X(st.year), xb = next ? X(next.year) : right;
      segs.push({ x0: xa, x1: xb, y0: Y(st.e), y1: Y(st.e) });
      if (next) segs.push({ x0: xb, x1: xb, y0: Y(st.e), y1: Y(next.e) });
    });
  }
  return segs;
}
// A segment as the box a name keeps clear of, clipped to the plot; null outside it.
function segBox(g, { left, right, top, bottom }) {
  const b = { x0: Math.max(Math.min(g.x0, g.x1), left) - 1, x1: Math.min(Math.max(g.x0, g.x1), right) + 1,
    y0: Math.max(Math.min(g.y0, g.y1), top) - 1, y1: Math.min(Math.max(g.y0, g.y1), bottom) + 1 };
  return b.x0 < b.x1 && b.y0 < b.y1 ? b : null;
}
// Hollow first, so a filled (eligible) mark is never covered by a listed-only one; the
// flagged outlines last, over whatever they coincide with.
function yearMarks(t, parts, pts, X, Y) {
  const order = [...pts].sort((a, b) => !!a.r.defect - !!b.r.defect || a.eligible - b.eligible);
  for (const p of order) parts.push(p.r.defect ? slashed(t, X(p.cost.value), Y(p.e), t.series[BOUNDS[p.r.bound_type]])
    : dot(t, X(p.cost.value), Y(p.e), t.series[BOUNDS[p.r.bound_type]], p.eligible));
}
const yearTicks = (X, x0, x1, size) => {
  const step = [1, 2, 5, 10].find(st => X(x0 + st) - X(x0) >= textWidth("2026", size) + 8);
  const out = [];
  for (let y = Math.ceil(x0 / step) * step; y <= x1; y += step) out.push(y);
  return out;
};
const nameOfRow = p => shortLabel(p.r);
function drawNames(t, parts, L) {
  for (const l of L.leaders) parts.push(`<path d="M${n(l.x)} ${n(l.y0)}V${n(l.y1)}" stroke="${t.muted}" stroke-width="1"/>`);
  for (const l of L.lines) parts.push(text(l.x, l.y, l.s, { size: 10.5, fill: t.ink2, anchor: l.anchor }));
}

// The boxed band again, enlarged, in its frame inside the plot, as the cost figures' insets:
// its own gridlines, years and record line, every mark in the band, the story's marks named.
// Returns the marks still numbered.
function yearInset(t, parts, panel, pts, r, box, named, id) {
  parts.push(`<rect x="${n(r.x0)}" y="${n(r.y0)}" width="${n(r.x1 - r.x0)}" height="${n(r.y1 - r.y0)}" fill="${t.surface}" stroke="${t.muted}" stroke-width="1" stroke-dasharray="3 3" rx="3"/>`);
  const heading = "The boxed region, enlarged";
  parts.push(text(r.x0 + 8, r.y0 + 15, heading, { size: 9.5, fill: t.muted }));
  const left = r.x0 + 52, right = r.x1 - 10, top = r.y0 + 30, bottom = r.y1 - 22;
  const X = v => left + ((v - box.c0) / (box.c1 - box.c0)) * (right - left);
  const Y = e => bottom - ((e - box.e0) / (box.e1 - box.e0)) * (bottom - top);
  const tickBoxes = [{ x0: r.x0, x1: r.x0 + 8 + textWidth(heading, 9.5), y0: r.y0, y1: r.y0 + 20 }];
  const step = niceStep((box.e1 - box.e0) / 3), decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let i = Math.ceil(box.e0 / step); i * step <= box.e1; i++) {
    const s = (i * step).toFixed(decimals).replace("-", "−"), y = Y(i * step);
    parts.push(hline(left, right, y, t.grid));
    parts.push(text(left - 5, y + 3.5, s, { size: 9, fill: t.muted, anchor: "end", nums: true }));
    tickBoxes.push({ x0: left - 7 - textWidth(s, 9), x1: left - 3, y0: y - 5, y1: y + 5 });
  }
  for (const y of yearTicks(X, box.c0, box.c1, 9)) {
    const w = textWidth(String(y), 9);
    parts.push(text(X(y), bottom + 14, String(y), { size: 9, fill: t.muted, anchor: "middle", nums: true }));
    tickBoxes.push({ x0: X(y) - w / 2 - 2, x1: X(y) + w / 2 + 2, y0: bottom + 5, y1: bottom + 17 });
  }
  const clip = `inset-${id}`, inner = [];
  parts.push(`<clipPath id="${clip}"><rect x="${n(left - 7)}" y="${n(top - 7)}" width="${n(right - left + 14)}" height="${n(bottom - top + 14)}"/></clipPath>`);
  const segs = recordLine(t, inner, panel, X, Y, left, right);
  yearMarks(t, inner, pts, X, Y);
  parts.push(`<g clip-path="url(#${clip})">${inner.join("")}</g>`);
  const L = layoutLabels({ pts, named: new Set(pts.filter(p => named.includes(p))), X, Y, front: [], left: r.x0 + 6, right: r.x1 - 6, top: r.y0 + 14, bottom: r.y1 - 4,
    nameOf: nameOfRow, nameAll: true, avoid: tickBoxes, lines: segs.map(g => segBox(g, { left, right, top, bottom })).filter(Boolean) });
  drawNames(t, parts, L);
  return L.keyed;
}

write("record-over-time", t => {
  const panels = FRONTIER.map(frontierPanel);
  const years = panels.flatMap(p => p.pts.map(q => q.year));
  const x0 = Math.min(...years) - 0.6, x1 = Math.max(...years) + 0.6;

  const h = header(t, "The record over time on two frontier instances",
    "Energy per site of every dated result, by publication year. " +
    "Filled marks can hold the record; hollow marks are listed but cannot, for want of an error bar; a slashed mark is a flagged row.");
  const lg = legend(t, [
    { kind: "dot", color: t.series[0], label: "Variational bound" },
    { kind: "dot", color: t.series[1], label: "Projected (fixed-node)" },
    { kind: "dot", color: t.series[2], label: "Extrapolated" },
    { kind: "ring", color: t.ink2, label: "Listed, cannot hold the record" },
    { kind: "flag", color: t.ink2, label: "Flagged, see the row" },
    { kind: "line", color: t.ink2, label: "Standing record" },
  ], h.bottom + 34);

  // The panels one above the other at the figure's width: side by side a year was 23 px and
  // the marks of one year hid each other.
  const plotH = 320, left = PAD + 64, right = W - PAD - 6;
  const X = v => left + ((v - x0) / (x1 - x0)) * (right - left);
  const parts = [h.svg, lg.svg];
  let top = lg.bottom + 52, end = top;

  panels.forEach((panel, k) => {
    const bottom = top + plotH;
    // Linear in energy. A log scale of the gap to the record cannot place the record itself
    // (a gap of zero) and has to pin it to an arbitrary floor, which makes every record look
    // like an outlier however close its rivals are.
    const es = panel.pts.map(p => p.e);
    const span = Math.max(...es) - Math.min(...es);
    const step = niceStep(span / 5);
    const e0 = Math.floor((Math.min(...es) - span * 0.04) / step) * step;
    const e1 = Math.ceil((Math.max(...es) + span * 0.04) / step) * step;
    const Y = e => bottom - ((e - e0) / (e1 - e0)) * plotH;
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    parts.push(text(PAD, top - 20, panel.title, { size: 13, fill: t.ink, weight: 600 }));
    for (let i = 0; i <= Math.round((e1 - e0) / step); i++) {
      const v = e0 + i * step;
      parts.push(hline(left, right, Y(v), t.grid));
      parts.push(text(left - 8, Y(v) + 4, v.toFixed(decimals).replace("-", "−"), { size: 11, fill: t.muted, anchor: "end", nums: true }));
    }
    for (const y of yearTicks(X, x0, x1, 11)) parts.push(text(X(y), bottom + 22, String(y), { size: 11, fill: t.muted, anchor: "middle", nums: true }));

    const lp = panel.pts.map(p => ({ ...p, cost: { value: p.year + p.dx } }));
    const segs = recordLine(t, parts, panel, X, Y, left, right);
    yearMarks(t, parts, lp, X, Y);
    // A lane's line may cross the record line and the staircase; a name may not.
    const segBoxes = segs.map(g => segBox(g, { left, right, top, bottom })).filter(Boolean);

    // The record is named on its line, left or right, above or below, wherever that covers
    // no mark, line or name; else in the panel's heading, after the title.
    const centres = lp.map(p => [X(p.cost.value), Y(p.e)]);
    const box = (lx, base, w, anchor) => ({ x0: anchor === "start" ? lx : lx - w, x1: anchor === "start" ? lx + w : lx, y0: base - 10, y1: base + 3, lx, base, anchor });
    const free = b => b.x0 >= left && b.x1 <= right && b.y0 >= top && b.y1 <= bottom &&
      !centres.some(([cx, cy]) => cx + 6 > b.x0 && cx - 6 < b.x1 && cy + 6 > b.y0 && cy - 6 < b.y1) && !segBoxes.some(g => meets(g, b));
    const recName = `record: ${shortLabel(panel.rec)}`, rw = textWidth(recName, 12) + 4, ry = Y(panel.recE);
    const recBox = [box(left + 4, ry - 6, rw, "start"), box(right - 4, ry - 6, rw, "end"), box(left + 4, ry + 15, rw, "start"), box(right - 4, ry + 15, rw, "end")]
      .find(free) ?? box(right, top - 20, rw, "end");
    parts.push(text(recBox.lx, recBox.base, recName, { size: 12, fill: t.ink, weight: 600, anchor: recBox.anchor }));

    // Names only on the marks the story is about: anything below the record and the best
    // projected energy, placed as the cost figures place theirs (labels.mjs): beside the mark
    // where that covers nothing, else in a lane above or below with a line to it, marks drawn
    // as one named together. Where some still find no room, the band they lie in is boxed and
    // enlarged in an inset in a top corner of the plot; what is left after that is numbered
    // and named in a key under the panel.
    const named = lp.filter(p => p.labelled && p.r !== panel.rec);
    const layout = (avoid, hide = new Set()) => layoutLabels({ pts: lp, named: new Set(named.filter(p => !hide.has(p))), X, Y, front: [],
      left, right, top, bottom, nameOf: nameOfRow, nameAll: true, avoid, lines: segBoxes });
    let L = layout([recBox]);
    const keyed = [];
    if (L.keyed.length) {
      // The box: the numbered marks with a margin, grown until every mark it touches is one of its own.
      let members = L.keyed.map(kd => kd.p), z;
      for (let i = 0; ; i++) {
        const vs = members.map(p => p.cost.value), ms = members.map(p => p.e);
        const espan = Math.max(Math.max(...ms) - Math.min(...ms), 0.02 * (e1 - e0));
        const zb = { c0: Math.min(...vs) - 0.5, c1: Math.max(...vs) + 0.5, e0: Math.min(...ms) - 0.2 * espan, e1: Math.max(...ms) + 0.2 * espan };
        // kept inside the plot, off the tick labels
        const rect = { x0: Math.max(X(zb.c0) - 8, left - 3), x1: Math.min(X(zb.c1) + 8, right + 3), y0: Math.max(Y(zb.e1) - 8, top - 3), y1: Math.min(Y(zb.e0) + 8, bottom + 3) };
        const inBox = lp.filter(p => X(p.cost.value) > rect.x0 - 7 && X(p.cost.value) < rect.x1 + 7 && Y(p.e) > rect.y0 - 7 && Y(p.e) < rect.y1 + 7);
        z = { box: zb, rect, inBox };
        if (i === 7 || inBox.every(p => members.includes(p))) break;
        members = [...new Set([...members, ...inBox])];
      }
      const nameW = Math.max(60, ...z.inBox.filter(p => named.includes(p)).map(p => textWidth(nameOfRow(p), 10.5)));
      const frame = insetFrame(centres, segs, [recBox, z.rect], { left, right, top, bottom },
        Math.min(560, 110 + nameW + 14 * z.inBox.length), Math.min(300, 80 + 26 * z.inBox.length));
      if (frame) {
        parts.push(`<rect x="${n(z.rect.x0)}" y="${n(z.rect.y0)}" width="${n(z.rect.x1 - z.rect.x0)}" height="${n(z.rect.y1 - z.rect.y0)}" fill="none" stroke="${t.muted}" stroke-width="1" stroke-dasharray="3 3" rx="3"/>`);
        keyed.push(...yearInset(t, parts, panel, z.inBox, frame, z.box, named, k));
        L = layout([recBox, z.rect, frame], new Set(z.inBox));
      }
    }
    drawNames(t, parts, L);
    keyed.unshift(...L.keyed);
    keyed.forEach((kd, i) => parts.push(text(kd.x, kd.y, String(i + 1), { size: 9, fill: t.ink2, anchor: kd.anchor, weight: 600 })));
    // The key: "1 DMRG, extrapolated (2019)  ·  2 ...", wrapped to the plot's width.
    const lines = [[]];
    let used = 0;
    keyed.forEach((kd, i) => {
      const item = `${i + 1} ${shortLabel(kd.p.r)} (${kd.p.year})`, iw = textWidth(item + "  ·  ", 11);
      if (used + iw > right - left && lines.at(-1).length) { lines.push([]); used = 0; }
      lines.at(-1).push(item); used += iw;
    });
    if (keyed.length) lines.forEach((l, i) => parts.push(text(left, bottom + 44 + 15 * i, l.join("  ·  "), { size: 11, fill: t.ink2 })));
    end = bottom + 30 + (keyed.length ? 15 * lines.length + 14 : 0);
    top = end + 56;
  });

  const undated = panels.map(p => `${p.undated} on ${p.title.split(",")[0]}`).join(" and ");
  const ownRuns = panels.every(p => p.undated === p.undatedQmbl) ? " (QMBL's own runs)" : "";
  const units = panels.map(p => `${p.title.split(" ")[0]} as ${p.unit}`).join(", ");
  const fn = footnote(t, `Energies per site: ${units}. Not shown: rows with no publication year, ${undated}${ownRuns}. ` +
    "Year is the source's publication year. The line steps down only when an eligible row beats the standing record.", end + 22);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "The record over time on two frontier instances",
    `Energy per site versus publication year for ${FRONTIER.map(f => f[1]).join(" and ")}.`, parts);
});

// ------------------------------------------------------ 2. published rows per instance
write("rows-per-instance", t => {
  const counts = instances.map(i => variationalRows(i).length);
  const maxK = Math.max(...counts);
  const hist = Array.from({ length: maxK + 1 }, (_, k) => counts.filter(c => c === k).length);
  const five = counts.filter(c => c >= 5).length;
  const h = header(t, "How many published variational energies each instance has",
    `${hist[0]} of ${instances.length} instances have none, ${hist[1]} have exactly one, and ${five} have five or more.`);
  const top = h.bottom + 44, plotH = 190, base = top + plotH;
  const left = PAD + 8, right = W - PAD - 8, band = (right - left) / (maxK + 1), bw = Math.min(24, band * 0.6);
  const ymax = Math.max(...hist); // every bar is labelled, so no axis to round for
  const parts = [h.svg, hline(left, right, base, t.grid)];
  hist.forEach((c, k) => {
    const cx = left + band * (k + 0.5), yTop = base - (c / ymax) * plotH;
    parts.push(vbar(cx - bw / 2, bw, base, yTop, t.series[0]));
    if (c) parts.push(text(cx, yTop - 7, String(c), { size: 12, fill: t.ink2, anchor: "middle", nums: true }));
    parts.push(text(cx, base + 18, String(k), { size: 11, fill: t.muted, anchor: "middle", nums: true }));
  });
  parts.push(text((left + right) / 2, base + 40, "variational rows on the instance", { size: 12, fill: t.ink2, anchor: "middle" }));
  const fn = footnote(t, "Each bar counts instances. Exact, projected and extrapolated rows are not counted: this is how many variational bounds each instance has drawn.", base + 70);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "How many published variational energies each instance has",
    `Histogram of variational rows per instance: ${hist.map((c, k) => `${k}: ${c}`).join(", ")}.`, parts);
});

// ------------------------------------------------------------ 3. record status by model
const MODELS = { Heisenberg: "Heisenberg", J1J2: "J1-J2", Hubbard: "Hubbard", tV: "Spinless t-V", TFIsing: "Transverse-field Ising", Impurity: "Impurity" };

// A solved instance's record is its exact energy (RULES.md 6); the competition categories
// describe the variational-held records only, since "contested" is about how many bounds
// were published against each other, and on a solved instance they compete for second.
function status(i) {
  const rec = recordOf(i);
  if (!rec) return "other";
  if (rec.bound_type === "exact") return "exact";
  return i.rows.length >= CONTESTED ? "contested" : variationalRows(i).length === 1 ? "single" : "challenged";
}

write("record-status", t => {
  const STATUS = [
    ["exact", "Solved: exact energy is the record", t.recessive[0]],
    ["contested", `Contested (${CONTESTED}+ rows)`, t.ordinal[2]],
    ["challenged", `Rivals, under ${CONTESTED} rows`, t.ordinal[1]],
    ["single", "Single number", t.ordinal[0]],
    ["other", "No record", t.recessive[1]],
  ];
  const models = [...Map.groupBy(instances, i => i.model)]
    .map(([m, is]) => ({ m, total: is.length, by: Object.fromEntries(STATUS.map(([k]) => [k, is.filter(i => status(i) === k).length])) }))
    .sort((a, b) => b.total - a.total || a.m.localeCompare(b.m));
  const held = instances.filter(recordOf).length;
  const tally = k => models.reduce((s, m) => s + m.by[k], 0);
  const h = header(t, "Record status of every instance, by model",
    `${held} of ${instances.length} instances have a record, ${tally("exact")} of them solved. Of the ${held - tally("exact")} variational-held records, ` +
    `${tally("single")} stand on a single published number and ${tally("contested")} were taken on instances with ${CONTESTED} or more rows.`);
  const lg = legend(t, STATUS.map(([, label, color]) => ({ kind: "square", color, label })), h.bottom + 34);
  const top = lg.bottom + 26, pitch = 36, bh = 22, left = PAD + 190, right = W - PAD - 36;
  const max = Math.max(...models.map(m => m.total));
  const parts = [h.svg, lg.svg];
  models.forEach((m, r) => {
    const y = top + r * pitch;
    parts.push(text(PAD, y + 16, MODELS[m.m] ?? m.m, { size: 13, fill: t.ink }));
    parts.push(text(left - 12, y + 16, String(m.total), { size: 12, fill: t.muted, anchor: "end", nums: true }));
    let x = left;
    const segs = STATUS.filter(([k]) => m.by[k]);
    segs.forEach(([k, , color], s) => {
      const w = (m.by[k] / max) * (right - left), last = s === segs.length - 1;
      parts.push(hbar(x, x + w - (last ? 0 : 2), y, bh, color, last));
      const label = String(m.by[k]);
      if (textWidth(label, 11.5) + 10 < w - 2) parts.push(text(x + (w - (last ? 0 : 2)) / 2, y + 15, label, { size: 11.5, fill: onFill(color), anchor: "middle", nums: true }));
      x += w;
    });
  });
  const fn = footnote(t, "Bar length is the number of instances. A record is the exact energy where the instance is solved, otherwise the lowest eligible variational energy; " +
    `"rows" counts every published row on the instance; ${CONTESTED} or more is contested.`, top + models.length * pitch + 20);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "Record status of every instance, by model",
    models.map(m => `${MODELS[m.m] ?? m.m}: ${STATUS.map(([k, label]) => `${label} ${m.by[k]}`).join(", ")}`).join("; "), parts);
});

// --------------------------------------------------------------- 4. records by family
// The medal table counts records held by a variational bound only (RULES.md 7). An exact
// energy is the answer, not an ansatz, and counting it would hand the most records to
// whoever ran exact diagonalization on the most small instances.
write("records-by-family", t => {
  const allCount = {}, hard = {};
  for (const i of instances) {
    const rec = recordOf(i);
    if (!rec || rec.bound_type !== "variational") continue;
    const f = rec.family;
    allCount[f] = (allCount[f] || 0) + 1;
    if (i.rows.length >= CONTESTED) hard[f] = (hard[f] || 0) + 1;
  }
  const fams = [...FAMILIES.map(([f]) => f), "other"]
    .filter(f => allCount[f] || hard[f])
    .map(f => ({ f, all: allCount[f] || 0, hard: hard[f] || 0 }))
    .sort((a, b) => b.hard - a.hard || b.all - a.all);
  const solved = instances.filter(i => recordOf(i)?.bound_type === "exact").length;
  const varHeld = Object.values(allCount).reduce((a, b) => a + b, 0);
  const h = header(t, "Records by ansatz family",
    `Over the ${varHeld} records held by a variational bound; the ${solved} solved instances, where the exact energy is the record, are left out. ` +
    "Counting every instance rewards whichever method was run on the most easy problems, so " +
    `the contested bars count only instances with ${CONTESTED}+ published rows, which is where the field is actually competing.`);
  const lg = legend(t, [
    { kind: "square", color: t.series[0], label: "Records, all unsolved instances" },
    { kind: "square", color: t.series[1], label: `Records, contested instances (${CONTESTED}+ rows)` },
  ], h.bottom + 34);
  const top = lg.bottom + 24, pitch = 40, bh = 13, left = PAD + 150, right = W - PAD - 40;
  const max = Math.max(...fams.map(f => f.all));
  const X = v => left + (v / max) * (right - left);
  const parts = [h.svg, lg.svg];
  fams.forEach((f, r) => {
    const y = top + r * pitch;
    parts.push(text(PAD, y + 18, f.f, { size: 13, fill: t.ink }));
    parts.push(hbar(left, X(f.all), y, bh, t.series[0]));
    parts.push(text(X(f.all) + 6, y + 10.5, String(f.all), { size: 11.5, fill: t.ink2, nums: true }));
    parts.push(hbar(left, X(f.hard), y + bh + 2, bh, t.series[1]));
    parts.push(text(X(f.hard) + 6, y + bh + 12.5, String(f.hard), { size: 11.5, fill: t.ink2, nums: true }));
  });
  parts.push(`<path d="M${n(left) - 0.5} ${n(top - 6)}V${n(top + fams.length * pitch - 8)}" stroke="${t.grid}" stroke-width="1"/>`);
  const fn = footnote(t, "Each method name belongs to one family (scripts/method_names.mjs); where names blur, read the families as indicative.",
    top + fams.length * pitch + 16);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "Records by ansatz family",
    fams.map(f => `${f.f}: ${f.all} records, ${f.hard} contested`).join("; "), parts);
});

// ------------------------------------------------------------- 5. error metrics by source
write("error-metrics", t => {
  const METRICS = [
    ["both", "Error bar and variance", t.series[0]],
    ["sigma", "Error bar only", t.series[1]],
    ["variance", "Variance only", t.series[2]],
    ["none", "Neither found (○ in the leaderboard)", t.muted],
  ];
  const kind = r => r.sigma != null && r.energy_variance != null ? "both"
    : r.sigma != null ? "sigma" : r.energy_variance != null ? "variance" : "none";
  // An exact energy has no error to report, so exact rows would only dilute the bars.
  const rows = instances.flatMap(i => i.rows).filter(r => r.bound_type !== "exact");
  const groups = [
    ["Imported from VarBench", rows.filter(r => r.source.startsWith("varbench@"))],
    ["Added since from the literature", rows.filter(r => !r.source.startsWith("varbench@") && r.computed_by !== "qmbl")],
  ].map(([label, rs]) => ({ label, total: rs.length, by: Object.fromEntries(METRICS.map(([k]) => [k, rs.filter(r => kind(r) === k).length])) }));
  const [vb, lit] = groups;
  const h = header(t, "Which error metrics the rows carry, by where they came from",
    `${pct(vb.by.both + vb.by.variance, vb.total)} of the rows imported from VarBench carry an energy variance; ` +
    `${pct(lit.by.both + lit.by.variance, lit.total)} of the rows added since from papers do. Exact rows are left out: they have no error to report.`);
  const lg = legend(t, METRICS.map(([, label, color]) => ({ kind: "square", color, label })), h.bottom + 34);
  const top = lg.bottom + 26, pitch = 58, bh = 24, left = PAD + 240, right = W - PAD;
  const parts = [h.svg, lg.svg];
  groups.forEach((g, r) => {
    const y = top + r * pitch;
    parts.push(text(PAD, y + 11, g.label, { size: 13, fill: t.ink }));
    parts.push(text(PAD, y + 28, `${g.total} rows`, { size: 12, fill: t.muted, nums: true }));
    let x = left;
    const segs = METRICS.filter(([k]) => g.by[k]);
    segs.forEach(([k, , color], s) => {
      const w = (g.by[k] / g.total) * (right - left), last = s === segs.length - 1;
      parts.push(hbar(x, x + w - (last ? 0 : 2), y, bh, color, last));
      const label = pct(g.by[k], g.total);
      if (textWidth(label, 11.5) + 12 < w - 2) parts.push(text(x + (w - (last ? 0 : 2)) / 2, y + 16, label, { size: 11.5, fill: onFill(color), anchor: "middle", nums: true }));
      x += w;
    });
  });
  const fn = footnote(t, "Bars are shares of each source's rows. A deterministic energy (DMRG at a stated bond dimension) needs no error bar " +
    "to hold a record; a sampled one does. QMBL's own runs are not counted.", top + groups.length * pitch + 4);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "Which error metrics the rows carry, by where they came from",
    groups.map(g => `${g.label} (${g.total} rows): ${METRICS.map(([k, label]) => `${label} ${g.by[k]}`).join(", ")}`).join("; "), parts);
});

// ------------------------------------------------------------ 6. standing records by year
// Variational-held records only, as in the family chart: an exact energy has no year of
// setting a record in the sense meant here, and most cite a run script anyway.
write("records-by-year", t => {
  const recs = instances.map(recordOf).filter(r => r?.bound_type === "variational");
  const dated = recs.map(yearOf).filter(Boolean);
  const noPaper = recs.filter(r => !yearOf(r) && citeRef(r, cache).text === "run script").length;
  const y0 = Math.min(...dated), y1 = Math.max(...dated);
  const years = Array.from({ length: y1 - y0 + 1 }, (_, k) => y0 + k);
  const count = years.map(y => dated.filter(d => d === y).length);
  const rest = recs.length - dated.length;
  const h = header(t, "Standing records by the year their source was published",
    !rest ? `All ${recs.length} variational-held records resolve to a publication year (a VarBench run script to its paper's).` :
    `${dated.length} of the ${recs.length} variational-held records resolve to a publication year. ` +
    (rest === noPaper
      ? `The other ${rest} cite a run script, so they have no year to plot.`
      : `The other ${rest} have no year to plot: ${noPaper} cite a run script, ${rest - noPaper} cite one with no year on record.`));
  const top = h.bottom + 44, plotH = 180, base = top + plotH;
  const left = PAD + 8, right = W - PAD - 8, band = (right - left) / years.length, bw = Math.min(24, band * 0.6);
  const ymax = Math.max(...count);
  const parts = [h.svg, hline(left, right, base, t.grid)];
  years.forEach((y, k) => {
    const cx = left + band * (k + 0.5), yTop = base - (count[k] / ymax) * plotH;
    parts.push(vbar(cx - bw / 2, bw, base, yTop, t.series[0]));
    if (count[k]) parts.push(text(cx, yTop - 7, String(count[k]), { size: 12, fill: t.ink2, anchor: "middle", nums: true }));
    parts.push(text(cx, base + 18, String(y), { size: 11, fill: t.muted, anchor: "middle", nums: true }));
  });
  const fn = footnote(t, "A record counts in the year of the paper that set it. Records later beaten are gone from this chart, so old years count survivors, not output.", base + 48);
  parts.push(fn.svg);
  return doc(t, fn.bottom + 24, "Standing records by the year their source was published",
    years.map((y, k) => `${y}: ${count[k]}`).join(", "), parts);
});

console.log(`${OUT}/: ${written.length} files`);
