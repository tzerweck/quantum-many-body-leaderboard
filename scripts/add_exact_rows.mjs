// Exactly solved instances: benchmarks whose ground-state energy is known to within a
// stated error, so that a paper reporting on them can be scored by its distance from the
// answer rather than ranked against other papers. Most of these instances have no
// variational row at all yet; that is the point of carrying them.
//
// Every table below was read from the paper's own text (PDF layout mode or arXiv HTML),
// parsed by column position or table cell, and the literal here checked value by value
// against that parse. Energies are stored in the instance's convention (DATA.md): Hubbard
// as totals, Heisenberg as Pauli totals, 4 N x the S.S energy per site.
import fs from "node:fs";

const CHECKED = "2026-09-15";

// "-18.024(6)" -> [-18.024, 0.006]: one standard deviation on the last printed digit
const parse = s => {
  const m = s.match(/^(-?\d+\.\d+)\((\d+)\)$/);
  if (!m) throw new Error(`cannot parse ${s}`);
  const dec = m[1].split(".")[1].length;
  return [+m[1], +(m[2] * 10 ** -dec).toPrecision(2)];   // 9 * 1e-3 is 0.009000000000000001
};

let added = 0, created = 0;
function put(id, create, row) {
  const p = `data/${id}.json`;
  const exists = fs.existsSync(p);
  // dof and einf live on rows, not on the instance header (DATA.md)
  const { dof: cDof, einf: cEinf, ...header } = create;
  const inst = exists ? JSON.parse(fs.readFileSync(p, "utf8")) : { ...header, instance_id: id, rows: [] };
  if (!exists) created++;
  // dof and einf as the rest of the instance carries them, or the definition (DATA.md)
  // when there is no other row to copy from
  const dof = inst.rows[0]?.dof ?? cDof;
  const einf = inst.rows[0]?.einf ?? cEinf;
  inst.rows.push({
    energy: row.energy, sigma: row.sigma, energy_variance: null, dof, einf, v_score: null,
    method: row.method, bound_type: "exact", bound_type_reason: row.why,
    reference: row.src.ref, peer_reviewed: row.src.pr,
    source: "exact-2026-09-15", provenance: "primary",
    verified: { checked_on: CHECKED, method: row.read, reported_as: row.reported, note: row.note, secondary_of: null },
  });
  added++;
  fs.mkdirSync(`data/${id.split("/")[0]}`, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}

// ---------------------------------------------------------------------------------------
// Batch A: the half-filled square-lattice Hubbard model from Qin, Shi & Zhang, "Benchmark
// study of the two-dimensional Hubbard model with auxiliary-field quantum Monte Carlo
// method", Phys. Rev. B 94, 085103 (2016), arXiv:1605.09421, Table IV. At half filling on
// a bipartite lattice AFQMC has no sign problem and the paper states the results are
// numerically exact; the Trotter step (tau = 0.01) was verified to keep that error below
// the statistical one. 7 sizes x 4 values of U x 2 boundary conditions = 56 energies.
// Read from the PDF in layout mode, E rows only (the P and K rows are not carried).
//
// Boundary codes follow VarBench lattice.md: P = periodic in both directions, PA =
// periodic in x and antiperiodic in y. The paper's "PBC-APBC" is the latter; on an L x L
// lattice the two orientations are equivalent. Energies are totals, stored as-is.
const QIN = { ref: "Qin, Shi & Zhang, Benchmark study of the two-dimensional Hubbard model with auxiliary-field quantum Monte Carlo method, Phys. Rev. B 94, 085103 (2016), arXiv:1605.09421", pr: true };

// [L, U, boundary, as printed]. Same order as the table: within a size, U = 2, 4, 6, 8,
// each as PBC then PBC-APBC.
const TABLE_IV = [
  [4, 2, "P", "-18.024(6)"], [4, 2, "PA", "-20.114(2)"], [4, 4, "P", "-13.616(6)"], [4, 4, "PA", "-14.594(3)"],
  [4, 6, "P", "-10.541(4)"], [4, 6, "PA", "-10.902(7)"], [4, 8, "P", "-8.476(9)"], [4, 8, "PA", "-8.646(8)"],
  [6, 2, "P", "-41.457(5)"], [6, 2, "PA", "-43.499(2)"], [6, 4, "P", "-30.865(9)"], [6, 4, "PA", "-31.43(2)"],
  [6, 6, "P", "-23.74(1)"], [6, 6, "PA", "-23.84(1)"], [6, 8, "P", "-19.00(2)"], [6, 8, "PA", "-19.01(1)"],
  [8, 2, "P", "-74.470(5)"], [8, 2, "PA", "-76.308(3)"], [8, 4, "P", "-55.05(1)"], [8, 4, "PA", "-55.31(1)"],
  [8, 6, "P", "-42.16(2)"], [8, 6, "PA", "-42.17(2)"], [8, 8, "P", "-33.68(3)"], [8, 8, "PA", "-33.66(2)"],
  [10, 2, "P", "-116.908(4)"], [10, 2, "PA", "-118.505(4)"], [10, 4, "P", "-86.12(4)"], [10, 4, "PA", "-86.20(2)"],
  [10, 6, "P", "-65.80(2)"], [10, 6, "PA", "-65.76(2)"], [10, 8, "P", "-52.54(3)"], [10, 8, "PA", "-52.49(2)"],
  [12, 2, "P", "-168.749(7)"], [12, 2, "PA", "-170.112(3)"], [12, 4, "P", "-123.95(2)"], [12, 4, "PA", "-123.99(3)"],
  [12, 6, "P", "-94.66(2)"], [12, 6, "PA", "-94.67(2)"], [12, 8, "P", "-75.54(2)"], [12, 8, "PA", "-75.58(3)"],
  [14, 2, "P", "-229.981(6)"], [14, 2, "PA", "-231.134(4)"], [14, 4, "P", "-168.67(2)"], [14, 4, "PA", "-168.69(3)"],
  [14, 6, "P", "-128.76(2)"], [14, 6, "PA", "-128.78(3)"], [14, 8, "P", "-102.85(3)"], [14, 8, "PA", "-102.83(4)"],
  [16, 2, "P", "-300.596(6)"], [16, 2, "PA", "-301.562(5)"], [16, 4, "P", "-220.29(4)"], [16, 4, "PA", "-220.30(4)"],
  [16, 6, "P", "-168.19(3)"], [16, 6, "PA", "-168.21(5)"], [16, 8, "P", "-134.23(3)"], [16, 8, "PA", "-134.25(3)"],
];

for (const [L, U, bc, printed] of TABLE_IV) {
  const N = L * L, Nf = N / 2;
  const [energy, sigma] = parse(printed);
  put(`Hubbard/square_${N}_${bc}_${Nf}_${U}`,
    { model: "Hubbard", lattice: "square", n_sites: N, boundary: bc, params: { Nf, U }, dof: 2 * Nf, einf: (U * Nf * Nf) / N },
    { energy, sigma, src: QIN,
      method: "AFQMC, sign-problem-free at half filling (tau = 0.01, Trotter error below the statistical error)",
      why: "sign-problem-free AFQMC at half filling on a bipartite lattice; the paper states the results are numerically exact (RULES.md 4)",
      read: "arXiv PDF extracted locally with pypdf in layout mode, E rows of Table IV parsed by column position; no LLM transcription",
      reported: `E = ${printed} (total), ${L} x ${L}, U = ${U}, ${bc === "P" ? "PBC" : "PBC-APBC"}`,
      note: `Table IV, "Total ground state energy (E) ... in the Hubbard model at half-filling, for U = 2, 4, 6, 8 ... for both PBC and PBC-APBC. Statistical errors are on the last digit." Row ${L} x ${L}, column U = ${U} ${bc === "P" ? "PBC" : "PBC-APBC"}. Half filling: N_up = N_dn = ${Nf}. Cross-checks: the 8 x 8 PBC values at U = 4 and 8 agree with VarBench's own AFQMC exact rows to 1.3 sigma, and the 8 x 8, 10 x 10 and 12 x 12 PBC U = 8 values with the AFQMC references quoted by arXiv:2507.02644 (Table S1) to the printed digits.` });
}
console.log(`batch A: ${added} exact rows (${created} new instances)`);

// ---------------------------------------------------------------------------------------
// Batch B: the square-lattice spin-1/2 Heisenberg antiferromagnet from Sandvik, "High-
// precision ground state parameters of the two-dimensional spin-1/2 Heisenberg model on
// the square lattice", arXiv:2601.20189 (2026), Tables 1-3. Stochastic series expansion
// QMC on a bipartite lattice, sign-free, T -> 0 converged (beta/L = 32 and 64), relative
// statistical errors below 1e-7. Read from the arXiv HTML, one value per table cell.
//
// Units: Table 1 gives e0 = E/N per spin in the S.S convention. Tables 2 and 3 give the
// energy per interaction BOND, N_b = 2(L^2 - L) for open L x L and 2 L^2 - L for the
// L x 2L cylinder, printed without its sign; E/N = -(E0/N_b) N_b / N. Checked: the L = 6
// PBC and OBC values reproduce the exact-diagonalization rows on square_36_P and
// square_36_O to 1.6e-8 and 3.3e-7, and L = 10 and 16 OBC reproduce the two rows QMBL
// already quoted from this paper via arXiv:2605.13807 to the printed digits. Those two
// instances (square_100_O, square_256_O) are skipped here rather than carrying the same
// number twice.
const SANDVIK = { ref: "Sandvik, High-precision ground state parameters of the two-dimensional spin-1/2 Heisenberg model on the square lattice, arXiv:2601.20189 (2026)", pr: false };
const SSE = "SSE QMC (stochastic series expansion), T -> 0 converged at beta/L = 32 and 64";
const SSE_WHY = "sign-problem-free SSE QMC on a bipartite lattice, T -> 0 converged; numerically exact (RULES.md 4)";
const SSE_READ = "arXiv HTML parsed locally, one value per table cell; no LLM transcription";

const SANDVIK_TABLES = {
  // Table 1: L x L, periodic. e0 = E/N per spin.
  pbc: [
    [6, "-0.67887215(2)"], [8, "-0.67349005(2)"], [10, "-0.67155266(2)"], [12, "-0.67068192(2)"],
    [14, "-0.67023225(2)"], [16, "-0.66997660(2)"], [18, "-0.66982043(2)"], [20, "-0.66971967(2)"],
    [22, "-0.66965176(2)"], [24, "-0.66960434(2)"], [26, "-0.66957017(3)"], [28, "-0.66954496(3)"],
    [30, "-0.66952595(3)"], [32, "-0.66951133(3)"], [36, "-0.66949091(3)"], [40, "-0.66947776(3)"],
    [44, "-0.66946889(3)"], [48, "-0.66946274(3)"], [52, "-0.66945833(3)"], [56, "-0.66945502(3)"],
    [60, "-0.66945260(3)"], [64, "-0.66945072(3)"], [72, "-0.66944815(3)"], [80, "-0.66944645(3)"],
    [88, "-0.66944530(3)"], [96, "-0.66944454(3)"],
  ],
  // Table 2: L x L, open. E0/N_b with N_b = 2(L^2 - L), magnitude.
  obc: [
    [6, "0.3621133(1)"], [8, "0.3537355(1)"], [10, "0.3492534(1)"], [12, "0.3464731(1)"],
    [14, "0.3445836(1)"], [16, "0.3432169(1)"], [18, "0.3421827(2)"], [20, "0.3413732(2)"],
    [22, "0.3407218(2)"], [24, "0.3401870(2)"], [26, "0.3397397(2)"], [28, "0.3393603(2)"],
    [32, "0.3387504(2)"], [48, "0.3373629(2)"], [64, "0.3366865(2)"], [96, "0.33602096(8)"],
    [128, "0.33569204(9)"],
  ],
  // Table 3: L x 2L, periodic along L, open along 2L. E0/N_b with N_b = 2 L^2 - L, magnitude.
  cyl: [
    [4, "0.3532363(2)"], [6, "0.3427879(2)"], [8, "0.3397983(2)"], [10, "0.3384370(2)"],
    [12, "0.3376621(2)"], [14, "0.3371612(2)"], [16, "0.3368096(2)"], [18, "0.3365491(2)"],
    [20, "0.3363476(2)"], [24, "0.3360555(3)"], [32, "0.3357061(3)"], [48, "0.3353698(3)"],
    [64, "0.3352053(2)"],
  ],
};

const before = [added, created];
for (const [L, printed] of SANDVIK_TABLES.pbc) {
  const N = L * L, [e, s] = parse(printed);
  put(`Heisenberg/square_${N}_P`,
    { model: "Heisenberg", lattice: "square", n_sites: N, boundary: "P", params: {}, dof: N, einf: 0 },
    { energy: +(4 * N * e).toPrecision(12), sigma: +(4 * N * s).toPrecision(3), src: SANDVIK, method: SSE, why: SSE_WHY, read: SSE_READ,
      reported: `e0 = ${printed} per spin (S.S), L = ${L}, periodic`,
      note: `Table 1, "Results for different system sizes computed at inverse temperature beta/L = 64 for L > 30 and averaged over beta/L = 32 and beta/L = 64 simulations for L <= 30", column e0, row L = ${L}. Pauli total = 4 N e0. The L = 6 value agrees with the exact-diagonalization row on square_36_P to 1.6e-8.` });
}
for (const [L, printed] of SANDVIK_TABLES.obc) {
  const N = L * L, Nb = 2 * (N - L), [v, s] = parse(printed);
  if (N === 100 || N === 256) continue;   // already carried, quoted from this paper via arXiv:2605.13807
  put(`Heisenberg/square_${N}_O`,
    { model: "Heisenberg", lattice: "square", n_sites: N, boundary: "O", params: {}, dof: N, einf: 0 },
    { energy: +(-4 * Nb * v).toPrecision(12), sigma: +(4 * Nb * s).toPrecision(3), src: SANDVIK, method: SSE, why: SSE_WHY, read: SSE_READ,
      reported: `E0/N_b = ${printed} (magnitude, per bond, N_b = ${Nb}), L = ${L}, open`,
      note: `Table 2, "SSE data for L x L systems with open boundary conditions. The ground state energy is normalized by the number of interaction bonds N_b = 2(L^2 - L)", row L = ${L}. Printed as a magnitude; E/N = -(E0/N_b) N_b / N = ${(-v * Nb / N).toFixed(8)} in S.S units, Pauli total = 4 N E/N. The L = 6 value agrees with the exact-diagonalization row on square_36_O to 3.3e-7 (2 sigma), and L = 10 and 16 reproduce the rows QMBL already quotes from this paper via arXiv:2605.13807.` });
}
for (const [L, printed] of SANDVIK_TABLES.cyl) {
  const N = 2 * L * L, Nb = 2 * L * L - L, [v, s] = parse(printed);
  put(`Heisenberg/rectangular-${L}x${2 * L}_${N}_PO`,
    { model: "Heisenberg", lattice: `rectangular-${L}x${2 * L}`, n_sites: N, boundary: "PO", params: {}, dof: N, einf: 0 },
    { energy: +(-4 * Nb * v).toPrecision(12), sigma: +(4 * Nb * s).toPrecision(3), src: SANDVIK, method: SSE, why: SSE_WHY, read: SSE_READ,
      reported: `E0/N_b = ${printed} (magnitude, per bond, N_b = ${Nb}), L x 2L = ${L} x ${2 * L}, cylinder`,
      note: `Table 3, "SSE data for L x 2L lattices with cylindrical boundary conditions (periodic in the shorter direction and open in the longer direction). The ground state energy is normalized by the number of interaction bonds N_b = 2 L^2 - L", row L = ${L}. Boundary PO (VarBench lattice.md): periodic along the ${L}-site direction, open along the ${2 * L}-site one. Printed as a magnitude; E/N = -(E0/N_b) N_b / N = ${(-v * Nb / N).toFixed(8)} in S.S units, Pauli total = 4 N E/N.` });
}
console.log(`batch B: ${added - before[0]} exact rows (${created - before[1]} new instances)`);

console.log(`added ${added} exact rows (${created} new instances)`);
