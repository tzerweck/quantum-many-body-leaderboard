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
  // qmbl-verify 2026-09-19-flagged (deep-source pass on the flagged rows), rulings 2026-09-21:
  // DOF is VarBench's spin count and the two DMRG rows had a hand-typed 100 (VarBench c85080f),
  // so the value is corrected and the dof-mismatch flag lifted with it (RULES.md 10); the
  // 8x8 U = 8 AFQMC reference row cites the paper it was published in.
  {
    "match": {
      "instance": "Heisenberg/square_196_P",
      "method": "DMRG (bond dimension = 512)",
      "energy": -516.3911695223306
    },
    "field": "dof",
    "to": 196,
    "reported_as": "| -516.3911695223306 |        | 127.79517553787447 | 100 | 0    | DMRG (bond dimension = 512)           | [code](https://github.com/varbench/methods/blob/main/scripts/Heisenberg/square_196_P/dmrg.sh) |",
    "location": "vendor/varbench/Heisenberg/square_196_P.md row 2 (DMRG), DOF cell; sibling rows 1, 3, 4 carry 196",
    "version_read": "VarBench snapshot 390a21e (vendor/varbench) and full history (varbench-history: git show 107dd73, c85080f, abd23ae, 37648ad ... 390a21e); varbench/methods shallow clone ed31bb0; VarBench README.md; arXiv:2302.04919 text (sources/2302.04919.txt)",
    "conversion": "dof = number of spins = n_sites = 14 x 14 = 196 (script: --L 14, L2 = L). v_score recomputes as 196 * 127.79517553787447 / 516.3911695223306^2 = 0.09393185868978439 (stored 0.04792441769886959 equals 100 * Var / E^2 exactly; ratio 1.96).",
    "checked_on": "2026-09-19",
    "reason": "By VarBench's own definition DOF is the number of spins and is constant within a file. VarBench README.md (vendor/varbench/README.md, snapshot 390a21e): \"`DOF`: number of degrees of freedom. For spins and spinless fermions it is the number of particles, and for spinful fermions it is `Nup + Ndown`\" and \"Note that all rows in a same file always have the same `DOF` and `Einf`, but we replicate them in every row to simplify data analysis.\" VarBench paper arXiv:2302.04919 (sources/2302.04919.txt, dated Sept. 12, 2024), Eq. (1) and text: \"where N is the number of degrees of freedom, which is the number of spins for spin models\" and \"For unconstrained spin-1/2 Hilbert spaces, we define N to be equal to the number of lattice sites Ns.\" varbench-history: DOF column introduced in 107dd73 (Dian Wu, 2022-08-18, \"Add DOF to each data row\"), where Heisenberg/square_14_PP_196.md received DOF = 196 on every existing row. The DMRG row was inserted by c85080f (Dian Wu, 2022-09-03, \"Update DMRG baseline for Heisenberg\"), a hand-typed line (column alignment differs from the programmatically aligned siblings) with DOF = 100; the same commit replaced the square_10_PP_100.md DMRG row (bond dimension 80 -> 1024, DOF 100, correct there). The cell then passed unchanged through abd23ae (Add Einf, programmatic rewrite), 37648ad (rename to Heisenberg/square_196_P.md), 0ef1497, f88f9ba (code link), cd362c4, d186176, fdb4bfb, 5047bfd and 390a21e (snapshot). Never edited, never restored. Across all six VarBench folders the two flagged rows are the only rows whose DOF differs from their file siblings (survey of every DMRG row: DOF = site count for every spin-model DMRG row, e.g. J1J2/square_196_P_0.5 DMRG (bond dimension = 512) has DOF = 196). varbench-methods scripts/Heisenberg/square_196_P/dmrg.sh: `julia --project heisenberg_2d.jl --peri --L 14 --zero_mag --max_B 512 --seed 123`; programs/dmrg_itensors/heisenberg_2d.jl builds L x L2 with L2 = L = 14 (args.jl lines 78-79) = 196 sites, periodic in both directions (loops `1:L2-1+peri`, `1:L-1+peri`, mod1 wrapping), nearest-neighbour bonds only (J2 = J22 = 0 -> no diagonal terms), Pauli form (`J *= 4  # Spin to Pauli`, line 35), Sz_total = 0 sector (`--zero_mag`, conserve_qns), no Marshall sign, 50 sweeps, max bond dimension 512, cutoff 1e-12, noise 1e-3 -> 1e-12. The program prints `energy` (ITensors dmrg) and `energy_var = <H^2> - <H>^2` (lines 94, 102-104) and no parameter count or DOF; the methods repo (shallow clone ed31bb0) contains no output log, so the energy and variance could not be located independently (scope config). QMBL DATA.md: \"`dof` is the spin count for spin models\"; scripts/units.mjs expectedDof returns n_sites for spin models, so validate.mjs expects 196. Not a duplicate: no other row on Heisenberg/square_196_P carries this energy (data/Heisenberg/square_196_P.json, 7 rows read).",
    "source_entry": "FB2-varbench-code-heisenberg#0 (qmbl-verify 2026-09-19-flagged, ruling 2026-09-21: option a throughout)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_196_P",
      "method": "DMRG (bond dimension = 512)",
      "energy": -516.3911695223306
    },
    "field": "defect",
    "to": null,
    "reported_as": "n/a (flag lift)",
    "location": "scripts/defects.mjs lines 19-22",
    "version_read": "same sources as the dof correction",
    "conversion": "none",
    "checked_on": "2026-09-19",
    "reason": "The flag is confirmed, not wrong, and the sources settle the value: the 100 is a hand-typed transcription in VarBench c85080f (2022-09-03), copied from the 10x10 DMRG row updated in the same commit, and VarBench's definition fixes DOF = 196 for this file. Once the dof correction applies, the row no longer stores a mismatched dof and the finding text no longer describes it; RULES.md 10 lifts a flag by correcting `defect` to null so the lift stays on the row with `from`. Apply together with the dof correction (apply_corrections.mjs recomputes v_score from the corrected inputs: 0.09393185868978439). If the ruling is to keep the flag until VarBench fixes it upstream, the rewritten finding is: \"VarBench c85080f (Dian Wu, 2022-09-03) inserted this DMRG row by hand with DOF = 100 on a 196-spin file whose other rows carry 196; VarBench's README and paper define DOF as the number of spins. The stored v_score 0.0479 is 100 Var/E^2; with 196 it is 0.0939 (x1.96). VarBench's own plot_v_score.py reads DOF from the table column (collect.py line 169; its get_dof() that parses the file name is dead code), so its per-method point for this row is understated by the same factor; the instance-level V-score in the VarBench figure is unaffected because it takes the lowest-energy row (VMC with fermions, -523.983).\"",
    "source_entry": "FB2-varbench-code-heisenberg#1 (qmbl-verify 2026-09-19-flagged, ruling 2026-09-21: option a throughout)"
  },
  {
    "match": {
      "instance": "Heisenberg/triangular_144_P",
      "method": "DMRG (bond dimension = 512)",
      "energy": -299.46304457007847
    },
    "field": "dof",
    "to": 144,
    "reported_as": "| -299.46304457007847 |       | 100.89209006595773 | 100 | 0    | DMRG (bond dimension = 512)  | [code](https://github.com/varbench/methods/blob/main/scripts/Heisenberg/triangular_144_P/dmrg.sh) |",
    "location": "vendor/varbench/Heisenberg/triangular_144_P.md row 2 (DMRG), DOF cell; sibling rows 1, 3, 4 carry 144",
    "version_read": "VarBench snapshot 390a21e (vendor/varbench) and full history (varbench-history: git show 107dd73, c85080f, 59e621a, abd23ae, 37648ad ... 390a21e); varbench/methods shallow clone ed31bb0; VarBench README.md; arXiv:2302.04919 text (sources/2302.04919.txt)",
    "conversion": "dof = number of spins = n_sites = 12 x 12 = 144 (script: --L 12, L2 = L). v_score recomputes as 144 * 100.89209006595773 / 299.46304457007847^2 = 0.16200676117313792 (stored 0.11250469525912354 equals 100 * Var / E^2 exactly; ratio 1.44).",
    "checked_on": "2026-09-19",
    "reason": "By VarBench's own definition DOF is the number of spins and is constant within a file. VarBench README.md (vendor/varbench/README.md, snapshot 390a21e): \"`DOF`: number of degrees of freedom. For spins and spinless fermions it is the number of particles, and for spinful fermions it is `Nup + Ndown`\" and \"Note that all rows in a same file always have the same `DOF` and `Einf`, but we replicate them in every row to simplify data analysis.\" VarBench paper arXiv:2302.04919 (sources/2302.04919.txt, dated Sept. 12, 2024), Eq. (1) and text: \"where N is the number of degrees of freedom, which is the number of spins for spin models\" and \"For unconstrained spin-1/2 Hilbert spaces, we define N to be equal to the number of lattice sites Ns.\" varbench-history: DOF column introduced in 107dd73 (Dian Wu, 2022-08-18, \"Add DOF to each data row\"), where Heisenberg/triangular_12_PP_144.md received DOF = 144 on every existing row. The DMRG row was inserted by c85080f (Dian Wu, 2022-09-03, \"Update DMRG baseline for Heisenberg\"), a hand-typed line (column alignment differs from the programmatically aligned siblings) with DOF = 100; the same commit replaced the square_10_PP_100.md DMRG row (bond dimension 80 -> 1024, DOF 100, correct there). The cell then passed unchanged through abd23ae (Add Einf, programmatic rewrite), 37648ad (rename to Heisenberg/triangular_144_P.md), 0ef1497, f88f9ba (code link), cd362c4, d186176, fdb4bfb, 5047bfd and 390a21e (snapshot). Never edited, never restored. Across all six VarBench folders the two flagged rows are the only rows whose DOF differs from their file siblings (survey of every DMRG row: DOF = site count for every spin-model DMRG row, e.g. J1J2/square_196_P_0.5 DMRG (bond dimension = 512) has DOF = 196). varbench-methods scripts/Heisenberg/triangular_144_P/dmrg.sh: `julia --project heisenberg_2d.jl --peri --L 12 --J2 1 --zero_mag --max_B 512 --seed 123`; programs/dmrg_itensors/heisenberg_2d.jl builds 12 x 12 = 144 sites, periodic in both directions, square bonds plus J2 = 1 on the (i,j)-(i+1,j+1) diagonal (lines 64-70) and J22 = 0 (args.jl: \"Set J22 = 0 for triangular lattices\") = triangular lattice with 3 x 144 = 432 bonds of equal strength, Pauli form (`J *= 4`), Sz_total = 0 sector, 50 sweeps, max bond dimension 512, cutoff 1e-12. Prints `energy` and `energy_var` only; no parameter count or DOF, no output log in the methods repo (scope config). QMBL DATA.md: \"`dof` is the spin count for spin models\"; scripts/units.mjs expectedDof returns n_sites for spin models, so validate.mjs expects 144. Not a duplicate: no other row on Heisenberg/triangular_144_P carries this energy (data/Heisenberg/triangular_144_P.json, 5 rows read).",
    "source_entry": "FB2-varbench-code-heisenberg#2 (qmbl-verify 2026-09-19-flagged, ruling 2026-09-21: option a throughout)"
  },
  {
    "match": {
      "instance": "Heisenberg/triangular_144_P",
      "method": "DMRG (bond dimension = 512)",
      "energy": -299.46304457007847
    },
    "field": "defect",
    "to": null,
    "reported_as": "n/a (flag lift)",
    "location": "scripts/defects.mjs lines 23-26",
    "version_read": "same sources as the dof correction",
    "conversion": "none",
    "checked_on": "2026-09-19",
    "reason": "Same cause and same fix as the square_196_P row: both DMRG rows were inserted by the one commit c85080f with the 10x10 file's DOF; VarBench's definition fixes DOF = 144 here. Lift the flag together with the dof correction (RULES.md 10; apply_corrections.mjs recomputes v_score = 0.16200676117313792). If the ruling is to keep the flag until VarBench fixes it upstream, the rewritten finding is: \"VarBench c85080f (Dian Wu, 2022-09-03) inserted this DMRG row by hand with DOF = 100 on a 144-spin file whose other rows carry 144; VarBench's README and paper define DOF as the number of spins. The stored v_score 0.1125 is 100 Var/E^2; with 144 it is 0.1620 (x1.44). VarBench's own per-method V-score point for this row is understated by the same factor; the instance-level V-score in the VarBench figure is unaffected (lowest-energy row is VMC with Dirac+field+Jastrow, -314.632).\"",
    "source_entry": "FB2-varbench-code-heisenberg#3 (qmbl-verify 2026-09-19-flagged, ruling 2026-09-21: option a throughout)"
  },
  {
    "match": {
      "instance": "Hubbard/square_64_P_32_8",
      "method": "AFQMC (Metropolis, Trotter error extrapolated), numerically exact",
      "energy": -33.642
    },
    "field": "reference",
    "to": "[paper](https://doi.org/10.1126/science.adg9774) (Wu et al., Science 386, 296 (2024), arXiv:2302.04919, Supplementary Sec. S3 E 2: AFQMC computed for VarBench, uploaded 2022-03-16)",
    "reported_as": "-33.642 | 0.005 | AFQMC (Metropolis, Trotter error extrapolated), numerically exact (VarBench Hubbard/square_8_PP_32_32_8.md as uploaded 2022-03-16); PRB 94, 085103 Table IV, row 8 x 8, column U = 8 PBC: E = -33.68(3)",
    "location": "varbench-history: git log -p -- Hubbard/square_64_P_32_8.md (commits b1b88c1 2022-03-16 yyang606 'Update square_8_PP_32_32_8.md', b1a1a26 2024-07-11 'TODO: ask Shiwei', 3f160a4 2024-08-06 PR #23 'Added references to AFQMC data'); PR #23 has no description, its only comment thread is about the negative-U reference (PRA 92, 033603); arXiv:2302.04919 Suppl. S3 E 2 'Sign-problem-free Hubbard model: exact AFQMC with generalized Metropolis algorithm' and S3 E 1 'we have either extrapolated dtau to zero or set it to a fixed value (typically dtau = 0.01)'",
    "version_read": "arXiv:1605.09421v2 PDF (qmbl-runs/qmbl-refute/1605.09421.pdf, pypdf layout text qmbl-runs/qin2016.txt and qsz.txt; Tables I-IV and the appendix read in full, no -33.642 or -0.52566 anywhere); arXiv:2302.04919 text in qmbl/sources; VarBench git history",
    "conversion": "-33.68 / 64 = -0.52625(47) per site, which Gu et al. print as -0.5262(5); -33.642 / 64 = -0.5256563(78)",
    "checked_on": "2026-09-21",
    "reason": "The reference did not contain the number. Wu et al., Science 386, 296 (2024), arXiv:2302.04919, Supplementary Sec. S3 E 2; AFQMC computed for VarBench by Yiqi Yang and Shiwei Zhang, uploaded 2022-03-16, commit b1b88c1; not printed in PRB 94, 085103, whose Table IV gives -33.68(3) at fixed tau = 0.01. The cited paper does not contain this number. PRB 94, 085103 Table IV prints -33.68(3) for 8x8 U = 8 PBC at fixed tau = 0.01 (Sec. II B: 'We typically choose tau = 0.01 in this work'), with no Trotter extrapolation; Tables I-III are 4x4 or thermodynamic-limit data. The VarBench row is a distinct, more precise computation (sigma 0.005 vs 0.03) whose method string matches the VarBench paper's own AFQMC description, uploaded directly by a VarBench co-author from the Zhang group two years before any reference was attached; the sibling U = 4 row -55.063(4) (Table IV: -55.05(1)) has the same history (commit 833f6cc, same day). The two values are consistent (1.25 sigma) and describe the same instance (8x8, PBC both directions, N_up = N_dn = 32, U = 8, no twist), so the row stays exact (stochastic); only its provenance is wrong. Prior ruling 'on hold' for reference-not-found rows noted: this entry supplies the provenance that ruling was waiting for.",
    "source_entry": "FP4-arxiv-2507-02644#2 (qmbl-verify 2026-09-19-flagged, ruling 2026-09-21: option a throughout)"
  },
];
