// Spin-1/2 ED (Pauli matrices, S^z_tot = 0 sector, no other symmetry) for the E1 spin rows.
//   node run_spins.mjs <instance> [<instance> ...]     results -> results/<instance>.json
// Geometry follows varbench/methods programs/vmc_netket (vmc.py get_ham, ham.py ColoredJ1J2).
import fs from "node:fs";
import { lanczos, heisenbergOperator, gridEdges, coloredJ1J2, latticeNNEdges, uniqueEdges } from "./ed_lib.mjs";

const RES = new URL("./results/", import.meta.url);
fs.mkdirSync(RES, { recursive: true });

function checkUnique(edges, label) {
  const u = uniqueEdges(edges);
  if (u.length !== edges.length) throw new Error(`${label}: ${edges.length - u.length} duplicate edges`);
  return edges;
}

// shuriken (square-kagome) lattice = line graph of the 4.8.8 lattice; L x L unit cells, 6 sites per cell.
// 4.8.8 vertices per cell: 0:(+s,0) 1:(0,+s) 2:(-s,0) 3:(0,-s) around the cell centre; square edges 0-1,1-2,2-3,3-0,
// inter-cell edges (+s,0)_R -- (-s,0)_{R+x} and (0,+s)_R -- (0,-s)_{R+y}. Sites of the shuriken lattice = these 6 edges per cell;
// two sites are bonded when the edges share a vertex.
export function shurikenEdges(L) {
  const V = (x, y, a) => ((((x % L) + L) % L) * L + (((y % L) + L) % L)) * 4 + a;
  const E = [];
  for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) {
    E.push([V(x, y, 0), V(x, y, 1)], [V(x, y, 1), V(x, y, 2)], [V(x, y, 2), V(x, y, 3)], [V(x, y, 3), V(x, y, 0)]);
    E.push([V(x, y, 0), V(x + 1, y, 2)], [V(x, y, 1), V(x, y + 1, 3)]);
  }
  const nV = L * L * 4;
  const inc = Array.from({ length: nV }, () => []);
  E.forEach(([a, b], k) => { inc[a].push(k); inc[b].push(k); });
  if (inc.some((l) => l.length !== 3)) throw new Error("4.8.8 not 3-regular");
  const bonds = [];
  for (const l of inc) for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) bonds.push([l[p], l[q]]);
  const u = uniqueEdges(bonds);
  const deg = new Array(E.length).fill(0); u.forEach(([i, j]) => { deg[i]++; deg[j]++; });
  return { N: E.length, edges: u, duplicates: bonds.length - u.length, degrees: [...new Set(deg)] };
}

// shuriken lattice exactly as in arXiv:2110.08198v3 Supplement Sec. I on an L x L torus of unit cells
const SUB = { A: [-0.25, -0.25], B: [-0.25, 0.25], C: [0.25, 0.25], D: [0.25, -0.25], E: [0, -0.5], F: [0.5, 0] };
const SUBS = Object.keys(SUB);
export function shurikenPaper(L) {
  const sites = [];
  for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) for (const s of SUBS) sites.push({ x, y, s, r: [x + SUB[s][0], y + SUB[s][1]] });
  const wrap = (d) => d - L * Math.round(d / L);
  const edges = [];
  const leg = Math.SQRT2 / 4;
  const square = new Set(["AB", "BC", "CD", "AD"]);
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
    const a = sites[i], b = sites[j];
    const d = Math.hypot(wrap(b.r[0] - a.r[0]), wrap(b.r[1] - a.r[1]));
    const sameCellSquare = a.x === b.x && a.y === b.y && square.has([a.s, b.s].sort().join(""));
    if (Math.abs(d - leg) < 1e-9 || sameCellSquare) edges.push([i, j]);
  }
  const deg = new Array(sites.length).fill(0); edges.forEach(([i, j]) => { deg[i]++; deg[j]++; });
  return { N: sites.length, sites, edges, degrees: [...new Set(deg)] };
}
// map the line-graph sites (edge midpoints of the 4.8.8 lattice, s = 1/2) onto the paper's sites and compare bond sets
function shurikenCrossCheck(L, p) {
  const lg = shurikenEdges(L);
  const mod = (v) => ((v % L) + L) % L;
  const vpos = (idx) => { const a = idx % 4, c = (idx - a) / 4, y = c % L, x = (c - y) / L; return [[x + 0.5, y], [x, y + 0.5], [x - 0.5, y], [x, y - 0.5]][a]; };
  // rebuild the 4.8.8 edge list in the same order as shurikenEdges
  const V = (x, y, a) => ((((x % L) + L) % L) * L + (((y % L) + L) % L)) * 4 + a;
  const E = [];
  for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) {
    E.push([V(x, y, 0), V(x, y, 1)], [V(x, y, 1), V(x, y, 2)], [V(x, y, 2), V(x, y, 3)], [V(x, y, 3), V(x, y, 0)]);
    E.push([V(x, y, 0), V(x + 1, y, 2)], [V(x, y, 1), V(x, y + 1, 3)]);
  }
  const wrap = (d) => d - L * Math.round(d / L);
  const map = E.map(([a, b]) => {
    const pa = vpos(a), pb = vpos(b);
    const mid = [mod(pa[0] + wrap(pb[0] - pa[0]) / 2), mod(pa[1] + wrap(pb[1] - pa[1]) / 2)];
    const k = p.sites.findIndex((s) => Math.abs(mod(s.r[0]) - mid[0]) < 1e-9 && Math.abs(mod(s.r[1]) - mid[1]) < 1e-9);
    return k;
  });
  const bij = new Set(map).size === p.N && !map.includes(-1);
  const pset = new Set(p.edges.map(([i, j]) => `${Math.min(i, j)}-${Math.max(i, j)}`));
  let matched = 0;
  for (const [i, j] of lg.edges) if (pset.has(`${Math.min(map[i], map[j])}-${Math.max(map[i], map[j])}`)) matched++;
  return { bijective: bij, matched, lineGraphBonds: lg.edges.length, paperBonds: p.edges.length, identical: bij && matched === p.edges.length && lg.edges.length === p.edges.length };
}

function build(instance) {
  const [model, rest] = instance.split("/");
  const J2m = rest.match(/_([0-9.]+)$/);
  const info = {};
  let N, bonds;
  if (instance === "Heisenberg/chain_20_O" || instance === "Heisenberg/chain_20_P") {
    const pbc = instance.endsWith("_P");
    const e = checkUnique(gridEdges([20], pbc), instance); N = 20; bonds = e.map(([i, j]) => [i, j, 1]);
    info.geometry = `nk.graph.Grid(extent=[20], pbc=${pbc}) -> ${e.length} bonds`;
    info.script = `scripts/${instance}/ed_netket.sh (ed.py --ham heis --boundary ${pbc ? "peri" : "open"} --L 20 --zero_mag)`;
  } else if (instance === "Heisenberg/kagome-2x3_18_P") {
    const r = latticeNNEdges([[1, 0], [-0.5, Math.sqrt(0.75)]], [3, 2], [[0.5, 0], [0.25, Math.sqrt(0.75) / 2], [0.75, Math.sqrt(0.75) / 2]], true);
    N = r.N; bonds = r.edges.map(([i, j]) => [i, j, 1]);
    const deg = new Array(N).fill(0); r.edges.forEach(([i, j]) => { deg[i]++; deg[j]++; });
    info.geometry = `nk.graph.Lattice(basis [[1,0],[-0.5,sqrt(3)/2]], extent [3,2], 3 site offsets, pbc) nn shell d=${r.dmin}: ${r.edges.length} bonds, degrees ${[...new Set(deg)]}, pairs with >1 nn image: ${r.multi.length}`;
    info.script = "scripts/Heisenberg/kagome-2x3_18_P/ed_netket.sh (ed.py --ham heis_kag --L 3 --L2 2 --zero_mag)";
  } else if (instance === "Heisenberg/square_16_P") {
    const e = checkUnique(gridEdges([4, 4], true), instance); N = 16; bonds = e.map(([i, j]) => [i, j, 1]);
    info.geometry = `4x4 torus nearest neighbours, ${e.length} bonds`;
    info.script = "no ED script in varbench/methods for this instance (exact row cites scripts/Heisenberg/square_16_P/vqe.sh)";
  } else if (instance === "Heisenberg/triangular_16_P") {
    const e = checkUnique(coloredJ1J2(4, 4, true, false), instance); N = 16; bonds = e.map(([i, j]) => [i, j, 1]);
    info.geometry = `ham.py ColoredJ1J2((4,4), pbc, back_diag=False), both colours J=1: ${e.length} bonds`;
    info.script = "scripts/Heisenberg/triangular_16_P/ed_netket.sh (ed.py --ham heis_tri --L 4 --zero_mag)";
  } else if (instance === "Heisenberg/shuriken_24_P") {
    const p = shurikenPaper(2);
    const x = shurikenCrossCheck(2, p);
    if (!x.identical) throw new Error("paper geometry and 4.8.8 line graph differ: " + JSON.stringify(x));
    N = p.N; bonds = p.edges.map(([i, j]) => [i, j, 1]);
    info.geometry = `arXiv:2110.08198v3 Supplement Sec. I (eqs. S1-S2): square Bravais lattice, sublattices A(-1/4,-1/4) B(-1/4,1/4) C(1/4,1/4) D(1/4,-1/4) E(0,-1/2) F(1/2,0); "D4 symmetric 6x2^2 cluster" = 2x2 cells, PBC. Bonds: triangle legs (distance sqrt(2)/4) + square edges A-B-C-D: ${p.edges.length} bonds, degrees ${p.degrees}. Bond set identical (${x.matched}/${p.edges.length}) to the line graph of the 4.8.8 lattice on the same torus`;
    info.script = "no script in varbench/methods; row cites PRB 104, L220408 (arXiv:2110.08198)";
  } else if (model === "J1J2") {
    const J2 = Number(J2m[1]);
    const [L1, L2] = rest.startsWith("rectangular-4x6") ? [4, 6] : [4, 4];
    const e = checkUnique(coloredJ1J2(L1, L2, true, true), instance);
    N = L1 * L2; bonds = e.map(([i, j, c]) => [i, j, c === 0 ? 1 : J2]);
    info.geometry = `ham.py ColoredJ1J2((${L1},${L2}), pbc, back_diag=True): ${e.filter((x) => x[2] === 0).length} J1 + ${e.filter((x) => x[2] === 1).length} J2 bonds, J2=${J2}`;
    info.script = L1 === 4 && L2 === 6 ? `scripts/${instance}/ed_lattice_symmetries.sh (ed_ls.py --ham j1j2 --L 4 --L2 6 --J2 0.5 --zero_mag; sector: translations/reflections 0, spin inversion +1)` : `scripts/${instance}/ed_netket.sh (ed.py --ham j1j2 --L 4 --J2 ${J2} --zero_mag)`;
  } else throw new Error("unknown instance " + instance);
  return { N, bonds, info };
}

for (const instance of process.argv.slice(2)) {
  const t0 = Date.now();
  const { N, bonds, info } = build(instance);
  const op = heisenbergOperator(N, N / 2, bonds);
  console.log(`${instance}: N=${N} D=${op.D} ${info.geometry}`);
  const r = lanczos(op.apply, op.D, { resTol: 1e-10, log: null });
  const rec = { instance, E: r.E, E_ritz: r.E_ritz, residual: r.residual, resEst: r.resEst, iterations: r.iterations, D: op.D,
    sector: "S^z_tot = 0, no other symmetry", convention: "Pauli, H = sum_b J_b sigma_i.sigma_j", ...info,
    code: "out/E1-exact-recompute/run_spins.mjs + ed_lib.mjs", seconds: (Date.now() - t0) / 1000, rss_MB: Math.round(process.memoryUsage().rss / 1e6) };
  fs.writeFileSync(new URL(instance.replace("/", "__") + ".json", RES), JSON.stringify(rec, null, 1));
  console.log(`  E=${r.E} ritz=${r.E_ritz} residual=${r.residual.toExponential(2)} it=${r.iterations} ${rec.seconds}s rss=${rec.rss_MB}MB`);
}
