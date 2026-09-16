// Generate figures/*.svg - the README numbers, drawn. The drawing kit is chart.mjs.
import { isSampled, recordEligible, perSiteDivisor, perSiteLabel } from "./units.mjs";
import { collect, recordOf } from "./summary.mjs";
import { sourceOf, sources } from "./enrich_sources.mjs";
import { CONTESTED, FAMILIES, family, variationalRows } from "./views.mjs";
import { W, PAD, n, text, hline, hbar, vbar, onFill, dot, legend, header, footnote, doc, textWidth, pct, niceStep, writer } from "./chart.mjs";

const OUT = "figures";
const cache = sources();
const instances = collect();
const byId = new Map(instances.map(i => [i.instance_id, i]));
const { write, written } = writer(OUT);

const yearOf = r => sourceOf(r, cache)?.year ?? null;

// ---------------------------------------------------------- 1. the record over time
// Curated like the README frontier table, and for the same reason: these are the two
// instances the field competes on, and between them they show both kinds of story - a
// record taken again and again, and a record that newer, lower-looking numbers did not take.
const FRONTIER = [
  ["J1J2/square_100_P_0.5", "J1-J2 square 10×10, J2 = 0.5"],
  ["Hubbard/square_256_P_112_8", "Hubbard square 16×16, U = 8, n = 0.875"],
];
const BOUNDS = { variational: 0, projected: 1, extrapolated: 2 };

function shortLabel(r) {
  // "Holographic Quantum Transformer (HQT), ..." -> "HQT"; otherwise the text before any
  // parenthesis or comma, which is where method strings put the architecture's name.
  const acronym = r.method.match(/\(([A-Z][A-Za-z0-9-]{1,7})\)/);
  let s = acronym ? acronym[1] : r.method.split(/\s*[(,]/)[0].trim();
  if (r.bound_type === "projected") s += /fixed.?node|\bFN\b/i.test(r.method) ? " + fixed-node" : ", projected";
  if (r.bound_type === "extrapolated") s += ", extrapolated";
  if (r.defect) s += ", flagged";
  return s;
}

function frontierPanel([id, title]) {
  const inst = byId.get(id);
  const rec = recordOf(inst);
  const rows = inst.rows.filter(r => r.bound_type in BOUNDS);
  const f = perSiteDivisor(inst);
  const pts = rows.filter(yearOf).map(r => ({
    r, year: yearOf(r), eligible: recordEligible(r), e: r.energy / f,
    gap: (r.energy - rec.energy) / Math.abs(rec.energy),
  }));
  // Within a year, spread the marks sideways in energy order so none hides another.
  const byYear = Map.groupBy(pts, p => p.year);
  for (const group of byYear.values()) {
    group.sort((a, b) => a.gap - b.gap);
    group.forEach((p, k) => { p.dx = (k - (group.length - 1) / 2) * 0.1; });
  }
  // The standing record: lowest eligible energy published up to each year.
  const steps = [];
  for (const year of [...byYear.keys()].sort()) {
    const best = Math.min(...byYear.get(year).filter(p => p.eligible).map(p => p.e));
    if (Number.isFinite(best) && (!steps.length || best < steps.at(-1).e)) steps.push({ year, e: best });
  }
  const bestProjected = pts.filter(p => p.r.bound_type === "projected").sort((a, b) => a.gap - b.gap)[0];
  for (const p of pts) p.labelled = p.r === rec || p.gap < 0 || p === bestProjected;
  return { title, pts, steps, rec, recE: rec.energy / f, unit: perSiteLabel(inst), undated: rows.length - pts.length };
}

write("record-over-time", t => {
  const panels = FRONTIER.map(frontierPanel);
  const years = panels.flatMap(p => p.pts.map(q => q.year));
  const x0 = Math.min(...years) - 0.6, x1 = Math.max(...years) + 0.6;

  const h = header(t, "The record over time on two frontier instances",
    "Energy per site of every dated result, by publication year. " +
    "Filled marks can hold the record; hollow marks are listed but cannot, for want of an error bar or because the row is flagged.");
  const lg = legend(t, [
    { kind: "dot", color: t.series[0], label: "Variational bound" },
    { kind: "dot", color: t.series[1], label: "Projected (fixed-node)" },
    { kind: "dot", color: t.series[2], label: "Extrapolated" },
    { kind: "ring", color: t.ink2, label: "Listed, cannot hold the record" },
    { kind: "line", color: t.ink2, label: "Standing record" },
  ], h.bottom + 34);

  const top = lg.bottom + 52, plotH = 280, bottom = top + plotH;
  const panelW = (W - 2 * PAD - 44) / 2;
  const parts = [h.svg, lg.svg];

  panels.forEach((panel, k) => {
    const px = PAD + k * (panelW + 44), left = px + 64, right = px + panelW - 6;
    const X = v => left + ((v - x0) / (x1 - x0)) * (right - left);
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
    parts.push(text(px, top - 20, panel.title, { size: 13, fill: t.ink, weight: 600 }));
    for (let i = 0; i <= Math.round((e1 - e0) / step); i++) {
      const v = e0 + i * step;
      parts.push(hline(left, right, Y(v), t.grid));
      parts.push(text(left - 8, Y(v) + 4, v.toFixed(decimals).replace("-", "−"), { size: 11, fill: t.muted, anchor: "end", nums: true }));
    }
    parts.push(hline(left, right, Y(panel.recE), t.ink2));
    // The record is named on its own line, at the left where no mark sits, rather than
    // beside its marker, which is always crowded by the rivals closest to it.
    parts.push(text(left + 4, Y(panel.recE) - 6, `record: ${shortLabel(panel.rec)}`, { size: 12, fill: t.ink, weight: 600 }));
    for (let y = Math.ceil(x0); y <= x1; y++) parts.push(text(X(y), bottom + 22, String(y), { size: 11, fill: t.muted, anchor: "middle", nums: true }));

    if (panel.steps.length) {
      let d = `M${n(X(panel.steps[0].year))} ${n(Y(panel.steps[0].e))}`;
      for (const s of panel.steps.slice(1)) d += `H${n(X(s.year))}V${n(Y(s.e))}`;
      parts.push(`<path d="${d}H${n(right)}" fill="none" stroke="${t.ink2}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
    // Hollow first, so a filled (eligible) mark is never covered by a listed-only one.
    const order = [...panel.pts].sort((a, b) => a.eligible - b.eligible);
    for (const p of order) parts.push(dot(t, X(p.year + p.dx), Y(p.e), t.series[BOUNDS[p.r.bound_type]], p.eligible));

    // Labels only on the marks the story is about: the record, anything below it, and the
    // best projected energy. Nudged apart vertically where two would overlap.
    const labels = panel.pts.filter(p => p.labelled && p.r !== panel.rec).map(p => {
      const s = shortLabel(p.r), w = textWidth(s, 12), x = X(p.year + p.dx), y = Y(p.e);
      const rightSide = x + 10 + w <= right;
      // A mark just above the record line takes its label above it, off the line.
      const hugsRecord = y < Y(panel.recE) && Y(panel.recE) - y < 20;
      return { s, w, x: rightSide ? x + 10 : x - 10, anchor: rightSide ? "start" : "end", y: hugsRecord ? y - 10 : y + 4 };
    }).sort((a, b) => a.y - b.y);
    for (let a = 1; a < labels.length; a++) {
      const prev = labels[a - 1], cur = labels[a];
      const span = l => (l.anchor === "start" ? [l.x, l.x + l.w] : [l.x - l.w, l.x]);
      const [p0, p1] = span(prev), [c0, c1] = span(cur);
      if (c0 < p1 && p0 < c1 && cur.y - prev.y < 14) cur.y = prev.y + 14;
    }
    for (const l of labels) parts.push(text(l.x, l.y, l.s, { size: 12, fill: t.ink2, anchor: l.anchor }));
  });

  const undated = panels.map(p => `${p.undated} on ${p.title.split(",")[0]}`).join(" and ");
  const units = panels.map(p => `${p.title.split(" ")[0]} as ${p.unit}`).join(", ");
  const fn = footnote(t, `Energies per site: ${units}. Not shown: rows with no paper to date them, ${undated} (VarBench's own reference runs). ` +
    "Year is the source's publication year. The line steps down only when an eligible row beats the standing record.", bottom + 52);
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
    const f = family(rec.method);
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
  const fn = footnote(t, "Families are matched by regular expression against the method string, first match wins, so read them as indicative.",
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
    ["Added since from the literature", rows.filter(r => !r.source.startsWith("varbench@"))],
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
    "to hold a record; a sampled one does.", top + groups.length * pitch + 4);
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
  const noPaper = recs.filter(r => !sourceOf(r, cache)).length;
  const y0 = Math.min(...dated), y1 = Math.max(...dated);
  const years = Array.from({ length: y1 - y0 + 1 }, (_, k) => y0 + k);
  const count = years.map(y => dated.filter(d => d === y).length);
  const rest = recs.length - dated.length;
  const h = header(t, "Standing records by the year their source was published",
    `${dated.length} of the ${recs.length} variational-held records resolve to a publication year. ` +
    (rest === noPaper
      ? `The other ${rest} cite a run script and no paper, so they have no year to plot.`
      : `The other ${rest} have no year to plot: ${noPaper} cite no paper, ${rest - noPaper} cite one with no year on record.`));
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
