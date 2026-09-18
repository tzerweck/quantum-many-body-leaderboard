// Checks that found nothing wrong, recorded on the row (RULES.md 11), so an imported row
// nobody has read and one that was read against its source can be told apart. Applied by
// apply_corrections.mjs.
//
// scope "value":  the number itself was located in the source (or recomputed exactly).
// scope "config": the instance and method were confirmed, e.g. from a run script, but the
//                 number could not be pinned to one Hamiltonian.
//
// A row that already carries `verified` (rows QMBL added itself) keeps it; an independent
// re-read is attached as `verified.second_read`.
//
// match: as in corrections.mjs, against the values before any correction applies.

const SQUARE = "2D RNN wavefunction, zero-variance extrapolation";
const SSE = "SSE QMC (stochastic series expansion), T -> 0 converged at beta/L = 32 and 64";
// L, Moss et al. Table III (zero-variance), Sandvik Table I (SSE); per spin, S.S units
const HEISENBERG = [
  [8, "-0.6735047(2)", -172.4172032, "-0.67349005(2)", -172.4134528],
  [10, "-0.6715950(5)", -268.638, "-0.67155266(2)", -268.621064],
  [12, "-0.6707008(1)", -386.3236608, "-0.67068192(2)", -386.31278592],
  [14, "-0.6703092(5)", -525.5224128, "-0.67023225(2)", -525.462084],
  [20, "-0.6697420(6)", -1071.5872, "-0.66971967(2)", -1071.551472],
  [24, "-0.6696127(5)", -1542.7876608, "-0.66960434(2)", -1542.76839936],
  [28, "-0.6695580(4)", -2099.733888, "-0.66954496(3)", -2099.69299456],
];
// instance after relabels.mjs, stored exact energy, what reproduces it
const HUBBARD_ED = [
  ["Hubbard/square_16_P_4_3.59381366", -17.698030018702067, "-17.698030018702013 (ed_check.py) | -17.69803001870263 (ed_lib.mjs)"],
  ["Hubbard/square_16_P_4_7.74263683", -16.509154825265142, "-16.50915482526524 (ed_check.py) | -16.509154825269405 (ed_lib.mjs)"],
  ["Hubbard/square_16_P_5_2.15443469", -21.21223577699911, "-21.21223577699904 (ed_check.py) | -21.212235776995612 (ed_lib.mjs) | -21.212235776999105 (skeptic_ed.py)"],
  ["Hubbard/square_16_P_5_3.59381366", -19.891637199948672, "-19.891637199948637 (ed_check.py) | -19.89163719987478 (ed_lib.mjs)"],
  ["Hubbard/square_16_P_5_7.74263683", -17.60373155517909, "-17.60373155517896 (ed_check.py) | -17.603731555119207 (ed_lib.mjs)"],
  ["Hubbard/chain_14_P_4_4.64158883", -10.896957984833337, "-10.896957984833353 (ed_check.py) | -10.896957984834266 (ed_lib.mjs)"],
];

export const VERIFICATIONS = [
  ...HEISENBERG.flatMap(([L, moss, eMoss, sandvik, eSse]) => [
    { match: { instance: `Heisenberg/square_${L * L}_P`, method: SQUARE, energy: eMoss },
      checked_on: "2026-09-17", scope: "value",
      method: "arXiv:2502.17144v3 PDF (pypdf layout and plain) and v3 HTML table cells, parsed locally; a skeptic re-read the v3 PDF",
      location: "Table III", reported_as: moss, conversion: `x 4 x ${L * L}`,
      note: "Transcribed correctly, in Sandvik's convention (H = sum S_i.S_j per spin). Its printed bar is a bootstrap standard error, about 30x below the bootstrap spread; the row keeps it and is flagged sigma-understated.",
      source_entry: "RP1-heisenberg (qmbl-verify 2026-09-17)" },
    { match: { instance: `Heisenberg/square_${L * L}_P`, method: SSE, energy: eSse },
      checked_on: "2026-09-17", scope: "value",
      method: "arXiv:2601.20189v2 PDF (pypdf layout and plain) and v2 HTML table cells, parsed locally; a skeptic re-read the v2 PDF",
      location: "Table I", reported_as: sandvik, conversion: `x 4 x ${L * L}`,
      note: "Agrees with the QMC column of Moss et al. (arXiv:2502.17144, Table III) and with Chen and Heyl's SSE to at most 2.0 sigma.",
      source_entry: "RP1-heisenberg (qmbl-verify 2026-09-17)" },
  ]),
  ...HUBBARD_ED.map(([instance, energy, recomputed]) => ({
    match: { instance, method: "Exact diagonalization", energy },
    checked_on: "2026-09-16", scope: "value",
    method: "recomputed: Lanczos ED over the full fixed-(N_up, N_dn) space by two independent codes (checks/hubbard-u-labels/)",
    location: "checks/hubbard-u-labels/", reported_as: recomputed, conversion: "none",
    note: "Reproduced at the grid U the instance now carries, not at the U of VarBench's name (relabels.mjs).",
    source_entry: "B2-baseline-hubbard and E1-exact-recompute (qmbl-verify 2026-09-16)" })),
  { match: { instance: "Hubbard/square_16_P_4_7.74263683", method: "DMRG (MaxBondDim ~3200)", energy: -16.5091541 },
    checked_on: "2026-09-16", scope: "config",
    method: "run script varbench/methods programs/dmrg_itensors_hubbard/square_16_P_4_7.74264.jl read in full",
    location: "line setting U", reported_as: "U = 10", conversion: "none",
    note: "The linked script is a copy of the U = 10 file, so it did not produce this number. The energy sits 1.2e-7 above the ground state at U = 7.74264 and 7.3e-7 above the one at 7.74263683: a valid bound at either, and too close to both to say which it was run at, so it stays on this instance.",
    source_entry: "B2-baseline-hubbard (qmbl-verify 2026-09-16)" },
];
