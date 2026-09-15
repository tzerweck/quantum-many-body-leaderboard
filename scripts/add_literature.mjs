// 2025-26 literature rows. EVERY number below was read out of the source itself
// (arXiv HTML parsed locally, or PDF text extracted with pypdf) on 2026-09-10 --
// never transcribed by an LLM summariser, which was caught mangling table columns.
import fs from "node:fs";

const CHECKED = "2026-09-10";
const CH  = { ref: "Chen & Heyl, Nat. Phys. 20, 1476 (2024), arXiv:2302.01941", peer_reviewed: true };
const NUT = { ref: "Nutakki, Shokry & Vicentini, Phys. Rev. Research 7, 043099 (2025), arXiv:2505.03466", peer_reviewed: true };
const ACE = { ref: "Gu et al., arXiv:2604.25775 (2026-04-28)", peer_reviewed: false };
const TRF = { ref: "Gu et al., Nat. Commun. (2026), arXiv:2507.02644", peer_reviewed: true };
const RENDE = { ref: "Rende, Viteritti, Bardone, Becca & Goldt, A simple linear algebra identity to optimize large-scale neural network quantum states, Commun. Phys. 7, 260 (2024), arXiv:2310.05715", peer_reviewed: true };
const TBF = { ref: "Investigating the Fermi-Hubbard model by the tensor-backflow method, arXiv:2507.01856", peer_reviewed: false };
const LC  = { ref: "Loehr & Clark, arXiv:2510.26906 (2025-10-30)", peer_reviewed: false };

// spin: VarBench stores Pauli (sigma.sigma) totals; papers quote S.S per site  -> x 4 N
// Hubbard: VarBench stores totals; papers quote per site                       -> x N
const ADD = {
  "J1J2/square_100_P_0.5": { conv: "spin", rows: [
    { eps: -0.4976921, eps_err: 4e-7, method: "ResNet2 (64 conv layers, >1e6 params), MinSR", bt: "variational",
      src: CH, note: 'PDF text: "to attain the best variational energy E/N = -0.4976921(4)"' },
    { eps: -0.497715, eps_err: 9e-6, method: "ResNet2 MinSR, zero-variance extrapolation", bt: "extrapolated",
      src: CH, note: 'PDF text: "estimate the ground-state energy E_GS/N = -0.497715(9) by zero-variance extrapolation". NOT a variational bound.' },
    { eps: -0.497634, eps_err: 1e-6, method: "fViT (vision transformer, 2.7e5 params)", bt: "variational",
      src: RENDE, note: "Primary located 2026-09-15: Table I of arXiv:2310.05715, last row, Deep ViT, 267720 parameters, marked present work (read from the PDF in reading order). Also quoted as fViT [16] in Table 1 of arXiv:2505.03466, where this row was first found." },
    { eps: -0.497583, eps_err: 6e-6, method: "ConvNext (6,3,3)[2,2], 2.6e5 params", bt: "variational",
      src: NUT, note: "Table 1 of arXiv:2505.03466, their own result. Paper states L=10, PBC, S.S per site." },
  ]},
  "J1J2/square_256_P_0.5": { conv: "spin", create: { model:"J1J2", lattice:"square", n_sites:256, boundary:"P", params:{J2:0.5}, dof:256, einf:0 }, rows: [
    { eps: -0.4967163, eps_err: 8e-7, method: "ResNet2 (64 conv layers), MinSR", bt: "variational",
      src: CH, note: 'PDF text: "our approach yields the best variational energy E/N = -0.4967163(8) ... on such a large lattice" (16x16). No VarBench instance existed for this size.' },
  ]},
  "Hubbard/rectangular-4x16_64_P_28_8": { conv: "hubbard", rows: [
    { eps: -0.76647, eps_err: 2e-5, method: "ACE (16 conv layers) trial state + fixed-node GFMC", bt: "projected",
      src: ACE, note: 'Sec. III.3.1: "a GFMC calculation with the ACE trial wave-function gives an even lower energy of -0.76647(2)". Fixed-node: upper bound but node-dependent.' },
    { eps: -0.76623, eps_err: 1e-5, method: "ACE (16 conv layers) + full symmetry projection", bt: "variational",
      src: ACE, note: 'Sec. III.3.1: "reach a new state-of-the-art energy of -0.76623(1)".' },
    { eps: -0.76560, eps_err: 1e-5, method: "NNBF, 32 determinants + free projection to the fully symmetric state", bt: "variational",
      src: LC, note: 'Sec. III: "further projected at essentially no cost to the fully symmetric state to reach an energy of -0.76560(1)". This is the best 4x16 number in arXiv:2510.26906v1.' },
    { eps: -0.76486, eps_err: 2e-5, method: "NNBF, symmetry optimization with 32 determinants", bt: "variational", src: LC, note: "Same section, before the free projection." },
    { eps: -0.76464, eps_err: 1e-5, method: "ACE (16 conv layers), no explicit symmetry", bt: "variational",
      src: ACE, note: 'Sec. III.3.1: "achieves a ground-state energy of -0.76464(1)".' },
    { eps: -0.76298, eps_err: null, method: "Transformer backflow + MARCH optimizer", bt: "variational",
      src: TRF, note: 'Supp. Sec. 4.1: "our NQS yields a ground state energy of -0.76298" on 16x4 PBC. Instance identity confirmed: same passage quotes HFDS -0.753(2), matching the VarBench row -0.753000(47). No error bar given.' },
  ]},
  "Hubbard/square_256_P_112_8": { conv: "hubbard", rows: [
    { eps: -0.7583, eps_err: null, method: "ACE (16 conv layers) trial state + fixed-node GFMC", bt: "projected", src: ACE },
    { eps: -0.7573, eps_err: null, method: "ACE (16 conv layers), no symmetry projection", bt: "variational", src: ACE },
    { eps: -0.7563, eps_err: null, method: "Transformer backflow", bt: "variational", src: ACE, secondary: "ACE Table 1 row 'Transformer [13]' = arXiv:2507.02644" },
    { eps: -0.7560, eps_err: null, method: "SCALE (1 conv layer) trial state + fixed-node GFMC", bt: "projected", src: ACE },
    { eps: -0.7552, eps_err: null, method: "Tensor-Backflow + Lanczos", bt: "variational", src: TBF, note: "Primary located 2026-09-15: Table I of arXiv:2507.01856, n = 0.875, U = 8, 16x16 PBC, column Ep = 1 (one Lanczos step). First found quoted in Table 1 of arXiv:2604.25775 as Tensor-Backflow+Lanczos [21]." },
    { eps: -0.7529, eps_err: null, method: "SCALE (1 conv layer), no symmetry projection", bt: "variational", src: ACE },
    { eps: -0.7515, eps_err: 1e-4, method: "HFPS + symmetry projection", bt: "variational", src: ACE, secondary: "ACE Table 1 row 'HFPS+sym [31]'" },
    { eps: -0.7509, eps_err: null, method: "Tensor-Backflow", bt: "variational", src: TBF, note: "Primary located 2026-09-15: Table I of arXiv:2507.01856, n = 0.875, U = 8, 16x16 PBC, column Ep = 0. First found quoted in Table 1 of arXiv:2604.25775 as Tensor-Backflow [21]." },
  ]},
};

const ACE_TBL_NOTE = "Read directly from the Table 1 HTML of arXiv:2604.25775, column t'=0 PBC (16x16, U=8, delta=1/8). ACE Table 1 energies are WITHOUT symmetry projection (Sec. III.C.2), so they are not the ansatz floor.";
let added = 0;
for (const [id, spec] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  let inst;
  if (fs.existsSync(p)) inst = JSON.parse(fs.readFileSync(p, "utf8"));
  else { const c = spec.create; inst = { ...c, instance_id: id, rows: [] }; delete inst.dof; delete inst.einf; }
  const ref0 = inst.rows[0];
  const dof = ref0 ? ref0.dof : spec.create.dof;
  const einf = ref0 ? ref0.einf : spec.create.einf;
  const f = spec.conv === "spin" ? 4 * inst.n_sites : inst.n_sites;
  for (const r of spec.rows) {
    inst.rows.push({
      energy: +(r.eps * f).toPrecision(12), sigma: r.eps_err == null ? null : +(r.eps_err * f).toPrecision(6),
      energy_variance: null, dof, einf, v_score: null,
      method: r.method, bound_type: r.bt,
      bound_type_reason: "assigned from the source text during verification",
      reference: r.src.ref, peer_reviewed: r.src.peer_reviewed,
      source: "literature-2025-26", provenance: r.secondary ? "secondary" : "primary",
      verified: { checked_on: CHECKED, method: "source text/table parsed locally (arXiv HTML or pypdf), no LLM transcription",
                  reported_as: `${r.eps}${r.eps_err != null ? ` (+/- ${r.eps_err})` : ""} per site${spec.conv === "spin" ? " in S.S units" : ""}`,
                  note: r.note || (r.src === ACE ? ACE_TBL_NOTE : ""), secondary_of: r.secondary || null },
    });
    added++;
  }
  fs.mkdirSync(`data/${id.split("/")[0]}`, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} rows across ${Object.keys(ADD).length} instances`);
