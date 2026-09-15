// Exactly solved instances: benchmarks whose ground-state energy is known to within a
// stated error, so that a paper reporting on them can be scored by its distance from the
// answer rather than ranked against other papers. Most of these instances have no
// variational row at all yet; that is the point of carrying them.
//
// Batch A (2026-09-15): the half-filled square-lattice Hubbard model from Qin, Shi &
// Zhang, "Benchmark study of the two-dimensional Hubbard model with auxiliary-field
// quantum Monte Carlo method", Phys. Rev. B 94, 085103 (2016), arXiv:1605.09421, Table IV.
// At half filling on a bipartite lattice AFQMC has no sign problem and the paper states
// the results are numerically exact; the Trotter step (tau = 0.01) was verified to keep
// that error below the statistical one. 7 sizes x 4 values of U x 2 boundary conditions =
// 56 energies, each with its error bar. Read from the PDF in layout mode and parsed by
// column position (E rows only; the P and K rows of the same table are not carried).
//
// Boundary codes follow VarBench lattice.md: P = periodic in both directions, PA =
// periodic in x and antiperiodic in y. The paper's "PBC-APBC" is the latter; on an L x L
// lattice the two orientations are equivalent. Energies are totals, stored as-is.
import fs from "node:fs";

const CHECKED = "2026-09-15";
const QIN = { ref: "Qin, Shi & Zhang, Benchmark study of the two-dimensional Hubbard model with auxiliary-field quantum Monte Carlo method, Phys. Rev. B 94, 085103 (2016), arXiv:1605.09421", pr: true };
const METHOD = "AFQMC, sign-problem-free at half filling (tau = 0.01, Trotter error below the statistical error)";

// [L, U, boundary, E_total, sigma, as printed]. Same order as the table: within a size,
// U = 2, 4, 6, 8, each as PBC then PBC-APBC.
const TABLE_IV = [
  [4, 2, "P", -18.024, 0.006, "-18.024(6)"], [4, 2, "PA", -20.114, 0.002, "-20.114(2)"],
  [4, 4, "P", -13.616, 0.006, "-13.616(6)"], [4, 4, "PA", -14.594, 0.003, "-14.594(3)"],
  [4, 6, "P", -10.541, 0.004, "-10.541(4)"], [4, 6, "PA", -10.902, 0.007, "-10.902(7)"],
  [4, 8, "P", -8.476, 0.009, "-8.476(9)"], [4, 8, "PA", -8.646, 0.008, "-8.646(8)"],
  [6, 2, "P", -41.457, 0.005, "-41.457(5)"], [6, 2, "PA", -43.499, 0.002, "-43.499(2)"],
  [6, 4, "P", -30.865, 0.009, "-30.865(9)"], [6, 4, "PA", -31.43, 0.02, "-31.43(2)"],
  [6, 6, "P", -23.74, 0.01, "-23.74(1)"], [6, 6, "PA", -23.84, 0.01, "-23.84(1)"],
  [6, 8, "P", -19.00, 0.02, "-19.00(2)"], [6, 8, "PA", -19.01, 0.01, "-19.01(1)"],
  [8, 2, "P", -74.470, 0.005, "-74.470(5)"], [8, 2, "PA", -76.308, 0.003, "-76.308(3)"],
  [8, 4, "P", -55.05, 0.01, "-55.05(1)"], [8, 4, "PA", -55.31, 0.01, "-55.31(1)"],
  [8, 6, "P", -42.16, 0.02, "-42.16(2)"], [8, 6, "PA", -42.17, 0.02, "-42.17(2)"],
  [8, 8, "P", -33.68, 0.03, "-33.68(3)"], [8, 8, "PA", -33.66, 0.02, "-33.66(2)"],
  [10, 2, "P", -116.908, 0.004, "-116.908(4)"], [10, 2, "PA", -118.505, 0.004, "-118.505(4)"],
  [10, 4, "P", -86.12, 0.04, "-86.12(4)"], [10, 4, "PA", -86.20, 0.02, "-86.20(2)"],
  [10, 6, "P", -65.80, 0.02, "-65.80(2)"], [10, 6, "PA", -65.76, 0.02, "-65.76(2)"],
  [10, 8, "P", -52.54, 0.03, "-52.54(3)"], [10, 8, "PA", -52.49, 0.02, "-52.49(2)"],
  [12, 2, "P", -168.749, 0.007, "-168.749(7)"], [12, 2, "PA", -170.112, 0.003, "-170.112(3)"],
  [12, 4, "P", -123.95, 0.02, "-123.95(2)"], [12, 4, "PA", -123.99, 0.03, "-123.99(3)"],
  [12, 6, "P", -94.66, 0.02, "-94.66(2)"], [12, 6, "PA", -94.67, 0.02, "-94.67(2)"],
  [12, 8, "P", -75.54, 0.02, "-75.54(2)"], [12, 8, "PA", -75.58, 0.03, "-75.58(3)"],
  [14, 2, "P", -229.981, 0.006, "-229.981(6)"], [14, 2, "PA", -231.134, 0.004, "-231.134(4)"],
  [14, 4, "P", -168.67, 0.02, "-168.67(2)"], [14, 4, "PA", -168.69, 0.03, "-168.69(3)"],
  [14, 6, "P", -128.76, 0.02, "-128.76(2)"], [14, 6, "PA", -128.78, 0.03, "-128.78(3)"],
  [14, 8, "P", -102.85, 0.03, "-102.85(3)"], [14, 8, "PA", -102.83, 0.04, "-102.83(4)"],
  [16, 2, "P", -300.596, 0.006, "-300.596(6)"], [16, 2, "PA", -301.562, 0.005, "-301.562(5)"],
  [16, 4, "P", -220.29, 0.04, "-220.29(4)"], [16, 4, "PA", -220.30, 0.04, "-220.30(4)"],
  [16, 6, "P", -168.19, 0.03, "-168.19(3)"], [16, 6, "PA", -168.21, 0.05, "-168.21(5)"],
  [16, 8, "P", -134.23, 0.03, "-134.23(3)"], [16, 8, "PA", -134.25, 0.03, "-134.25(3)"],
];

let added = 0, created = 0;
for (const [L, U, bc, E, sigma, printed] of TABLE_IV) {
  const N = L * L, Nf = N / 2;
  const id = `Hubbard/square_${N}_${bc}_${Nf}_${U}`;
  const p = `data/${id}.json`;
  const exists = fs.existsSync(p);
  const inst = exists ? JSON.parse(fs.readFileSync(p, "utf8"))
    : { model: "Hubbard", lattice: "square", n_sites: N, boundary: bc, params: { Nf, U }, instance_id: id, rows: [] };
  if (!exists) created++;
  // dof = N_up + N_dn, einf = U N_up N_dn / N (DATA.md); the same numbers the rest of the
  // instance carries, or the definition when there is no other row to copy from
  const dof = inst.rows[0]?.dof ?? 2 * Nf;
  const einf = inst.rows[0]?.einf ?? (U * Nf * Nf) / N;
  inst.rows.push({
    energy: E, sigma, energy_variance: null, dof, einf, v_score: null,
    method: METHOD, bound_type: "exact",
    bound_type_reason: "sign-problem-free AFQMC at half filling on a bipartite lattice; the paper states the results are numerically exact (RULES.md 4)",
    reference: QIN.ref, peer_reviewed: QIN.pr,
    source: "exact-2026-09-15", provenance: "primary",
    verified: {
      checked_on: CHECKED,
      method: "arXiv PDF extracted locally with pypdf in layout mode, E rows of Table IV parsed by column position; no LLM transcription",
      reported_as: `E = ${printed} (total), ${L} x ${L}, U = ${U}, ${bc === "P" ? "PBC" : "PBC-APBC"}`,
      note: `Table IV, "Total ground state energy (E) ... in the Hubbard model at half-filling, for U = 2, 4, 6, 8 ... for both PBC and PBC-APBC. Statistical errors are on the last digit." Row ${L} x ${L}, column U = ${U} ${bc === "P" ? "PBC" : "PBC-APBC"}. Half filling: N_up = N_dn = ${Nf}. Cross-checks: the 8 x 8 PBC values at U = 4 and 8 agree with VarBench's own AFQMC exact rows to 1.3 sigma, and the 8 x 8, 10 x 10 and 12 x 12 PBC U = 8 values with the AFQMC references quoted by arXiv:2507.02644 (Table S1) to the printed digits.`,
      secondary_of: null,
    },
  });
  added++;
  fs.mkdirSync("data/Hubbard", { recursive: true });
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} exact rows (${created} new instances)`);
