// Corrections to rows whose stored value disagrees with the source it cites, or whose source
// was misattributed (RULES.md 11). Applied by apply_corrections.mjs.
//
// The vendored VarBench snapshot is never edited, and a row QMBL added itself is fixed in its
// input file instead. Every correction here keeps the value it replaces on the row, in
// `corrections[].from`. A row that is suspect for reasons the source does not settle is
// flagged in defects.mjs and keeps its value.
//
// match: instance as it stands after relabels.mjs, the published method string, and the
//        energy within 1e-9, all against the values BEFORE any correction applies.
// field: energy | sigma | energy_variance | dof | einf | method | bound_type | reference |
//        peer_reviewed | provenance | baseline | defect (defect only to null)
// to:    the corrected value in the STORED convention (RULES.md 5); `conversion` shows the arithmetic.
// source_entry: the verification proposal and ruling behind the entry.
export const CORRECTIONS = [
  // qmbl-verify 2026-09-17, ruling 3a: the 4x4 exact diagonalizations cite the paper they
  // come from, not a run script that computes a different U.
  {
    "match": {
      "instance": "Hubbard/square_16_P_4_3.59381366",
      "method": "Exact diagonalization",
      "energy": -17.698030018702067
    },
    "field": "reference",
    "to": "[paper](https://www.pnas.org/doi/full/10.1073/pnas.2122059119)",
    "reported_as": "ED -17.6980300(1)",
    "location": "SI Table I, row U = 3.6, ED column",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "The linked lattice-symmetries script passes the U in VarBench's instance name and cannot have produced this energy, which is the ground state at the grid U (checks/hubbard-u-labels/). The number was uploaded by Robledo Moreno on 2022-08-23 as \"Lanczos (Quspin + Scipy)\"; the script link was attached on 2024-07-23 (VarBench 3604bb4). It is printed in the paper that produced it, which the row now cites (ruling 2026-09-17, Tristan).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_4_3.59381366",
      "method": "Exact diagonalization",
      "energy": -17.698030018702067
    },
    "field": "baseline",
    "to": false,
    "reported_as": "ED -17.6980300(1)",
    "location": "SI Table I, row U = 3.6, ED column",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "Collected from the authors' paper, not computed by VarBench: see the reference correction on this row (RULES.md 8.2).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_4_7.74263683",
      "method": "Exact diagonalization",
      "energy": -16.509154825265142
    },
    "field": "reference",
    "to": "[paper](https://www.pnas.org/doi/full/10.1073/pnas.2122059119)",
    "reported_as": "ED -16.5091548(2)",
    "location": "SI Table I, row U = 7.75, ED column",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "The linked lattice-symmetries script passes the U in VarBench's instance name and cannot have produced this energy, which is the ground state at the grid U (checks/hubbard-u-labels/). The number was uploaded by Robledo Moreno on 2022-08-23 as \"Lanczos (Quspin + Scipy)\"; the script link was attached on 2024-07-23 (VarBench 3604bb4). It is printed in the paper that produced it, which the row now cites (ruling 2026-09-17, Tristan).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_4_7.74263683",
      "method": "Exact diagonalization",
      "energy": -16.509154825265142
    },
    "field": "baseline",
    "to": false,
    "reported_as": "ED -16.5091548(2)",
    "location": "SI Table I, row U = 7.75, ED column",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "Collected from the authors' paper, not computed by VarBench: see the reference correction on this row (RULES.md 8.2).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_5_2.15443469",
      "method": "Exact diagonalization",
      "energy": -21.21223577699911
    },
    "field": "reference",
    "to": "[paper](https://www.pnas.org/doi/full/10.1073/pnas.2122059119)",
    "reported_as": "ED -21.2122357(7)",
    "location": "SI Table III, row ED, column U = 2.15",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "The linked lattice-symmetries script passes the U in VarBench's instance name and cannot have produced this energy, which is the ground state at the grid U (checks/hubbard-u-labels/). The number was uploaded by Robledo Moreno on 2022-08-23 as \"Lanczos (Quspin + Scipy)\"; the script link was attached on 2024-07-23 (VarBench 3604bb4). It is printed in the paper that produced it, which the row now cites (ruling 2026-09-17, Tristan).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_5_2.15443469",
      "method": "Exact diagonalization",
      "energy": -21.21223577699911
    },
    "field": "baseline",
    "to": false,
    "reported_as": "ED -21.2122357(7)",
    "location": "SI Table III, row ED, column U = 2.15",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "Collected from the authors' paper, not computed by VarBench: see the reference correction on this row (RULES.md 8.2).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_5_3.59381366",
      "method": "Exact diagonalization",
      "energy": -19.891637199948672
    },
    "field": "reference",
    "to": "[paper](https://www.pnas.org/doi/full/10.1073/pnas.2122059119)",
    "reported_as": "ED -19.8916371(9)",
    "location": "SI Table III, row ED, column U = 3.6",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "The linked lattice-symmetries script passes the U in VarBench's instance name and cannot have produced this energy, which is the ground state at the grid U (checks/hubbard-u-labels/). The number was uploaded by Robledo Moreno on 2022-08-23 as \"Lanczos (Quspin + Scipy)\"; the script link was attached on 2024-07-23 (VarBench 3604bb4). It is printed in the paper that produced it, which the row now cites (ruling 2026-09-17, Tristan).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_5_3.59381366",
      "method": "Exact diagonalization",
      "energy": -19.891637199948672
    },
    "field": "baseline",
    "to": false,
    "reported_as": "ED -19.8916371(9)",
    "location": "SI Table III, row ED, column U = 3.6",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "Collected from the authors' paper, not computed by VarBench: see the reference correction on this row (RULES.md 8.2).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_5_7.74263683",
      "method": "Exact diagonalization",
      "energy": -17.60373155517909
    },
    "field": "reference",
    "to": "[paper](https://www.pnas.org/doi/full/10.1073/pnas.2122059119)",
    "reported_as": "ED -17.6037315(5)",
    "location": "SI Table III, row ED, column U = 7.75",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "The linked lattice-symmetries script passes the U in VarBench's instance name and cannot have produced this energy, which is the ground state at the grid U (checks/hubbard-u-labels/). The number was uploaded by Robledo Moreno on 2022-08-23 as \"Lanczos (Quspin + Scipy)\"; the script link was attached on 2024-07-23 (VarBench 3604bb4). It is printed in the paper that produced it, which the row now cites (ruling 2026-09-17, Tristan).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Hubbard/square_16_P_5_7.74263683",
      "method": "Exact diagonalization",
      "energy": -17.60373155517909
    },
    "field": "baseline",
    "to": false,
    "reported_as": "ED -17.6037315(5)",
    "location": "SI Table III, row ED, column U = 7.75",
    "version_read": "arXiv:2111.10420v2 PDF, pypdf layout mode (Robledo Moreno et al., PNAS 119, e2122059119, 2022)",
    "conversion": "none",
    "checked_on": "2026-09-17",
    "reason": "Collected from the authors' paper, not computed by VarBench: see the reference correction on this row (RULES.md 8.2).",
    "source_entry": "RB1-varbench-code-hubbard#2, ruling 3a (qmbl-verify 2026-09-17)"
  },
  // qmbl-verify 2026-09-18 (RA1, second reading of A5), rulings 1a-3a (Tristan, 2026-09-19): the six
  // `QMC (continuous-time expansion)` t-V rows are VarBench's own ground-state projector LCT-INT runs
  // (Qi Yang, VarBench 75839cf, 2022-12-01; inputs and outputs in varbench/methods since 3edb6a9),
  // not numbers from the cited PRB 93, 155117, which is the finite-temperature SSE honeycomb paper
  // and prints none of them. The h5 gives Sign = 1 exactly, Theta = 40 with a 4-wide measurement
  // window, a free-fermion trial state; E_VarBench = N <Energy> + d N V / 4 undoes the code's
  // V (n_i - 1/2)(n_j - 1/2) form. The "Energy Variance" cell holds N x the h5 error of the mean,
  // i.e. the sigma of the total energy. Per row: energy, the sigma (h5 at six figures where the
  // committed run is the table's; the table's cell where it is a sibling run), the h5 per-site
  // error, and how the stored total compares with the run and with ED or DMRG.
  ...[
    ["tV/chain_32_P_16_1", -15.946206847643403, 0.00101205, "0.0000316265616252196", "32 * (-0.7483189639888563) + 8 = -15.946206847643403, the stored total; ED -15.946847944277561 is 0.63 sigma below"],
    ["tV/chain_32_P_16_2", -12.32494350621494, 0.00505473, "0.0001579602347377329", "32 * (-0.8851544845692169) + 16 = -12.32494350621494, the stored total; ED -12.32869972364372 is 0.74 sigma below"],
    ["tV/chain_32_P_16_4", -7.48840482444892, 0.020543, "0.0006419694839270352", "32 * (-1.2340126507640288) + 32 = -7.48840482444892 (9e-16 from the stored total); ED -7.5021616707610725 is 0.67 sigma below"],
    ["tV/square_64_P_32_1", -29.48192676807227, 0.0230126, "0.0003595724232837266", "64 * (-0.9606551057511292) + 32 = -29.48192676807227, the stored total; DMRG (chi = 4096, unconverged) -29.38006427648373 is 0.10 above"],
    ["tV/square_64_P_32_2", -18.71359791545498, 0.0932, null, "the committed h5 is a sibling run, 64 * (-1.2910776412131288) + 64 = -18.6290 +- 0.0634, 0.75 combined sigma from the stored total; DMRG -18.6338 is 0.85 sigma above"],
    ["tV/square_64_P_32_4", -9.7906046108775, 0.166, null, "the committed h5 is a sibling run, 64 * (-2.1568324125473506) + 128 = -10.0373 +- 0.1194; DMRG -10.248601642408376 is 0.458 BELOW the stored total (2.76 sigma), see the row's flag"],
  ].flatMap(([instance, energy, sigma, err, how]) => {
    const match = { instance, method: "QMC (continuous-time expansion)", energy };
    const stem = instance.split("/")[1], N = stem.startsWith("chain") ? 32 : 64;
    const version_read = "varbench/methods 3edb6a9: scripts/tV/" + stem + "/lct_int.sh, lct_int_inputs/params.in, test.out.h5 (h5py); programs/SpinlesstV-LCT-INT src; arXiv:1501.00986v1 (PRB 91, 235151) and arXiv:1602.02095v2 (PRB 93, 155117) PDFs, pypdf layout mode; VarBench history 75839cf, 7fe0a8a, 2620f45";
    const source_entry = "RA1-tv-heisenberg (qmbl-verify 2026-09-18-null-kind), confirming A5 (2026-09-16); rulings 1a-3a, Tristan 2026-09-19";
    return [
      { match, field: "bound_type", to: "exact",
        reported_as: "h5 Sign/mean/value = 1, error 0, variance 0; params.in BETA = 40., WINDOWSIZE = 4.0, BCmodifier \"\"; PRB 91, 235151 Sec. IV.A: \"projection time Theta t = 40 and use ground state of the noninteracting H0 as the trial wave function\"",
        location: "varbench/methods scripts/tV/" + stem + "/lct_int_inputs/test.out.h5, group simulation/results; src/interaction_expansion.cpp (beta = \"total projection time\", measure() only for |tau - beta/2| < window/2)",
        version_read, conversion: how, checked_on: "2026-09-18",
        reason: "Sign-problem-free ground-state projector QMC (RULES.md 4): the average sign is exactly 1, the projection time 40 leaves 18 on each side of every measurement, and the energy is unbiased within its error bar, so exact (stochastic) with the sigma below. The 2026-09-16 objection that the rows sit above ED and DMRG is their statistical scatter: every chain row is within 0.75 sigma of ED.",
        source_entry },
      { match, field: "sigma", to: sigma,
        reported_as: err ? "h5 Energy/mean/error = " + err + " (per site); VarBench Energy Variance cell " + sigma.toExponential(2) : "VarBench Energy Variance cell " + sigma + " (the committed h5 is a sibling run, see conversion)",
        location: "VarBench 75839cf, Sigma column empty, Energy Variance column; " + (err ? "h5 group simulation/results/Energy" : "h5 of a different run"),
        version_read, conversion: err ? N + " * " + err + " = " + sigma + ", which rounds to the table's cell" : "the table's cell as stored, no finer source: " + how, checked_on: "2026-09-18",
        reason: "The value VarBench filed under Energy Variance is N times the per-site error of the mean of the Energy estimator, i.e. the standard error of the total energy, not Var(H); the code has no <H^2> estimator. An exact (stochastic) row must state its sigma (RULES.md 4, 9.4).",
        source_entry },
      { match, field: "energy_variance", to: null,
        reported_as: "VarBench Energy Variance cell " + sigma.toExponential(2), location: "VarBench 75839cf, Energy Variance column",
        version_read, conversion: "the cell is the sigma, see the sigma correction; v_score is recomputed and becomes null", checked_on: "2026-09-18",
        reason: "The cell is the error bar filed in the wrong column; LCT-INT measures no <H^2>, so there is no energy variance to store.",
        source_entry },
      { match, field: "reference", to: "[code](https://github.com/varbench/methods/blob/main/scripts/tV/" + stem + "/lct_int.sh)",
        reported_as: "PRB 93, 155117 abstract: \"map out the finite temperature phase diagram of the spinless t-V model on the honeycomb lattice\"; no chain, square, 32-site or 8x8 energy anywhere in its 7 pages; PRB 91, 235151's only 32-chain content is Fig. 2, a density-correlation figure",
        location: "arXiv:1602.02095v2 full text; arXiv:1501.00986v1 Sec. IV.A; varbench/methods README: \"code used for the paper ... Phys. Rev. B 91, 235151\"",
        version_read, conversion: "none", checked_on: "2026-09-18",
        reason: "The cited paper did not produce the number and its algorithm was not run; the number is VarBench's own run of the ground-state LCT-INT code, so the row cites the run script like every VarBench-computed row (RULES.md 8.2). The method paper is named in the method detail. Dian Wu attached the PRB 93 string 46 minutes after the upload (7fe0a8a) and made it the paper link in 2620f45.",
        source_entry },
      { match, field: "baseline", to: true,
        reported_as: "VarBench 75839cf (Qi Yang, 2022-12-01): \"update spinless tV model benchmark\", \"V(n-1/2)(n-1/2) to Vnn data\"; h5 parameters/filename = /public3/home/sch8031/SpinlesstV-LCT-INT/input/" + (N === 32 ? "L32V" : "L8W8V") + stem.split("_").at(-1) + ".dat",
        location: "VarBench history, tV/" + stem + ".md; varbench/methods scripts/tV/" + stem, version_read, conversion: "none", checked_on: "2026-09-18",
        reason: "Computed by VarBench, not collected (RULES.md 8.2): the uploader converted the code's shifted output to V n_i n_j herself, the inputs and outputs are in the methods repo, and four of the six reproduce the stored totals to 1e-15. The 2026-09-16 hold on baseline changes was about rows whose number could not be located; here the cited paper's content is known and the artefact exists (ruling 1a, Tristan 2026-09-19).",
        source_entry },
    ];
  }),
  // qmbl-verify 2026-09-18 (RA1, second reading of A6), rulings 4a and 5 (Tristan, 2026-09-19): the
  // imported `QMC` on the open 10x10 Heisenberg square is the ALPS loop algorithm at T = 1e-4 from the
  // paper it cites, exact (stochastic) with the printed bar; the energy keeps its unsourced seventh
  // digit (0.1 sigma), the printed value is on the row's verification.
  {
    "match": { "instance": "Heisenberg/square_100_O", "method": "QMC", "energy": -251.46248 },
    "field": "bound_type",
    "to": "exact",
    "reported_as": "\"we compare our results to energies from the quantum Monte Carlo loop algorithm of the ALPS library ... The presented values and errors correspond to temperature T = 10^-4, and they agree with the ones corresponding to T = 10^-3 within the error bars.\"",
    "location": "Appendix C, text above Table III",
    "version_read": "arXiv:1405.3259v2 PDF, pypdf layout mode (Lubasch, Cirac & Banuls, PRB 90, 064425, 2014); v1 checked for the digit",
    "conversion": "none (classification)",
    "checked_on": "2026-09-18",
    "reason": "Sign-problem-free loop QMC on the bipartite square lattice, taken to its own limit: T = 1e-4 on 100 spins, and the authors state agreement with T = 1e-3 within the error bars. Exact (stochastic) with the printed sigma (RULES.md 4; ruling 5, Tristan 2026-09-19). Sandvik's SSE row on this instance, -251.46244(8), is 0.05 sigma away and keeps the exact reference.",
    "source_entry": "RA1-tv-heisenberg (qmbl-verify 2026-09-18-null-kind), confirming A6 (2026-09-16); ruling 5, Tristan 2026-09-19"
  },
  {
    "match": { "instance": "Heisenberg/square_100_O", "method": "QMC", "energy": -251.46248 },
    "field": "sigma",
    "to": 0.0008,
    "reported_as": "-0.628656(2) (per site, S.S units)",
    "location": "Appendix C, Table III, column 10 x 10",
    "version_read": "arXiv:1405.3259v2 PDF, pypdf layout mode (Lubasch, Cirac & Banuls, PRB 90, 064425, 2014)",
    "conversion": "0.000002 * 100 * 4 = 0.0008 (Pauli totals, RULES.md 5)",
    "checked_on": "2026-09-18",
    "reason": "The source prints an error bar and the stored sigma is null; an exact (stochastic) row must carry one (RULES.md 9.4).",
    "source_entry": "RA1-tv-heisenberg (qmbl-verify 2026-09-18-null-kind), confirming A6 (2026-09-16)"
  },
];
