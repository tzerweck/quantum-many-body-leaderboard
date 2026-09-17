// Rows removed from the table, each with the ruling and its reason (RULES.md §11). The
// scripts that add these rows still read them from their sources; apply_removals.mjs takes
// them out after every row is in, so a removal is one line here and never a silent edit of
// an import script.
export const REMOVALS = [
  // Duplicates: the same number carried twice. The row read from the original paper stays.
  {
    match: { instance: "Hubbard/square_256_PA_128_8", method: "AFQMC", energy: -134.25 },
    ruled: "2026-09-17 (Tristan): duplicate, the original paper's row stays",
    reason: "VarBench's copy of -134.25(3) from Qin, Shi & Zhang, PRB 94, 085103 (2016), Table IV, which add_exact_rows.mjs reads from the paper itself. The copy carried no bound_type.",
  },
  {
    match: { instance: "Heisenberg/square_100_O", method: "PEPS (bond dimension = 10)", energy: -251.4404 },
    ruled: "2026-09-17 (Tristan): duplicate, the original paper's row stays",
    reason: "VarBench's copy of the finite-PEPS energy of Liu, Dong, Han, Guo & He, PRB 95, 195154 (2017), which add_sweep2_rows.mjs carries with its error bar and that paper as the reference.",
  },
  {
    match: { instance: "Heisenberg/square_256_O", method: "PixelCNN (deep autoregressive)", energy: -658.890752 },
    ruled: "2026-09-17 (Tristan): duplicate, the original paper's row stays",
    reason: "The energy of Sharir, Levine, Wies, Carleo & Shashua, PRL 124, 020503 (2020) as quoted in a later paper's table; the row read from that paper itself (NAQS) stays.",
  },
  // Not an energy of the instance.
  ...["J1J2/triangular_108_P_0.125", "J1J2/triangular_144_P_0.125"].map(instance => ({
    match: { instance, method: "Thermodynamic-limit estimate interpolated to this size (1/L^3)" },
    ruled: "2026-09-17 (Tristan): not a finite-size result",
    reason: "Table III of Roth, Szabo & MacDonald, PRB 108, 054410 (2023) fills this size from the thermodynamic-limit estimate of Iqbal et al., PRB 93, 144411 (2016) and the exact 36-site energy, assuming 1/L^3 finite-size scaling. Nobody computed this cluster.",
  })),
];
