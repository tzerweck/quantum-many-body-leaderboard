// Rows from the 2026-09-14 table sweep (scripts/harvest_tables.mjs + match_tables.mjs).
//
// All of these came out of BENCHMARK COMPARISON TABLES - the table a paper prints of
// everyone else's numbers next to its own. That is a source VarBench never mined, and
// it is why several of these are 2019-2023 results that have been beating a VarBench
// record since before VarBench froze. The claim-sentence sweep of 2026-09-13 could not
// see them: no one writes "state of the art" about a number they are citing.
//
// Read from the arXiv HTML of the citing paper, never LLM-transcribed. A number quoted
// from a different paper than the one that produced it is `secondary` and names both
// (RULES.md 8); the citing paper's own results are `primary`.
import fs from "node:fs";

const CHECKED = "2026-09-14";

// --- the papers the numbers were READ from ------------------------------------
const MOSS_TRI = { ref: "Moss, Wiersema, Hibat-Allah, Carrasquilla & Melko, arXiv:2505.20406v3 (2025-10-13)", pr: false };
const MOSS_SQ  = { ref: "Moss, Wiersema, Hibat-Allah, Carrasquilla & Melko, Phys. Rev. B (2025), arXiv:2502.17144", pr: true };
const MINGRU   = { ref: "Parallel Scan Recurrent Neural Quantum States, arXiv:2605.13807", pr: false };

// --- the papers the numbers CAME from -----------------------------------------
const P = {
  gcnn21:  "Roth & MacDonald, Group Convolutional Neural Networks Improve Quantum State Accuracy, arXiv:2104.05085 (2021)",
  lcn22:   "Fu, Zhang, Zhang, Ling, Xu & Ji, Lattice Convolutional Networks for Learning Ground States of Quantum Many-Body Systems, arXiv:2206.07370 (2022)",
  gcnn23:  "Roth, Szabo & MacDonald, High-accuracy variational Monte Carlo for frustrated magnets with deep neural networks, arXiv:2211.07749 (2023)",
  lanczos: "Chen, Hendry, Weinberg & Feiguin, Systematic improvement of neural network quantum states using a Lanczos recursion, arXiv:2206.14307 (2022)",
  minsr:   "Chen & Heyl, Empowering deep neural quantum states through efficient optimization, Nat. Phys. 20, 1476 (2024), arXiv:2302.01941",
  choo19:  "Choo, Neupert & Carleo, Two-dimensional frustrated J1-J2 model studied with neural network quantum states, Phys. Rev. B 100, 125124 (2019)",
  sharir:  "Sharir, Levine, Wies, Carleo & Shashua, Deep Autoregressive Models for the Efficient Variational Simulation of Many-Body Quantum Systems, Phys. Rev. Lett. 124, 020503 (2020)",
  rnn22:   "Hibat-Allah, Melko & Carrasquilla, Supplementing Recurrent Neural Network Wave Functions with Symmetry and Annealing to Improve Accuracy, arXiv:2207.14314 (2024)",
  peps17:  "Liu, Dong, Han, Guo & He, Gradient optimization of finite projected entangled pair states, Phys. Rev. B 95, 195154 (2017)",
  sandvik: "Sandvik, High-precision ground state parameters of the two-dimensional spin-1/2 Heisenberg model on the square lattice, arXiv:2601.20189 (2026)",
};

const T5_TRI = "Read from Table 5 of arXiv:2505.20406 (TLAHM, L=6 triangular lattice, PBC, E/N in S.S units), parsed from the arXiv HTML.";
const T5_SQ  = "Read from Table 5 of arXiv:2502.17144 (SLAHM, E/N in S.S units), parsed from the arXiv HTML.";
const T2_SQ  = "Read from Table 2 of arXiv:2605.13807 (2D Heisenberg, square lattice, OBC, E/N in S.S units), parsed from the arXiv HTML.";

const ADD = {
  // ---- triangular 6x6 PBC. Record was DMRG chi=2048 at -0.5581022; three published
  // NQS results have been below it since 2021-2023 and VarBench never collected them.
  "Heisenberg/triangular_36_P": { rows: [
    { eps: -0.560313, err: 3e-6, m: "Group CNN (deep, symmetry-projected)", bt: "variational",
      src: MOSS_TRI, primary: P.gcnn23,
      note: T5_TRI + ' Row "Group Convolutional Neural Network [32]" = arXiv:2211.07749. Sits 6.0e-5 ABOVE the exact -0.5603734 already on this instance, as a variational bound must.' },
    { eps: -0.5601, err: 4e-4, m: "Lattice Convolutional Network", bt: "variational",
      src: MOSS_TRI, primary: P.lcn22, note: T5_TRI + ' Row "Lattice Convolutional Network [49]" = arXiv:2206.07370.' },
    { eps: -0.55922, err: null, m: "Group CNN", bt: "variational",
      src: MOSS_TRI, primary: P.gcnn21,
      note: T5_TRI + ' Row "Group Convolutional Neural Network [104]" = arXiv:2104.05085. No error bar is given in the table, so under RULES.md 6 this sampled row cannot hold a record.' },
    { eps: -0.5562, err: 2e-4, m: "2D RNN wavefunction (iterative retraining, s=4.0, r=0.158)", bt: "variational",
      src: MOSS_TRI, primary: null, note: T5_TRI + " The citing paper's own result." },
  ]},

  // ---- square 6x6 PBC. Exact -0.6788721 is already on the instance; the record was
  // DMRG chi=2048 at -0.6786224, which three NQS results beat.
  "Heisenberg/square_36_P": { rows: [
    { eps: -0.678868, err: 2e-6, m: "RBM + Lanczos recursion", bt: "variational",
      src: MOSS_SQ, primary: P.lanczos, note: T5_SQ + ' Row "RBM+Lanczos [40]" = arXiv:2206.14307.' },
    { eps: -0.67887, err: 2e-5, m: "2D RNN wavefunction (best variational)", bt: "variational",
      src: MOSS_SQ, primary: null, note: T5_SQ + ' Row "This work (best RNN)".' },
    { eps: -0.67882, err: 1e-5, m: "CNN", bt: "variational",
      src: MOSS_SQ, primary: P.choo19, note: T5_SQ + ' Row "CNN [33]" = Phys. Rev. B 100, 125124 (2019).' },
    { eps: -0.67887177, err: 7e-8, m: "2D RNN wavefunction, zero-variance extrapolation", bt: "extrapolated",
      src: MOSS_SQ, primary: null,
      note: T5_SQ + ' Row "This work (zero-variance)". The paper states in the Table 3 caption that these extrapolated values can fall below the reference energies and that this is "an artifact of the zero-variance extrapolation" - not an achieved energy, so NOT a bound (RULES.md 4).' },
  ]},

  // ---- square 10x10 PBC. Record was an alpha=1-era RNN at -0.6714; the field moved
  // 1.5e-4 below that by 2022 and 2.5e-4 by 2024.
  "Heisenberg/square_100_P": { rows: [
    { eps: -0.67155260, err: 3e-8, m: "CNN + MinSR", bt: "variational",
      src: MOSS_SQ, primary: P.minsr, note: T5_SQ + ' Row "VMC - CNN+MinSR [12]" = Chen & Heyl, Nat. Phys. 20, 1476 (2024).' },
    { eps: -0.671519, err: 4e-6, m: "RBM + Lanczos recursion", bt: "variational",
      src: MOSS_SQ, primary: P.lanczos, note: T5_SQ + ' Row "RBM+Lanczos [40]" = arXiv:2206.14307.' },
    { eps: -0.67151, err: 2e-5, m: "2D RNN wavefunction (best variational)", bt: "variational",
      src: MOSS_SQ, primary: null, note: T5_SQ + ' Row "This work (best RNN)".' },
    { eps: -0.67135, err: null, m: "CNN", bt: "variational",
      src: MOSS_SQ, primary: P.choo19, note: T5_SQ + ' Row "CNN [33]" = Phys. Rev. B 100, 125124 (2019). No error bar given.' },
    { eps: -0.6715950, err: 5e-7, m: "2D RNN wavefunction, zero-variance extrapolation", bt: "extrapolated",
      src: MOSS_SQ, primary: null, note: T5_SQ + " Zero-variance extrapolation, not an achieved energy (RULES.md 4)." },
  ]},

  // ---- square 10x10 OBC. Record was -0.6286487; four methods sit below it, and
  // Sandvik's 2026 QMC gives this instance its first numerically exact reference.
  "Heisenberg/square_100_O": { rows: [
    { eps: -0.6286561, err: 2e-7, m: "QMC (stochastic series expansion)", bt: "exact",
      src: MINGRU, primary: P.sandvik,
      note: T2_SQ + ' Column "QMC [49]" = arXiv:2601.20189. The square-lattice Heisenberg AFM is bipartite and sign-problem-free, so SSE QMC is numerically exact here (RULES.md 4).' },
    { eps: -0.628656, err: 9e-6, m: "2D tensorized RNN (symmetry + annealing)", bt: "variational",
      src: MINGRU, primary: P.rnn22,
      note: T2_SQ + ' Column "2D TRNN [40]". The same value appears in arXiv:2502.17144 Table 5 as "This work (best RNN)", OBC 10x10. It sits 1e-7 below the QMC reference, well inside its own 9e-6 error bar.' },
    { eps: -0.628637, err: 4e-6, m: "2D minGRU (3 layers, c4v symmetry, parallel scan)", bt: "variational",
      src: MINGRU, primary: null, note: T2_SQ + ' Column "2D minGRU (ours)".' },
    { eps: -0.628627, err: 1e-6, m: "PixelCNN (deep autoregressive)", bt: "variational",
      src: MINGRU, primary: P.sharir, note: T2_SQ + ' Column "PixelCNN [52]" = Phys. Rev. Lett. 124, 020503 (2020).' },
    { eps: -0.628601, err: 2e-6, m: "Finite PEPS, gradient optimization", bt: "variational",
      src: MINGRU, primary: P.peps17,
      note: T2_SQ + ' Column "PEPS [33]" = Phys. Rev. B 95, 195154 (2017). Finite PEPS on the 10x10 lattice, not an infinite-lattice value.' },
  ]},

  // ---- square 16x16 OBC: a new instance. Four methods plus an exact reference, all
  // from one table, and no VarBench instance existed for this size.
  "Heisenberg/square_256_O": {
    create: { model: "Heisenberg", lattice: "square", n_sites: 256, boundary: "O", params: {}, dof: 256, einf: 0 },
    rows: [
      { eps: -0.6435317, err: 2e-7, m: "QMC (stochastic series expansion)", bt: "exact",
        src: MINGRU, primary: P.sandvik, note: T2_SQ + ' Column "QMC [49]" = arXiv:2601.20189.' },
      { eps: -0.643504, err: 3e-6, m: "2D minGRU (3 layers, c4v symmetry, parallel scan)", bt: "variational",
        src: MINGRU, primary: null, note: T2_SQ + " The citing paper's own result; 29 GPU-days on a single L40S." },
      { eps: -0.643448, err: 1e-6, m: "PixelCNN (deep autoregressive)", bt: "variational",
        src: MINGRU, primary: P.sharir, note: T2_SQ + ' Column "PixelCNN [52]".' },
      { eps: -0.643391, err: 3e-6, m: "Finite PEPS, gradient optimization", bt: "variational",
        src: MINGRU, primary: P.peps17, note: T2_SQ + ' Column "PEPS [33]".' },
    ]},
};

let added = 0, created = 0;
for (const [id, spec] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  const exists = fs.existsSync(p);
  const inst = exists ? JSON.parse(fs.readFileSync(p, "utf8"))
    : { ...spec.create, instance_id: id, rows: [] };
  if (!exists) { delete inst.dof; delete inst.einf; created++; }
  const r0 = inst.rows[0];
  const dof = r0 ? r0.dof : spec.create.dof;
  const einf = r0 ? r0.einf : spec.create.einf;
  const f = 4 * inst.n_sites;                       // spin models: Pauli totals

  for (const r of spec.rows) {
    inst.rows.push({
      energy: +(r.eps * f).toPrecision(12),
      sigma: r.err == null ? null : +(r.err * f).toPrecision(6),
      energy_variance: null, dof, einf, v_score: null,
      method: r.m,
      bound_type: r.bt,
      bound_type_reason: "assigned during source verification (RULES.md 4)",
      reference: r.primary ?? r.src.ref,
      peer_reviewed: r.primary ? null : r.src.pr,
      source: "sweep-tables-2026-09-14",
      provenance: r.primary ? "secondary" : "primary",
      verified: {
        checked_on: CHECKED,
        method: "arXiv HTML parsed locally from a benchmark comparison table, no LLM transcription",
        reported_as: `${r.eps}${r.err != null ? ` (+/- ${r.err})` : ""} per site in S.S units`,
        note: r.note,
        secondary_of: r.primary ? r.src.ref : null,
      },
    });
    added++;
  }
  fs.mkdirSync(`data/${id.split("/")[0]}`, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} rows from comparison tables (${created} new instance)`);
