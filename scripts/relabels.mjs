// Instances whose name carries a different coupling from the one their rows were computed at
// (RULES.md 11; ruling 2026-09-16, extended 2026-09-17, Tristan).
//
// VarBench's Hubbard couplings between 1 and 10 are the grid 10^(k/9). The 14-site chain
// instances carry the grid value to eight decimals; five 4x4 instance names carry a rounded
// or mistyped one (2.1544, 3.5981 for 3.5938, 7.74264), and one chain name ends in ...82
// where the value used rounds to ...83. The exact diagonalization and the HFDS rows on these
// instances were computed at the grid value: two independent ED codes reproduce each stored
// exact energy there to 1e-10 or better, and at the named U four of those energies would sit
// below the ground state, which no eigenvalue can. The DMRG rows were run at the named U,
// taken from the file name. Evidence and codes: checks/hubbard-u-labels/.
//
// So the instance moves to the grid U, and the rows computed at the named U stay behind on an
// instance of their own, with the ground state at that U as its exact row (`keep`, `exact`).
// Where the two ground states differ by less than any row could resolve, nothing stays behind.
//
// from, to:  instance ids; `to` takes every row not listed in `keep`, and the coverage
// params:    the instance parameters that change
// keep:      rows that stay on `from`: published method string and energy, and why
// exact:     the ground state at the named U, from the two codes (the first is stored)
// reason:    what was wrong with the name, for the instance page

const CHECKED = "2026-09-16";
const CODES = "Lanczos ED over the full fixed-(N_up, N_dn) space, no symmetry, t = 1: numpy/scipy (checks/hubbard-u-labels/ed_check.py) and node (ed_lib.mjs, run_fermions.mjs)";

export const RELABELS = [
  {
    from: "Hubbard/square_16_P_4_3.5981", to: "Hubbard/square_16_P_4_3.59381366", params: { U: 3.59381366 },
    reason: "The name's 3.5981 has two digits swapped: the coupling of this Hamiltonian is 3.59381366 (10^(5/9)). The exact diagonalization, -17.698030018702067, is the ground state there; at U = 3.5981 the ground state is 1.79e-3 higher, so the stored exact energy sat below the ground state of the instance as named.",
    keep: [{ method: "DMRG (MaxBondDim ~3200)", energy: -17.69623,
      why: "its run script sets U = 3.5981. It sits 5.05e-6 above the ground state at that U (variance per unit energy error 0.41), and 1.80e-3 above the one at 3.59381366." }],
    exact: [-17.69623505010233, -17.696235050104434],
  },
  {
    from: "Hubbard/square_16_P_5_3.5981", to: "Hubbard/square_16_P_5_3.59381366", params: { U: 3.59381366 },
    reason: "The name's 3.5981 has two digits swapped: the coupling of this Hamiltonian is 3.59381366 (10^(5/9)). The exact diagonalization, -19.891637199948672, is the ground state there; at U = 3.5981 the ground state is 3.41e-3 higher, and the HFDS row would sit 369 sigma below it.",
    keep: [{ method: "DMRG (MaxBondDim = 7000)", energy: -19.88822918,
      why: "its run script sets U = 3.5981. It sits 1.45e-8 above the ground state at that U (variance per unit energy error 20), and 3.41e-3 above the one at 3.59381366." }],
    exact: [-19.88822919448899, -19.88822919445522],
  },
  {
    from: "Hubbard/square_16_P_5_2.1544", to: "Hubbard/square_16_P_5_2.15443469", params: { U: 2.15443469 },
    reason: "The name's 2.1544 cuts off the coupling of this Hamiltonian, 2.15443469 (10^(3/9)). The exact diagonalization, -21.21223577699911, is the ground state there and 3.65e-5 above the ground state at U = 2.1544.",
    keep: [{ method: "DMRG (MaxBondDim 7000)", energy: -21.2122722,
      why: "its run script sets U = 2.1544. It sits 3.21e-8 above the ground state at that U (variance per unit energy error 0.81), and 3.64e-5 below the one at 2.15443469, which no variational energy can." }],
    exact: [-21.212272232092317, -21.212272232074348],
  },
  {
    from: "Hubbard/square_16_P_5_7.74264", to: "Hubbard/square_16_P_5_7.74263683", params: { U: 7.74263683 },
    reason: "The name's 7.74264 rounds the coupling of this Hamiltonian, 7.74263683 (10^(8/9)). The exact diagonalization, -17.60373155517909, is the ground state there; at U = 7.74264 the ground state is 1.18e-6 higher, so the stored exact energy sat below the ground state of the instance as named.",
    keep: [{ method: "DMRG (MaxBondDim = 7000)", energy: -17.6037303,
      why: "its run script sets U = 7.74264. It sits 8.0e-8 above the ground state at that U (variance per unit energy error 45), and 1.26e-6 above the one at 7.74263683." }],
    exact: [-17.603730380085874, -17.603730380008766],
  },
  {
    // The DMRG run script here sets U = 10 (a copy of the U = 10 file), and its energy sits
    // 1.2e-7 above the ground state at 7.74264 and 7.3e-7 above the one at 7.74263683: a valid
    // bound at either, so it stays with the instance (verifications.mjs says so on the row).
    from: "Hubbard/square_16_P_4_7.74264", to: "Hubbard/square_16_P_4_7.74263683", params: { U: 7.74263683 },
    reason: "The name's 7.74264 rounds the coupling of this Hamiltonian, 7.74263683 (10^(8/9)). The exact diagonalization, -16.509154825265142, is the ground state there; at U = 7.74264 the ground state is 6.1e-7 higher, so the stored exact energy sat below the ground state of the instance as named.",
    keep: [], exact: null,
  },
  {
    // Ground states at the two couplings differ by 3.0e-9; the DMRG row, run at 4.64158882,
    // sits 2.2e-9 below the stored exact energy, inside the validator's 1e-8 rounding band.
    from: "Hubbard/chain_14_P_4_4.64158882", to: "Hubbard/chain_14_P_4_4.64158883", params: { U: 4.64158883 },
    reason: "The name's 4.64158882 misrounds the coupling of this Hamiltonian, 4.6415888336 (10^(6/9)). The exact diagonalization, -10.896957984833337, is the ground state at U = 4.64158883 and 3.03e-9 above the ground state at 4.64158882.",
    keep: [], exact: null,
  },
].map(r => ({ ...r, checked_on: CHECKED, codes: CODES }));
