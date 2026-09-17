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
  // qmbl-verify 2026-09-17, ruling 1b: the zero-variance bars of Moss et al. on the periodic
  // square lattice are standard errors of a bootstrap mean; the rows take the bootstrap spread.
  {
    "match": {
      "instance": "Heisenberg/square_64_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -172.4172032
    },
    "field": "sigma",
    "to": 0.0017,
    "reported_as": "bootstrapped y-int L=8: -0.673504737998286 +/ 2.0821700789715466e-07",
    "location": "Square/final_plotting/get_zer_var_energies.ipynb, cell 13 (Nb = 1000 in cell 12), periodic block",
    "version_read": "github.com/mschuylermoss/HeisenbergRNN@29bf62ac; committed as sources/2502.17144-repo-get_zer_var_energies.ipynb",
    "conversion": "2.0821700789715466e-7 x sqrt(1000) = 0.00000658 per site (the spread of the 1000 bootstrap intercepts); x 4 x 64 = 0.00169, stored to two figures",
    "checked_on": "2026-09-17",
    "reason": "Table III prints -0.6735047(2), whose bar is np.std(intercepts)/np.sqrt(Nb): the standard error of the mean of 1000 bootstrap intercepts, not the uncertainty of the extrapolated energy. The row takes the bootstrap spread itself (ruling 2026-09-17, Tristan). The printed bar stays in corrections[].from.",
    "source_entry": "RP1-heisenberg, ruling 1b (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_100_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -268.638
    },
    "field": "sigma",
    "to": 0.0058,
    "reported_as": "bootstrapped y-int L=10: -0.6715950003487687 +/ 4.6097929512716953e-07",
    "location": "Square/final_plotting/get_zer_var_energies.ipynb, cell 13 (Nb = 1000 in cell 12), periodic block",
    "version_read": "github.com/mschuylermoss/HeisenbergRNN@29bf62ac; committed as sources/2502.17144-repo-get_zer_var_energies.ipynb",
    "conversion": "4.6097929512716953e-7 x sqrt(1000) = 0.0000146 per site (the spread of the 1000 bootstrap intercepts); x 4 x 100 = 0.00583, stored to two figures",
    "checked_on": "2026-09-17",
    "reason": "Table III prints -0.6715950(5), whose bar is np.std(intercepts)/np.sqrt(Nb): the standard error of the mean of 1000 bootstrap intercepts, not the uncertainty of the extrapolated energy. The row takes the bootstrap spread itself (ruling 2026-09-17, Tristan). The printed bar stays in corrections[].from.",
    "source_entry": "RP1-heisenberg, ruling 1b (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_144_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -386.3236608
    },
    "field": "sigma",
    "to": 0.0021,
    "reported_as": "bootstrapped y-int L=12: -0.670700812082769 +/ 1.1478964921581232e-07",
    "location": "Square/final_plotting/get_zer_var_energies.ipynb, cell 13 (Nb = 1000 in cell 12), periodic block",
    "version_read": "github.com/mschuylermoss/HeisenbergRNN@29bf62ac; committed as sources/2502.17144-repo-get_zer_var_energies.ipynb",
    "conversion": "1.1478964921581232e-7 x sqrt(1000) = 0.00000363 per site (the spread of the 1000 bootstrap intercepts); x 4 x 144 = 0.00209, stored to two figures",
    "checked_on": "2026-09-17",
    "reason": "Table III prints -0.6707008(1), whose bar is np.std(intercepts)/np.sqrt(Nb): the standard error of the mean of 1000 bootstrap intercepts, not the uncertainty of the extrapolated energy. The row takes the bootstrap spread itself (ruling 2026-09-17, Tristan). The printed bar stays in corrections[].from.",
    "source_entry": "RP1-heisenberg, ruling 1b (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_196_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -525.5224128
    },
    "field": "sigma",
    "to": 0.012,
    "reported_as": "bootstrapped y-int L=14: -0.6703091912589934 +/ 4.880562317324971e-07",
    "location": "Square/final_plotting/get_zer_var_energies.ipynb, cell 13 (Nb = 1000 in cell 12), periodic block",
    "version_read": "github.com/mschuylermoss/HeisenbergRNN@29bf62ac; committed as sources/2502.17144-repo-get_zer_var_energies.ipynb",
    "conversion": "4.880562317324971e-7 x sqrt(1000) = 0.0000154 per site (the spread of the 1000 bootstrap intercepts); x 4 x 196 = 0.0121, stored to two figures",
    "checked_on": "2026-09-17",
    "reason": "Table III prints -0.6703092(5), whose bar is np.std(intercepts)/np.sqrt(Nb): the standard error of the mean of 1000 bootstrap intercepts, not the uncertainty of the extrapolated energy. The row takes the bootstrap spread itself (ruling 2026-09-17, Tristan). The printed bar stays in corrections[].from.",
    "source_entry": "RP1-heisenberg, ruling 1b (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_400_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -1071.5872
    },
    "field": "sigma",
    "to": 0.024,
    "reported_as": "bootstrapped y-int L=20: -0.6697419855772648 +/ 4.830429056620953e-07",
    "location": "Square/final_plotting/get_zer_var_energies.ipynb, cell 13 (Nb = 1000 in cell 12), periodic block",
    "version_read": "github.com/mschuylermoss/HeisenbergRNN@29bf62ac; committed as sources/2502.17144-repo-get_zer_var_energies.ipynb",
    "conversion": "4.830429056620953e-7 x sqrt(1000) = 0.0000153 per site (the spread of the 1000 bootstrap intercepts); x 4 x 400 = 0.0244, stored to two figures",
    "checked_on": "2026-09-17",
    "reason": "Table III prints -0.6697420(6), whose bar is np.std(intercepts)/np.sqrt(Nb): the standard error of the mean of 1000 bootstrap intercepts, not the uncertainty of the extrapolated energy. The row takes the bootstrap spread itself (ruling 2026-09-17, Tristan). The printed bar stays in corrections[].from.",
    "source_entry": "RP1-heisenberg, ruling 1b (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_576_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -1542.7876608
    },
    "field": "sigma",
    "to": 0.036,
    "reported_as": "bootstrapped y-int L=24: -0.6696126658492143 +/ 4.986119842485525e-07",
    "location": "Square/final_plotting/get_zer_var_energies.ipynb, cell 13 (Nb = 1000 in cell 12), periodic block",
    "version_read": "github.com/mschuylermoss/HeisenbergRNN@29bf62ac; committed as sources/2502.17144-repo-get_zer_var_energies.ipynb",
    "conversion": "4.986119842485525e-7 x sqrt(1000) = 0.0000158 per site (the spread of the 1000 bootstrap intercepts); x 4 x 576 = 0.0363, stored to two figures",
    "checked_on": "2026-09-17",
    "reason": "Table III prints -0.6696127(5), whose bar is np.std(intercepts)/np.sqrt(Nb): the standard error of the mean of 1000 bootstrap intercepts, not the uncertainty of the extrapolated energy. The row takes the bootstrap spread itself (ruling 2026-09-17, Tristan). The printed bar stays in corrections[].from.",
    "source_entry": "RP1-heisenberg, ruling 1b (qmbl-verify 2026-09-17)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_784_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -2099.733888
    },
    "field": "sigma",
    "to": 0.041,
    "reported_as": "bootstrapped y-int L=28: -0.66955797777309 +/ 4.0887165750442073e-07",
    "location": "Square/final_plotting/get_zer_var_energies.ipynb, cell 13 (Nb = 1000 in cell 12), periodic block",
    "version_read": "github.com/mschuylermoss/HeisenbergRNN@29bf62ac; committed as sources/2502.17144-repo-get_zer_var_energies.ipynb",
    "conversion": "4.0887165750442073e-7 x sqrt(1000) = 0.0000129 per site (the spread of the 1000 bootstrap intercepts); x 4 x 784 = 0.0405, stored to two figures",
    "checked_on": "2026-09-17",
    "reason": "Table III prints -0.6695580(4), whose bar is np.std(intercepts)/np.sqrt(Nb): the standard error of the mean of 1000 bootstrap intercepts, not the uncertainty of the extrapolated energy. The row takes the bootstrap spread itself (ruling 2026-09-17, Tristan). The printed bar stays in corrections[].from.",
    "source_entry": "RP1-heisenberg, ruling 1b (qmbl-verify 2026-09-17)"
  },
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
];
