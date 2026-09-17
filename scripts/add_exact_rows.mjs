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
const SANDVIK = { ref: "Sandvik, High-precision ground state parameters of the two-dimensional spin-1/2 Heisenberg model on the square lattice, J. Stat. Mech. (2026) 043101, arXiv:2601.20189", pr: true };
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

// ---------------------------------------------------------------------------------------
// Batch C: exact diagonalization of frustrated clusters. Deterministic, so no sigma; the
// energies are exact to the printed digits.
//
// C1: the tilted 40-site square cluster of Richter & Schulenburg, "The spin-1/2 J1-J2
// Heisenberg antiferromagnet on the square lattice: Exact diagonalization for N = 40
// spins", Eur. Phys. J. B 73, 117 (2010), arXiv:0909.3723, Table 1: E_GS(S = 0) at 13
// values of J2/J1, periodic boundaries, H = J1 sum s.s + J2 sum s.s with J1 = 1 (S.S
// totals). J2 = 0 is the plain Heisenberg model on the same cluster. The cluster is the
// one of the paper's Fig. 1; its lattice vectors are not stated in the text.
//
// C2: kagome clusters of Lauchli, Sudan & Sorensen, "Ground-state energy and spin gap of
// spin-1/2 kagome Heisenberg antiferromagnetic clusters: large-scale exact diagonalization
// results", Phys. Rev. B 83, 212401 (2011), arXiv:1103.1159, Table I. A kagome cluster is
// identified by its basis vectors, not its size - the table lists four different 36-site
// clusters - so each instance names the paper's cluster label and carries the vectors.
// Only the even-N clusters are taken (the odd ones have S = 1/2 ground states, a different
// sector); 18b is already VarBench's kagome-2x3_18_P, whose exact row -8.048270773 / 18
// matches this table to all digits, and 12 = (2,0),(0,2) is written kagome-2x2 in the
// VarBench naming. The per-site column of the table reproduces E/N for every row, which
// is the column-alignment check.
const RS = { ref: "Richter & Schulenburg, The spin-1/2 J1-J2 Heisenberg antiferromagnet on the square lattice: Exact diagonalization for N = 40 spins, Eur. Phys. J. B 73, 117 (2010), arXiv:0909.3723", pr: true };
const LSS = { ref: "Lauchli, Sudan & Sorensen, Ground-state energy and spin gap of spin-1/2 kagome Heisenberg antiferromagnetic clusters: large-scale exact diagonalization results, Phys. Rev. B 83, 212401 (2011), arXiv:1103.1159", pr: true };
const ED = "Exact diagonalization (Lanczos)";
const ED_WHY = "exact diagonalization of the full cluster; deterministic, exact to the printed digits (RULES.md 4)";
const ED_READ = "arXiv PDF extracted locally with pypdf in layout mode, parsed by column position and checked against the paper's own per-site column; no LLM transcription";

// [J2, E_GS(S = 0) total, S.S]
const RS_TABLE_1 = [
  [0, "-27.09485025"], [0.1, "-25.46460260"], [0.2, "-23.90046918"], [0.3, "-22.42728643"],
  [0.4, "-21.08836670"], [0.5, "-19.96304839"], [0.55, "-19.51791526"], [0.6, "-19.18368038"],
  [0.65, "-20.04603255"], [0.7, "-21.05530239"], [0.8, "-23.34020427"], [0.9, "-25.83691287"],
  [1, "-28.43880892"],
];
// [cluster label, N, basis vector a, basis vector b, total E, S.S]
const LSS_TABLE_I = [
  ["12", 12, "(2,0)", "(0,2)", "-5.444875216"],
  ["24", 24, "(1,2)", "(-3,2)", "-10.589965547"],
  ["30", 30, "(2,1)", "(-2,4)", "-13.154318948"],
  ["36a", 36, "(-2,3)", "(4,0)", "-15.787874847"],
  ["36b", 36, "(3,0)", "(-3,4)", "-15.806927756"],
  ["36c", 36, "(3,0)", "(-1,4)", "-15.814334002"],
  ["36d", 36, "(4,-2)", "(-2,4)", "-15.781555118"],
  ["42a", 42, "(-1,3)", "(5,-1)", "-18.395959984"],
  ["42b", 42, "(-2,4)", "(4,-1)", "-18.401988921"],
];

const beforeC = [added, created];
for (const [J2, printed] of RS_TABLE_1) {
  const N = 40, E = +printed;
  const id = J2 === 0 ? "Heisenberg/square_40_P" : `J1J2/square_40_P_${J2}`;
  put(id,
    { model: J2 === 0 ? "Heisenberg" : "J1J2", lattice: "square", n_sites: N, boundary: "P", params: J2 === 0 ? {} : { J2 }, dof: N, einf: 0 },
    { energy: +(4 * E).toPrecision(12), sigma: null, src: RS, method: ED, why: ED_WHY, read: ED_READ,
      reported: `E_GS(S = 0) = ${printed} (total, S.S, J1 = 1), N = 40, J2 = ${J2}`,
      note: `Table 1, "Ground state energy E_GS(S = 0) ...", row J2 = ${J2}. The tilted 40-site square-lattice cluster of the paper's Fig. 1 with periodic boundaries (Sec. 2); E/N = ${(E / N).toFixed(7)} in S.S units, Pauli total = 4 E. ${J2 === 0 ? "J2 = 0 is the plain Heisenberg antiferromagnet on this cluster." : "The paper's J2 grid is 0, 0.1, ..., 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1.0."}` });
}
for (const [label, N, a, b, printed] of LSS_TABLE_I) {
  const E = +printed;
  const lattice = label === "12" ? "kagome-2x2" : `kagome-${label}`;
  put(`Heisenberg/${lattice}_${N}_P`,
    { model: "Heisenberg", lattice, n_sites: N, boundary: "P", params: {}, dof: N, einf: 0 },
    { energy: +(4 * E).toPrecision(12), sigma: null, src: LSS, method: ED, why: ED_WHY, read: ED_READ,
      reported: `Total E = ${printed} (S.S), cluster ${label}`,
      note: `Table I, "Cluster studied in this work", row N = ${label}: basis vectors a = ${a}, b = ${b} in units of the kagome lattice vectors a1, a2 (each of length 2a), periodic (torus). E/N = ${(E / N).toFixed(6)} as printed in the table's own E/N column; Pauli total = 4 E. ${label === "36d" ? "The 36d cluster (|a| = |b| = d = sqrt 12) is the standard 36-site kagome cluster with the full symmetry of the plane." : label === "12" ? "The (2,0),(0,2) cluster is 2 x 2 unit cells, kagome-2x2 in the VarBench naming." : ""}`.trim() });
}
console.log(`batch C: ${added - beforeC[0]} exact rows (${created - beforeC[1]} new instances)`);

console.log(`added ${added} exact rows (${created} new instances)`);
