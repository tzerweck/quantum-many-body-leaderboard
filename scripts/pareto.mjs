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
import { collect, recordOf, rowId } from "./summary.mjs";
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
// A mark is named by its method alone, its detail in the row's card on hover (Tristan,
// 2026-09-29); QMBL's own runs keep "QMBL" in the name, so none is read as published
// (2026-09-23). The colour says the kind of number.
const markName = r => shortLabel({ ...r, method_detail: undefined, compute: undefined, bound_type: "variational", defect: undefined });

// An instance's own figure: every mark named in place where it can be. Where two or more
// marks still find no room, their region is boxed and drawn again, enlarged, in an inset in
// the plot's top right corner, a second crowd's in the top left (Tristan, 2026-09-29: no
// second panel under the plot). Returns the y the footnote starts at.
function drawInstance(t, parts, inst, pts, g) {
  const trial = [], crowd = [];
  drawPanel(t, trial, inst, pts, { ...g, nameAll: true, keyOut: crowd });
  if (crowd.length >= 2) {
    const zoomed = [];
    if (drawPanel(t, zoomed, inst, pts, { ...g, nameAll: true, zoom: crowd })) { parts.push(...zoomed); return g.bottom + 70; }
  }
  parts.push(...trial);
  return g.bottom + 70;
}

// An instance's own figure names every mark, so it grows with the marks it holds: 300 px for
// up to twelve, 16 px more for each beyond (the 26 rows on J1-J2 10x10's parameter axis).
const plotHeight = pts => 300 + 16 * Math.max(0, pts.length - 12);

// Labels the placement could not keep off the frontier line; the build prints them.
const labelClashes = [];

// The frontier's staircase as horizontal and vertical segments on screen.
const stairs = (front, X, Y) => front.slice(1).flatMap((p, i) => {
  const x0 = X(front[i].cost.value), y0 = Y(front[i].e), x1 = X(p.cost.value), y1 = Y(p.e);
  return [{ x0, x1, y0, y1: y0 }, { x0: x1, x1, y0, y1 }];
});

// Where each name goes, for the marks `pts` at X/Y inside left/right/top/bottom. Beside its
// mark where that covers nothing - no other mark, label or line, not the frontier, nothing in
// `avoid`. In an instance's own figure (`nameAll`) a name with no such spot, or one that would
// sit off its mark's row in a crowd, where it reads as a neighbour's, goes in a lane above or
// below the mark with a vertical line to it (Tristan, 2026-09-29, in place of numbers and an
// enlarged panel); what is still left is numbered. Marks drawn as one, within 6 px, are named
// together, a line per method in the order they lie from top to bottom ("ViT ×2" where two
// share one). Every name links to its rows, so on the site hovering it shows their cards.
function layoutLabels({ pts, named, X, Y, front, left, right, top, bottom, nameOf, nameAll, avoid = [] }) {
  const centres = pts.map(p => [X(p.cost.value), Y(p.e)]);
  const segs = stairs(front, X, Y);
  // The label's glyph box: baseline at ty + 4, cap height about 8 at 10.5 px.
  const crosses = (x0, x1, ty) => segs.filter(g => Math.max(g.x0, x0 - 1) <= Math.min(g.x1, x1 + 1) &&
    Math.max(Math.min(g.y0, g.y1), ty - 5) <= Math.min(Math.max(g.y0, g.y1), ty + 7)).length;
  const mine = (cx, cy, own) => own.some(([ox, oy]) => ox === cx && oy === cy);
  const blocked = (x0, x1, y0, y1) => avoid.filter(r => x0 < r.x1 && r.x0 < x1 && y0 < r.y1 && r.y0 < y1).length;
  // A mark is clear of a name when its dot misses the glyph box; the small overview panels,
  // which name the frontier only, keep their older, looser margin.
  const [above, below] = nameAll ? [10, 12] : [9, 9];
  const covers = (x0, x1, ty, own) => centres.filter(([cx, cy]) => !mine(cx, cy, own) && cx + 6 > x0 && cx - 6 < x1 && cy > ty - above && cy < ty + below).length +
    crosses(x0, x1, ty) + blocked(x0 - 1, x1 + 1, ty - 5, ty + 7);

  const items = [];
  for (const p of [...named].sort((a, b) => X(a.cost.value) - X(b.cost.value) || Y(a.e) - Y(b.e))) {
    const x = X(p.cost.value), y = Y(p.e);
    const it = nameAll && items.find(i => i.own.some(([ox, oy]) => Math.abs(ox - x) <= 6 && Math.abs(oy - y) <= 6));
    if (it) { it.ps.push(p); it.own.push([x, y]); } else items.push({ ps: [p], own: [[x, y]] });
  }
  for (const it of items) {
    it.ps.sort((a, b) => Y(a.e) - Y(b.e));
    it.own = it.ps.map(p => [X(p.cost.value), Y(p.e)]);
    const byName = new Map();
    for (const p of it.ps) byName.set(nameOf(p), [...(byName.get(nameOf(p)) ?? []), p]);
    const names = [...byName].map(([s, ps]) => (ps.length > 1 ? `${s} ×${ps.length}` : s));
    it.rows = [...byName.values()].map(ps => [...ps].sort((a, b) => a.e - b.e));   // best first, as the site lists them
    const x = it.own.reduce((a, o) => a + o[0], 0) / it.own.length, y = it.own.reduce((a, o) => a + o[1], 0) / it.own.length;
    Object.assign(it, { names, k: names.length, w: Math.max(...names.map(s => textWidth(s, 10.5))), x, y,
      top: it.own[0][1], bottom: it.own.at(-1)[1], front: it.ps.some(p => front.includes(p)),
      crowded: centres.some(([cx, cy]) => !mine(cx, cy, it.own) && Math.hypot(cx - x, cy - y) < 24) });
  }

  const lines = (it, c) => it.names.map((s, i) => ({ ...c, ty: c.ty + 12 * i }));
  const onLabel = (b, pl) => pl.filter(l => b.x0 < l.x1 && l.x0 < b.x1 && Math.abs(b.ty - l.ty) < 12).length;
  const onLeader = (b, ld) => ld.filter(l => l.x > b.x0 - 2 && l.x < b.x1 + 2 && l.y1 > b.ty - 6 && l.y0 < b.ty + 8).length;
  const hits = (it, c, pl, ld) => lines(it, c).reduce((a, b) => a + covers(b.x0, b.x1, b.ty, it.own) + onLabel(b, pl) + onLeader(b, ld), 0);
  const dist = ([cx, cy], b) => Math.hypot(Math.max(b.x0 - cx, 0, cx - b.x1), Math.max(b.y0 - cy, 0, cy - b.y1));
  const nearest = (it, c) => {
    const b = { x0: c.x0, x1: c.x1, y0: c.ty - 5, y1: c.ty + 12 * (it.k - 1) + 7 }, own = Math.min(...it.own.map(o => dist(o, b)));
    return !centres.some(o => !mine(o[0], o[1], it.own) && dist(o, b) < own + 6);
  };
  // A line runs through no mark, label, other line or the frontier.
  const leaderFree = (lx, ya, yb, own, pl, ld) => ya < yb &&
    !centres.some(([cx, cy]) => !mine(cx, cy, own) && Math.abs(cx - lx) < 7.5 && cy + 6.5 > ya && cy - 6.5 < yb) &&
    !pl.some(l => lx > l.x0 - 2 && lx < l.x1 + 2 && l.ty + 7 > ya && l.ty - 6 < yb) &&
    !ld.some(l => Math.abs(l.x - lx) < 4 && l.y1 > ya - 2 && l.y0 < yb + 2) &&
    !segs.some(g => (g.y0 === g.y1 ? lx >= g.x0 && lx <= g.x1 && g.y0 > ya && g.y0 < yb
      : Math.abs(g.x0 - lx) < 4 && Math.max(g.y0, g.y1) > ya && Math.min(g.y0, g.y1) < yb)) &&
    !blocked(lx - 1, lx + 1, ya, yb);

  const run = (order, demote = new Set()) => {
    const placed = [], leaders = [], at = new Map();
    for (const it of order) {
      if (demote.has(it)) continue;
      const { x, y, w, k } = it, mid = y - 6 * (k - 1);
      // A spot's `ty` is where a one-line name sits; several lines are centred on the mark's
      // row beside it, end in that line above it and start in it below.
      const lift = ty => (ty === y ? mid : ty < y ? ty - 12 * (k - 1) : ty);
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
      ].map(c => ({ ...c, ty: lift(c.ty) })).filter(c => c.x0 >= left && c.x1 <= right && c.ty - 8 > top && c.ty + 12 * (k - 1) + 4 < bottom);
      // In a narrow panel nothing beside the mark may fit: centred above or below it, kept inside.
      const cx = Math.min(Math.max(x - w / 2, left), right - w);
      // Then farther up or down, clear of the staircase's vertical through the mark itself.
      for (const ty of [y - 13, y + 16, y - 26, y + 29, y - 39, y + 42].map(lift)) {
        if (ty - 8 <= top || ty + 12 * (k - 1) + 4 >= bottom) continue;
        spots.push({ x0: cx, x1: cx + w, ty, anchor: "start", lx: cx });
        if (x + 8 + w <= right) spots.push({ x0: x + 8, x1: x + 8 + w, ty, anchor: "start", lx: x + 8 });
        if (x - 8 - w >= left) spots.push({ x0: x - 8 - w, x1: x - 8, ty, anchor: "end", lx: x - 8 });
      }
      // A name off its mark's row is taken only close by (20 px), and in a crowd, where it
      // reads as the nearest mark's, only where its own mark is nearest by a clear margin;
      // farther off it goes to a lane, with a line to its mark.
      const h = c => hits(it, c, placed, leaders);
      const gap = c => (c.ty < mid ? it.top - c.ty - 12 * (k - 1) : c.ty - it.bottom);
      const ok = c => h(c) === 0 && (!nameAll || c.ty === mid || (gap(c) <= 20 && (!it.crowded || nearest(it, c))));
      const pick = spots.find(ok) ?? (nameAll ? null : [...spots].sort((c1, c2) => h(c1) - h(c2))[0] ?? { x0: x + 10, x1: x + 10 + w, lx: x + 10, anchor: "start", ty: mid });
      if (!pick) continue;
      const forced = h(pick) > 0;
      placed.push(...lines(it, pick));
      at.set(it, { c: pick, forced });
    }
    // The lanes stack like stairs: marks taken right to left with names running right (or the
    // mirror image), so each line passes left of every name nearer the mark's row. Of the four
    // ways the one naming the most with the shortest lines wins.
    const rest = order.filter(it => !at.has(it));
    if (nameAll && rest.length) {
      const callouts = (seq, anchors) => {
        const pl = [...placed], ld = [...leaders], got = new Map();
        let length = 0;
        for (const it of seq) {
          const { x, w, k } = it;
          search: for (let lane = 0; lane < 14; lane++) for (const side of [-1, 1]) {
            // The lane holds the line nearest the mark: a block above ends in it, one below starts in it.
            const ty = side < 0 ? it.top - 22 - 13 * lane - 12 * (k - 1) : it.bottom + 21 + 13 * lane;
            const [ya, yb] = side < 0 ? [ty + 12 * (k - 1) + 8, it.top - 8] : [it.bottom + 8, ty - 6];
            if (ty - 8 <= top || ty + 12 * (k - 1) + 4 >= bottom || !leaderFree(x, ya, yb, it.own, pl, ld)) continue;
            for (const anchor of anchors) {
              const lx = anchor === "start" ? x - 3 : x + 3;
              const c = anchor === "start" ? { x0: lx, x1: lx + w, ty, anchor, lx } : { x0: lx - w, x1: lx, ty, anchor, lx };
              if (c.x0 < left || c.x1 > right || hits(it, c, pl, ld) > 0) continue;
              const lead = { x, y0: ya, y1: yb };
              pl.push(...lines(it, c)); ld.push(lead); got.set(it, { c, lead }); length += yb - ya;
              break search;
            }
          }
        }
        return { got, length };
      };
      const rtl = [...rest].sort((a, b) => b.x - a.x || a.y - b.y), ltr = [...rtl].reverse();
      const best = [callouts(rtl, ["start"]), callouts(ltr, ["end"]), callouts(rtl, ["start", "end"]), callouts(ltr, ["end", "start"])]
        .sort((a, b) => b.got.size - a.got.size || a.length - b.length)[0];
      for (const [it, { c, lead }] of best.got) { placed.push(...lines(it, c)); leaders.push(lead); at.set(it, { c, forced: false, lead }); }
    }
    // Numbered marks, left to right, the number in the first free spot touching the mark. The
    // number links to the mark's row as the mark does, so on the site hovering either shows
    // the row's card, which names it; no key under the axis (Tristan, 2026-09-29).
    const keyed = order.filter(it => !at.has(it)).flatMap(it => it.ps.map((p, i) => ({ p, mx: it.own[i][0], my: it.own[i][1] })))
      .sort((a, b) => a.mx - b.mx || a.my - b.my);
    keyed.forEach((kd, i) => {
      const num = String(i + 1), w = textWidth(num, 9), { mx: x, my: y } = kd;
      const spots = [
        { x0: x + 7, x1: x + 7 + w, ty: y, anchor: "start", lx: x + 7 },
        { x0: x - 7 - w, x1: x - 7, ty: y, anchor: "end", lx: x - 7 },
        { x0: x - w / 2, x1: x + w / 2, ty: y - 10, anchor: "middle", lx: x },
        { x0: x - w / 2, x1: x + w / 2, ty: y + 11, anchor: "middle", lx: x },
      ];
      const h = c => covers(c.x0, c.x1, c.ty, [[x, y]]) + onLabel(c, placed) + onLeader(c, leaders);
      const pick = spots.find(c => h(c) === 0) ?? [...spots].sort((c1, c2) => h(c1) - h(c2))[0];
      placed.push(pick);
      Object.assign(kd, { num, x: pick.lx, y: pick.ty + 3, anchor: pick.anchor, box: pick });
    });
    let calls = 0, frontCalls = 0, length = 0;
    for (const [it, a] of at) if (a.lead) { calls++; frontCalls += it.front; length += a.lead.y1 - a.lead.y0; }
    return { order, at, leaders, keyed, fails: order.length - at.size, calls, frontCalls, length };
  };

  // The frontier's marks first, top to bottom. Where that leaves a mark numbered or on a line,
  // the other orders are tried as well and the best kept: fewest numbered, then fewest lines.
  const byY = (a, b) => a.y - b.y;
  const orders = [[...items].sort((a, b) => b.front - a.front || byY(a, b))];
  if (nameAll) orders.push([...items].sort(byY), [...items].sort((a, b) => byY(b, a)), [...items].sort((a, b) => a.x - b.x), [...items].sort((a, b) => b.x - a.x));
  const worse = (a, b) => a.fails - b.fails || a.calls - b.calls || a.frontCalls - b.frontCalls || a.length - b.length;
  let best = run(orders[0]);
  for (const o of orders.slice(1)) {
    if (!best.fails && !best.calls) break;
    const r = run(o);
    if (worse(r, best) < 0) best = r;
  }
  // Then the marks still unnamed go first, and the marks near them are named from lanes
  // too, so that one name set beside its mark no longer blocks every lane of its neighbour.
  const demote = new Set();
  for (let i = 0, cur = best; i < 4 && cur.fails; i++) {
    const failed = cur.order.filter(it => !cur.at.has(it));
    for (const it of items) if (failed.some(f => f !== it && Math.abs(f.x - it.x) < 90 && Math.abs(f.y - it.y) < 40)) demote.add(it);
    cur = run([...failed, ...cur.order.filter(it => cur.at.has(it))], demote);
    if (worse(cur, best) < 0) best = cur;
  }
  const out = [];
  for (const [it, { c, forced }] of best.at)
    it.names.forEach((s, i) => out.push({ s, rows: it.rows[i], w: textWidth(s, 10.5), x: c.lx, anchor: c.anchor, y: c.ty + 12 * i + 4, forced }));
  return { lines: out, leaders: best.leaders, keyed: best.keyed, crosses };
}

// Lines to marks, names and numbers, as layoutLabels placed them. A name for several rows
// carries them all, best first, as a merged mark does (size_accuracy.mjs), for the site's list.
const toRows = (rows, svg) => (rows.length > 1
  ? `<a class="pt" href="${rowHref(rows[0].inst, rows[0].r)}" data-rows="${rows.map(p => rowId(p.inst, p.r)).join(" ")}">${svg}</a>`
  : linked(rowHref(rows[0].inst, rows[0].r), svg));

// The marks, each linked to its row; marks drawn as one, within 6 px (as layoutLabels groups
// their names), all carry the whole pile, best first, so hovering whichever lies on top lists
// every row under it, as its name does (Tristan, 2026-10-06).
function drawMarks(t, parts, pts, X, Y) {
  const piles = [];
  for (const p of pts) {
    const x = X(p.cost.value), y = Y(p.e);
    const near = piles.filter(g => g.some(q => Math.abs(X(q.cost.value) - x) <= 6 && Math.abs(Y(q.e) - y) <= 6));
    piles.splice(0, piles.length, ...piles.filter(g => !near.includes(g)), [p, ...near.flat()]);
  }
  const pileOf = new Map(piles.flatMap(g => g.map(p => [p, [...g].sort((a, b) => a.e - b.e)])));
  for (const p of [...pts].sort((a, b) => a.eligible - b.eligible))
    parts.push(toRows(pileOf.get(p), mark(t, X(p.cost.value), Y(p.e), t.series[BOUNDS[p.r.bound_type]], p.eligible, p.cost.unit, null)));
}
function drawLabels(t, parts, inst, L) {
  const extent = l => (l.anchor === "start" ? [l.x, l.x + l.w] : [l.x - l.w, l.x]);
  for (const l of L.leaders) parts.push(`<path d="M${n(l.x)} ${n(l.y0)}V${n(l.y1)}" stroke="${t.muted}" stroke-width="1"/>`);
  for (const l of L.lines) {
    const [l0, l1] = extent(l);
    if (L.crosses(l0, l1, l.y - 4)) labelClashes.push(`${instLabel(inst)}: "${l.s}"`);
    parts.push(toRows(l.rows, text(l.x, l.y, l.s, { size: 10.5, fill: t.ink2, anchor: l.anchor })));
  }
  // A 9 px digit is a small target: an invisible box a little larger than it takes the pointer.
  // The digit comes second, so the site's hover scale (a.pt > :nth-child(2)) grows it as it grows a mark.
  for (const k of L.keyed) parts.push(linked(rowHref(k.p.inst, k.p.r),
    `<rect x="${n(k.box.x0 - 2)}" y="${n(k.box.ty - 6)}" width="${n(k.box.x1 - k.box.x0 + 4)}" height="11" fill="${t.surface}" fill-opacity="0"/>` +
    text(k.x, k.y, k.num, { size: 9, fill: t.ink2, anchor: k.anchor, weight: 600 })));
}

const meets = (a, r) => a.x0 < r.x1 && r.x0 < a.x1 && a.y0 < r.y1 && r.y0 < a.y1;

// An inset's frame: in the plot's top right corner, clear of the marks, the frontier and what
// is in `avoid` (the boxes, other insets), else the top left; null where neither holds 240 x
// 120 px. Its size is what its marks need - `wT` by `hT` - or as near as the free space allows.
function insetFrame(centres, segs, avoid, { left, right, top, bottom }, wT, hT) {
  const free = r => !avoid.some(a => meets({ x0: a.x0 - 6, x1: a.x1 + 6, y0: a.y0 - 6, y1: a.y1 + 6 }, r)) && !centres.some(([cx, cy]) => meets({ x0: cx - 10, x1: cx + 10, y0: cy - 10, y1: cy + 10 }, r)) &&
    !segs.some(g => meets({ x0: g.x0 - 2, x1: g.x1 + 2, y0: Math.min(g.y0, g.y1) - 2, y1: Math.max(g.y0, g.y1) + 2 }, r));
  for (const side of ["right", "left"]) {
    let best = null;
    for (let w = Math.min(Math.round(0.8 * (right - left)), Math.max(wT, 240)); w >= 240; w -= 10)
      for (let h = Math.min(Math.round(0.8 * (bottom - top)), Math.max(hT, 120)); h >= 120; h -= 10) {
        const x0 = side === "right" ? right - 4 - w : left + 4, r = { x0, x1: x0 + w, y0: top + 4, y1: top + 4 + h };
        if (!free(r)) continue;
        if (!best || w * h > (best.x1 - best.x0) * (best.y1 - best.y0)) best = r;
        break;
      }
    if (best) return best;
  }
  return null;
}

// The boxed region again, enlarged, in its frame inside the plot: its own gridlines and tick
// labels, the frontier's steps between the marks inside the box, and every mark named as in
// the plot.
function drawInset(t, parts, inst, pts, front, r, box, nameOf, heading) {
  parts.push(`<rect x="${n(r.x0)}" y="${n(r.y0)}" width="${n(r.x1 - r.x0)}" height="${n(r.y1 - r.y0)}" fill="${t.surface}" stroke="${t.muted}" stroke-width="1" stroke-dasharray="3 3" rx="3"/>`);
  parts.push(text(r.x0 + 8, r.y0 + 15, heading, { size: 9.5, fill: t.muted }));
  const left = r.x0 + 52, right = r.x1 - 10, top = r.y0 + 30, bottom = r.y1 - 22;
  const X = logScale(box.c0, box.c1, left, right);
  const Y = e => bottom - ((e - box.e0) / (box.e1 - box.e0)) * (bottom - top);
  // Names may use the whole frame, clear of its heading and tick labels.
  const tickBoxes = [{ x0: r.x0, x1: r.x0 + 8 + textWidth(heading, 9.5), y0: r.y0, y1: r.y0 + 20 }];
  const step = niceStep((box.e1 - box.e0) / 3), decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let i = Math.ceil(box.e0 / step); i * step <= box.e1; i++) {
    const s = (i * step).toFixed(decimals).replace("-", "−"), y = Y(i * step);
    parts.push(hline(left, right, y, t.grid));
    parts.push(text(left - 5, y + 3.5, s, { size: 9, fill: t.muted, anchor: "end", nums: true }));
    tickBoxes.push({ x0: left - 7 - textWidth(s, 9), x1: left - 3, y0: y - 5, y1: y + 5 });
  }
  // 1, 2 and 5 of each decade, or every digit where the box holds fewer than two of those.
  const ticks = ms => { const out = []; for (let k = Math.floor(log(box.c0)); k <= Math.ceil(log(box.c1)); k++) for (const m of ms) { const v = m * 10 ** k; if (v >= box.c0 && v <= box.c1) out.push([m, k, v]); } return out; };
  const xt = ticks([1, 2, 5]).length >= 2 ? ticks([1, 2, 5]) : ticks([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const [m, k, v] of xt) {
    const s = m === 1 ? pow10(k) : `${m}×${pow10(k)}`, w = textWidth(s, 9);
    parts.push(text(X(v), bottom + 14, s, { size: 9, fill: t.muted, anchor: "middle", nums: true }));
    tickBoxes.push({ x0: X(v) - w / 2 - 2, x1: X(v) + w / 2 + 2, y0: bottom + 5, y1: bottom + 17 });
  }
  if (front.length > 1) {
    let d = `M${n(X(front[0].cost.value))} ${n(Y(front[0].e))}`;
    for (const p of front.slice(1)) d += `H${n(X(p.cost.value))}V${n(Y(p.e))}`;
    parts.push(`<path d="${d}" fill="none" stroke="${t.series[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.7"/>`);
  }
  drawMarks(t, parts, pts, X, Y);
  drawLabels(t, parts, inst, layoutLabels({ pts, named: pts, X, Y, front, left: r.x0 + 6, right: r.x1 - 6, top: r.y0 + 14, bottom: r.y1 - 4, nameOf, nameAll: true, avoid: tickBoxes }));
}

// A panel: axes, frontier, marks and names. With `zoom`, the marks that found no room, their
// region is boxed and its marks are named in an inset instead; returns false when the plot
// has no room for one, so the caller keeps the panel without it.
function drawPanel(t, parts, inst, pts, { px, left, right, top, bottom, xLabel, title, nameAll = false, zoom = null, keyOut = null }) {
  const plotH = bottom - top;
  const rec = recordOf(inst), recE = rec ? rec.energy / perSiteDivisor(inst) : null;
  const front = frontierOf(pts);
  const nameOf = p => markName(p.r) + (p.cost.measuredByQmbl ? " (cost measured by QMBL)" : "");
  // Cost axis: a decade either side of the data. Energy axis: linear, as in the
  // record-over-time figure, so the record and an exact energy sit where they are.
  const cs = pts.map(p => p.cost.value);
  const x0 = 10 ** Math.floor(log(Math.min(...cs)) - 0.5), x1 = 10 ** Math.ceil(log(Math.max(...cs)) + 0.5);
  const X = logScale(x0, x1, left, right);
  const es = pts.map(p => p.e);
  const span = Math.max(Math.max(...es) - Math.min(...es), 1e-6);
  const step = niceStep(span / 4);
  const e0 = Math.floor((Math.min(...es) - span * 0.08) / step) * step;
  const e1 = Math.ceil((Math.max(...es) + span * 0.08) / step) * step;
  const Y = e => bottom - ((e - e0) / (e1 - e0)) * plotH;
  // The boxes: the marks to zoom on, in clusters of marks less than 80 px apart (a lone one
  // stays in the plot), each with a margin and grown until every mark it touches is one of its
  // own; boxes that meet merge. The rightmost gets an inset in the top right corner, the next
  // one in the top left. A box is at least clear of the marks it frames; the inset's own
  // heading says what it is.
  const zooms = [];
  if (zoom) {
    const pos = p => [X(p.cost.value), Y(p.e)];
    let clusters = [];
    for (const p of zoom) {
      const near = clusters.filter(c => c.some(q => Math.hypot(pos(q)[0] - pos(p)[0], pos(q)[1] - pos(p)[1]) < 80));
      clusters = [...clusters.filter(c => !near.includes(c)), [p, ...near.flat()]];
    }
    const boxOf = members => {
      for (let i = 0; ; i++) {
        const cs = members.map(p => log(p.cost.value)), es = members.map(p => p.e);
        const espan = Math.max(Math.max(...es) - Math.min(...es), 0.02 * (e1 - e0));
        const box = { c0: 10 ** (Math.min(...cs) - 0.06), c1: 10 ** (Math.max(...cs) + 0.06), e0: Math.min(...es) - 0.2 * espan, e1: Math.max(...es) + 0.2 * espan };
        const rect = { x0: X(box.c0) - 8, x1: X(box.c1) + 8, y0: Y(box.e1) - 8, y1: Y(box.e0) + 8 };
        const inBox = pts.filter(p => X(p.cost.value) > rect.x0 - 7 && X(p.cost.value) < rect.x1 + 7 && Y(p.e) > rect.y0 - 7 && Y(p.e) < rect.y1 + 7);
        if (i === 7 || inBox.every(p => members.includes(p))) return { box, rect, inBox };
        members = [...new Set([...members, ...inBox])];
      }
    };
    let boxes = clusters.filter(c => c.length >= 2).map(boxOf);
    for (let a = 0; a < boxes.length; a++)
      for (let b = a + 1; b < boxes.length; b++)
        if (meets(boxes[a].rect, boxes[b].rect)) { boxes = [...boxes.filter((_, i) => i !== a && i !== b), boxOf([...boxes[a].inBox, ...boxes[b].inBox])]; a = -1; break; }
    const midX = z => z.inBox.reduce((sum, p) => sum + pos(p)[0], 0) / z.inBox.length;
    for (const z of boxes.sort((a, b) => midX(b) - midX(a))) {
      // What the inset's marks need: their widest name beside a spread of marks, and a row each.
      const nameW = Math.max(...z.inBox.map(p => textWidth(nameOf(p), 10.5)));
      z.frame = insetFrame(pts.map(pos), stairs(front, X, Y), [...boxes.map(b => b.rect), ...zooms.map(q => q.frame)], { left, right, top, bottom },
        Math.min(560, 110 + nameW + 14 * z.inBox.length), Math.min(440, 80 + 26 * z.inBox.length));
      if (z.frame) zooms.push(z);
    }
    if (!zooms.length) return false;
  }
  if (title) parts.push(text(px, top - 14, title, { size: 12.5, fill: t.ink, weight: 600 }));
  parts.push(text(right, top - 14, perSiteLabel(inst), { size: 9.5, fill: t.muted, anchor: "end" }));
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  for (let i = 0; i <= Math.round((e1 - e0) / step); i++) {
    const v = e0 + i * step;
    parts.push(hline(left, right, Y(v), t.grid));
    parts.push(text(left - 6, Y(v) + 4, v.toFixed(decimals).replace("-", "−"), { size: 10, fill: t.muted, anchor: "end", nums: true }));
  }
  for (let k2 = Math.ceil(log(x0)); k2 <= Math.floor(log(x1)); k2++)
    parts.push(text(X(10 ** k2), bottom + 16, pow10(k2), { size: 10, fill: t.muted, anchor: "middle", nums: true }));
  if (front.length > 1) {
    let d = `M${n(X(front[0].cost.value))} ${n(Y(front[0].e))}`;
    for (const p of front.slice(1)) d += `H${n(X(p.cost.value))}V${n(Y(p.e))}`;
    parts.push(`<path d="${d}" fill="none" stroke="${t.series[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.7"/>`);
  }
  drawMarks(t, parts, pts, X, Y);
  // Two boxes are lettered from the left, "a" over the box and "Box a, enlarged" on its inset.
  zooms.sort((a, b) => a.rect.x0 - b.rect.x0).forEach((z, i) => {
    const { rect: r, box, inBox, frame } = z, tag = zooms.length > 1 ? "ab"[i] : null;
    parts.push(`<rect x="${n(r.x0)}" y="${n(r.y0)}" width="${n(r.x1 - r.x0)}" height="${n(r.y1 - r.y0)}" fill="none" stroke="${t.muted}" stroke-width="1" stroke-dasharray="3 3" rx="3"/>`);
    if (tag) { parts.push(text(r.x0 + 1, r.y0 - 4, tag, { size: 10, fill: t.muted, weight: 600 })); z.tagRect = { x0: r.x0, x1: r.x0 + 9, y0: r.y0 - 14, y1: r.y0 }; }
    drawInset(t, parts, inst, inBox, front.filter(p => inBox.includes(p)), frame, box, nameOf, tag ? `Box ${tag}, enlarged` : "The boxed region, enlarged");
  });
  // An instance's own figure names every mark (Tristan, 2026-09-24: a dot without a name
  // cannot be read); the small overview panels name the frontier only, where naming them
  // all piles the labels on each other.
  const hide = new Set(zooms.flatMap(z => z.inBox));
  const named = [...new Set([...front, ...(nameAll ? pts : [])])].filter(p => !hide.has(p));
  const L = layoutLabels({ pts, named, X, Y, front, left, right, top, bottom, nameOf, nameAll, avoid: zooms.flatMap(z => [z.rect, z.frame, ...(z.tagRect ? [z.tagRect] : [])]) });
  keyOut?.push(...L.keyed.map(k => k.p));
  // An overview label with no free spot is nudged down only past labels it actually overlaps,
  // horizontally as well as vertically.
  const labels = L.lines.sort((a, b) => a.y - b.y);
  const extent = l => (l.anchor === "start" ? [l.x, l.x + l.w] : [l.x - l.w, l.x]);
  for (let a = 1; a < labels.length; a++) {
    if (!labels[a].forced) continue;
    const [a0, a1] = extent(labels[a]);
    for (let b = 0; b < a; b++) {
      const [b0, b1] = extent(labels[b]);
      if (a0 < b1 && b0 < a1 && Math.abs(labels[a].y - labels[b].y) < 12) {
        labels[a].y = labels[b].y + 12;
        // pushed onto the frontier line: step on past it
        for (let k = 0; k < 3 && L.crosses(a0, a1, labels[a].y - 4); k++) labels[a].y += 12;
      }
    }
  }
  drawLabels(t, parts, inst, L);
  parts.push(text((left + right) / 2, bottom + 32, xLabel, { size: 10.5, fill: t.ink2, anchor: "middle" }));
  if (rec && !pts.some(p => p.r === rec))
    parts.push(text(left, bottom + 48, `${rec.bound_type === "exact" ? boundLabel(rec) : "record"}: ${recE.toFixed(6).replace("-", "−")} (${markName(rec)}), no cost stated, not drawn`, { size: 9.5, fill: t.muted }));
  return true;
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
  "nqs-v2": "Network estimates: iterations × samples × (connected configurations + sampler proposals + 3) × forward-pass FLOPs × evaluations per amplitude, " +
    "stage by stage, from the counts the paper or run script states, with the optimizer's solve where the code is known; pre-training is not counted.",
  "mvmc-v2": "mVMC estimates: Pfaffian updates, ratios and recomputations over every projection term plus the SR solve, from the run's def files, " +
    "with the acceptance bounded by 1 (about twice the measured sampling).",
  "vqe-v1": "VQE estimates: state-vector gate, metric-tensor and energy-derivative work of the run script's natural-gradient schedule.",
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
