// J1-J2 rows from arXiv:2206.14307 (Chen, Hendry, Weinberg & Feiguin, "Systematic
// improvement of neural network quantum states using a Lanczos recursion").
//
// This paper has no arXiv HTML - it predates the HTML build - so it was invisible to
// every sweep so far and had to be fetched as a PDF (scripts/fetch_pdfs.mjs). It is
// also a 2022 paper, which means its J2 sweep has been beating VarBench records since
// two years before VarBench froze. The J2 != 0.5 column of the leaderboard was not
// "genuinely stale because the field moved on", as SWEEP.md guessed; it was never
// populated from the literature that already existed.
//
// Convention check before any row was written: the paper's own exact-diagonalization
// column at 6x6 agrees with the exact rows already on those instances to 6 significant
// digits at J2 = 0.4, 0.7, 0.8 and 1.0 (max deviation 4.3e-7). So its E/N is the same
// S.S per-site convention, its J2 labels mean the same thing, and its lattices are the
// same periodic clusters. Every 6x6 value below also sits ABOVE its instance's exact
// row, as the variational principle requires.
import fs from "node:fs";

const CHECKED = "2026-09-14";
const SRC  = { ref: "Chen, Hendry, Weinberg & Feiguin, Systematic improvement of neural network quantum states using a Lanczos recursion, arXiv:2206.14307 (2022)", pr: false };
const CHOO = "Choo, Neupert & Carleo, Two-dimensional frustrated J1-J2 model studied with neural network quantum states, Phys. Rev. B 100, 125124 (2019)";

const T2 = "Read from Table 2 of arXiv:2206.14307 (J1-J2 on the 6x6 square lattice, PBC, E/N in S.S units), extracted from the PDF with pypdf. p is the number of Lanczos steps.";
const T5 = "Read from Table 5 of arXiv:2206.14307 (J1-J2 on 6x6 and 10x10 square lattices, PBC, E/N in S.S units), extracted from the PDF with pypdf.";

// [eps, err, method, primary-ref-or-null, note]
const rbm  = (e, s, note) => [e, s, "RBM wave function", null, note];
const lanc = (e, s, p, note) => [e, s, `RBM wave function + ${p}-step Lanczos recursion`, null, note];
const cnn  = (e, s, note) => [e, s, "CNN", CHOO, note];

const ADD = {
  // ---- 6x6, Table 2: the p-step Lanczos series. RULES.md 4: a Lanczos step applied
  // to a variational state is a variational improvement, not a projection.
  "J1J2/square_36_P_0.5": [
    lanc(-0.50378, 4e-5, 2, T2), lanc(-0.50376, 3e-5, 1, T2),
    rbm(-0.50364, 2e-5, T2), cnn(-0.50185, 1e-5, T2),
  ],
  "J1J2/square_36_P_0.6": [
    lanc(-0.49318, 5e-5, 2, T2 + " New record for this instance; the exact row is -0.4932386, so it sits 5.9e-5 above the ground state."),
    lanc(-0.49313, 5e-5, 1, T2), rbm(-0.49298, 5e-5, T2), cnn(-0.49023, 1e-5, T2),
  ],
  // ---- 6x6, Table 5
  "J1J2/square_36_P_0.4": [rbm(-0.529687, 7e-6, T5), cnn(-0.52936, 1e-5, T5)],
  "J1J2/square_36_P_0.7": [rbm(-0.529921, 8e-6, T5)],
  "J1J2/square_36_P_0.8": [rbm(-0.586411, 9e-6, T5), cnn(-0.58590, 1e-5, T5)],
  "J1J2/square_36_P_1":   [rbm(-0.71429, 1e-5, T5), cnn(-0.71351, 1e-5, T5)],
  // ---- 10x10, Table 5. No exact reference exists at this size, so these rest on the
  // 6x6 convention check above.
  "J1J2/square_100_P_0.4": [rbm(-0.52388, 2e-5, T5), cnn(-0.52371, 1e-5, T5)],
  "J1J2/square_100_P_0.6": [rbm(-0.47662, 3e-5, T5), cnn(-0.47604, 1e-5, T5)],
  "J1J2/square_100_P_0.7": [rbm(-0.51889, 2e-5, T5)],
  "J1J2/square_100_P_0.8": [rbm(-0.57404, 2e-5, T5), cnn(-0.57383, 1e-5, T5)],
  "J1J2/square_100_P_1":   [rbm(-0.69670, 2e-5, T5), cnn(-0.69636, 1e-5, T5)],
};

let added = 0;
for (const [id, rows] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const { dof, einf } = inst.rows[0];
  const f = 4 * inst.n_sites;
  for (const [eps, err, method, primary, note] of rows) {
    inst.rows.push({
      energy: +(eps * f).toPrecision(12),
      sigma: err == null ? null : +(err * f).toPrecision(6),
      energy_variance: null, dof, einf, v_score: null,
      method, bound_type: "variational",
      bound_type_reason: "variational ansatz, or a Lanczos improvement of one (RULES.md 4)",
      reference: primary ?? SRC.ref,
      peer_reviewed: primary ? true : SRC.pr,
      source: "sweep-pdf-2026-09-14",
      provenance: primary ? "secondary" : "primary",
      verified: {
        checked_on: CHECKED,
        method: "arXiv PDF text extracted locally with pypdf, no LLM transcription",
        reported_as: `${eps} (+/- ${err}) per site in S.S units`,
        note, secondary_of: primary ? SRC.ref : null,
      },
    });
    added++;
  }
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} J1-J2 rows from the arXiv:2206.14307 PDF`);
