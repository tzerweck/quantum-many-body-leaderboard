// Where each name goes on a scatter plot: beside its mark where that covers nothing, else in a
// lane above or below with a line to it, marks drawn as one named together; and where an
// inset goes.
//
// A verbatim copy of stairs(), layoutLabels(), meets() and insetFrame() in pareto.mjs at
// 77d3c2e (Tristan, 2026-09-29), for the record-over-time figure; pareto.mjs, which another
// session is still changing, is to import them from here once that settles. Points are placed
// at X(p.cost.value), Y(p.e). One addition: `lines`, boxes a name keeps clear of but a lane's
// line may cross (the record-over-time figure's full-width record line, which would otherwise
// close every lane).
import { textWidth } from "./chart.mjs";

// The frontier's staircase as horizontal and vertical segments on screen.
export const stairs = (front, X, Y) => front.slice(1).flatMap((p, i) => {
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
export function layoutLabels({ pts, named, X, Y, front, left, right, top, bottom, nameOf, nameAll, avoid = [], lines: crossable = [] }) {
  const centres = pts.map(p => [X(p.cost.value), Y(p.e)]);
  const segs = stairs(front, X, Y);
  // The label's glyph box: baseline at ty + 4, cap height about 8 at 10.5 px.
  const crosses = (x0, x1, ty) => segs.filter(g => Math.max(g.x0, x0 - 1) <= Math.min(g.x1, x1 + 1) &&
    Math.max(Math.min(g.y0, g.y1), ty - 5) <= Math.min(Math.max(g.y0, g.y1), ty + 7)).length;
  const mine = (cx, cy, own) => own.some(([ox, oy]) => ox === cx && oy === cy);
  const blocked = (x0, x1, y0, y1) => avoid.filter(r => x0 < r.x1 && r.x0 < x1 && y0 < r.y1 && r.y0 < y1).length;
  const onLine = (x0, x1, y0, y1) => crossable.filter(r => x0 < r.x1 && r.x0 < x1 && y0 < r.y1 && r.y0 < y1).length;
  // A mark is clear of a name when its dot misses the glyph box; the small overview panels,
  // which name the frontier only, keep their older, looser margin.
  const [above, below] = nameAll ? [10, 12] : [9, 9];
  const covers = (x0, x1, ty, own) => centres.filter(([cx, cy]) => !mine(cx, cy, own) && cx + 6 > x0 && cx - 6 < x1 && cy > ty - above && cy < ty + below).length +
    crosses(x0, x1, ty) + blocked(x0 - 1, x1 + 1, ty - 5, ty + 7) + onLine(x0 - 1, x1 + 1, ty - 5, ty + 7);

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

// Also verbatim from pareto.mjs: where an inset goes.
export const meets = (a, r) => a.x0 < r.x1 && r.x0 < a.x1 && a.y0 < r.y1 && r.y0 < a.y1;

// An inset's frame: in the plot's top right corner, clear of the marks, the frontier and what
// is in `avoid` (the boxes, other insets), else the top left; null where neither holds 240 x
// 120 px. Its size is what its marks need - `wT` by `hT` - or as near as the free space allows.
export function insetFrame(centres, segs, avoid, { left, right, top, bottom }, wT, hT) {
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
