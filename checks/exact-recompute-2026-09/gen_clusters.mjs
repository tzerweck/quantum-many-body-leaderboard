// VE-exact-recompute: bond lists for the kagome clusters of Lauchli, Sudan & Sorensen, PRB 83, 212401 (arXiv:1103.1159,
// Table I: "basis vectors a,b in terms of a1 and a2 (each of length 2a)") and VarBench kagome-LxM, plus the shuriken 24.
// Geometry only (no diagonalisation here). Kagome: Bravais a1 = (2,0), a2 = (1, sqrt3) (60 degrees, |a| = 2, NN distance 1),
// sites s0 = R, s1 = R + a1/2, s2 = R + a2/2. Positions in doubled lattice coordinates (x, y) = 2 * (coefficients of a1, a2);
// real-space squared distance of a doubled difference (dx, dy) in NN units: dx^2 + dx dy + dy^2 (NN = 1).
// Bonds = all pairs at minimum-image squared distance 1 (built by real-space search, not by a neighbour table).
import fs from "node:fs";
const OUTDIR = new URL("./clusters/", import.meta.url);
fs.mkdirSync(OUTDIR, { recursive: true });

const q = ([dx, dy]) => dx * dx + dx * dy + dy * dy;
function kagome(name, A, B, extra = {}) {
  const [p, qq] = A, [u, v] = B, D = p * v - qq * u, cells = Math.abs(D);
  // canonical cell representative of (x, y) modulo the superlattice spanned by A, B (coefficients in [0,1))
  const fdiv = (x, y) => Math.floor(x / y);
  const canon = (x, y) => { const a = fdiv(x * v - y * u, D), b = fdiv(p * y - qq * x, D); return [x - a * p - b * u, y - a * qq - b * v]; };
  const cellList = [], cellKey = new Map();
  for (let x = -3 * cells; x <= 3 * cells; x++) for (let y = -3 * cells; y <= 3 * cells; y++) {
    const [cx, cy] = canon(x, y), k = cx + "," + cy;
    if (!cellKey.has(k)) { cellKey.set(k, cellList.length); cellList.push([cx, cy]); }
  }
  if (cellList.length !== cells) throw new Error(`${name}: ${cellList.length} cells != ${cells}`);
  const tau = [[0, 0], [1, 0], [0, 1]];
  const pos = [];
  for (const [cx, cy] of cellList) for (const t of tau) pos.push([2 * cx + t[0], 2 * cy + t[1]]);
  const N = pos.length;
  // minimum-image search over superlattice shifts
  const sup = [[2 * p, 2 * qq], [2 * u, 2 * v]];
  const shifts = [];
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) shifts.push([a * sup[0][0] + b * sup[1][0], a * sup[0][1] + b * sup[1][1]]);
  const bonds = [], multi = [];
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    let hits = 0;
    for (const s of shifts) if (q([pos[j][0] - pos[i][0] + s[0], pos[j][1] - pos[i][1] + s[1]]) === 1) hits++;
    if (hits) bonds.push([i, j]);
    if (hits > 1) multi.push([i, j, hits]);
  }
  const deg = new Array(N).fill(0); bonds.forEach(([i, j]) => { deg[i]++; deg[j]++; });
  if (bonds.length !== 2 * N || deg.some((d) => d !== 4)) throw new Error(`${name}: ${bonds.length} bonds, degrees ${[...new Set(deg)]}`);
  // 12 point-group matrices of the triangular Bravais lattice in the (a1, a2) basis, acting on column (x, y)
  const rot = ([[a, b], [c, d]]) => [[-c, -d], [a + c, b + d]];     // R60 . M  with R60 (x,y) -> (-y, x+y)
  const refl = ([[a, b], [c, d]]) => [[c, d], [a, b]];               // (x,y) -> (y,x)
  const pg = []; let M = [[1, 0], [0, 1]];
  for (let k = 0; k < 6; k++) { pg.push(M, refl(M)); M = rot(M); }
  const obj = { name, lattice: "kagome", a: A, b: B, cells, N, bonds, positions: pos, supercell: sup, point_group: pg,
    metric: "doubled (a1,a2) coordinates; |d|^2 = dx^2 + dx dy + dy^2, NN = 1", multi_image_pairs: multi.length, ...extra };
  fs.writeFileSync(new URL(`${name}.json`, OUTDIR), JSON.stringify(obj));
  console.log(name, "N", N, "bonds", bonds.length, "multi-image pairs", multi.length, extra.expected_SS ?? "");
}
const LSS = "Lauchli, Sudan & Sorensen PRB 83, 212401 (arXiv:1103.1159v2) Table I";
kagome("kagome_12", [2, 0], [0, 2], { source: LSS + " cluster 12 (= QMBL kagome-2x2_12_P)", expected_SS: -5.444875216 });
kagome("kagome_18vb", [2, 0], [0, 3], { source: "VarBench kagome-2x3 = {2 a1, 3 a2} (P4: C6v-equivalent to LSS 18b)", expected_pauli: -32.19308309416487 });
kagome("kagome_18a", [2, -1], [0, 3], { source: LSS + " cluster 18a", expected_SS: -8.064482605 });
kagome("kagome_18b", [2, -2], [-2, -1], { source: LSS + " cluster 18b", expected_SS: -8.048270773 });
kagome("kagome_24", [1, 2], [-3, 2], { source: LSS + " cluster 24", expected_SS: -10.589965547 });
kagome("kagome_30", [2, 1], [-2, 4], { source: LSS + " cluster 30", expected_SS: -13.154318948 });
kagome("kagome_36a", [-2, 3], [4, 0], { source: LSS + " cluster 36a", expected_SS: -15.787874847 });
kagome("kagome_36b", [3, 0], [-2, 4], { source: LSS + " cluster 36b with b = (-2,4) (printed (-3,4) is a misprint per P4: (-2,4) reproduces |b| = sqrt12, d = sqrt21, |G| = 48)", expected_SS: -15.806927756 });
kagome("kagome_36c", [3, 0], [-1, 4], { source: LSS + " cluster 36c", expected_SS: -15.814334002 });
kagome("kagome_36d", [4, -2], [-2, 4], { source: LSS + " cluster 36d", expected_SS: -15.781555118 });

// shuriken (square-kagome) 24: arXiv:2110.08198v3 Supplement Sec. I, 2x2 cells of the square Bravais lattice, PBC;
// sublattices A(-1/4,-1/4) B(-1/4,1/4) C(1/4,1/4) D(1/4,-1/4) E(0,-1/2) F(1/2,0); bonds = triangle legs (distance sqrt2/4)
// + the square A-B-C-D of each cell (as E1 run_spins.mjs shurikenPaper). Positions x4 (integers).
{
  const L = 2, SUB = { A: [-1, -1], B: [-1, 1], C: [1, 1], D: [1, -1], E: [0, -2], F: [2, 0] }, S = Object.keys(SUB);
  const sites = [];
  for (let x = 0; x < L; x++) for (let y = 0; y < L; y++) for (const s of S) sites.push({ x, y, s, r: [4 * x + SUB[s][0], 4 * y + SUB[s][1]] });
  const wrap = (d) => d - 4 * L * Math.round(d / (4 * L));
  const sq = new Set(["AB", "BC", "CD", "AD"]);
  const bonds = [];
  for (let i = 0; i < sites.length; i++) for (let j = i + 1; j < sites.length; j++) {
    const a = sites[i], b = sites[j];
    const d2 = wrap(b.r[0] - a.r[0]) ** 2 + wrap(b.r[1] - a.r[1]) ** 2;
    if (d2 === 2 || (a.x === b.x && a.y === b.y && sq.has([a.s, b.s].sort().join("")))) bonds.push([i, j]);
  }
  const deg = new Array(sites.length).fill(0); bonds.forEach(([i, j]) => { deg[i]++; deg[j]++; });
  const obj = { name: "shuriken_24", lattice: "shuriken", N: sites.length, bonds, positions_x4: sites.map((s) => s.r), cells: L * L,
    source: "arXiv:2110.08198v3 Supplement Sec. I (as E1 run_spins.mjs shurikenPaper(2))", degrees: [...new Set(deg)] };
  fs.writeFileSync(new URL("shuriken_24.json", OUTDIR), JSON.stringify(obj));
  console.log("shuriken_24 N", sites.length, "bonds", bonds.length, "degrees", [...new Set(deg)]);
}
