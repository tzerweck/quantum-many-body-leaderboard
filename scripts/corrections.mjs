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
];
