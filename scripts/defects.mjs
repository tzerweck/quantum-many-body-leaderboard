// Known defects in rows. Rows are never silently corrected or deleted (RULES.md 11): the
// defect is attached to the row and travels with it. Each entry: match (instance, method,
// energy within 1e-9), flag, finding (the evidence, with the source of every claim), and an
// optional `shared` key naming a block in SHARED (diagnosis / ruled_out / evidence written for
// that row or that group of rows). A shared block is attached ONLY through `shared`: keying
// it by flag name spread the TFIsing RBM diagnosis onto every below-exact row until
// 2026-09-21. `source_entry` names the verification proposal the finding was written from.
//
// Findings rewritten 2026-09-21 from the deep-source pass qmbl-verify-2026-09-19-flagged
// (upload history, released code, appendices, arXiv versions, a rerun of the VarBench scripts);
// evidence per row in that run's out/<group>/report.md.
export const DEFECTS = [
  {
    "match": {
      "instance": "TFIsing/chain_10_P_1",
      "method": "RBM (alpha = 1)",
      "energy": -12.785231
    },
    "flag": "below-exact",
    "finding": "-12.785231(48) sits 3.25e-4 (6.8 sigma) below the exact free-fermion energy -12.784906443 (recomputed here; VarBench's Exact Solution and DMRG rows agree to 4e-15). The value is not reproducible from the cited source: the linked script programs/vmc_netket/vmc.py was first committed to varbench/methods on 2024-07-23 (1347303) and linked from the dataset on 2024-07-30 (5047bfd, link only, value unchanged), eighteen months after the number, which entered the dataset in commit 6e7a021 (Dian Wu, 2023-01-09, 'Update Ising Jastrow and RBM baselines', no code, no message body). The script also uses nk.operator.IsingJax (NetKet 3.9, 24 Jul 2023) and, for larger RBMs, nkx.driver.VMC_SRt (NetKet 3.10, 7 Nov 2023; CHANGELOG.md of the v3.13.0 clone), neither of which existed in January 2023, so it is a later reimplementation of the baseline, not the program that ran. That commit moved the row from -12.784707(48), var 0.0024197807 (77a95d7, 2022-12-12; 2.0e-4 = 4.2 sigma ABOVE exact) to the stored value with an almost unchanged variance (0.0024565159): a state of the same quality cannot have an energy 5.2e-4 (11 sigma) lower. A bit-faithful rerun of the linked script (checks/tfising-rbm-varbench-rerun/run.sh: NetKet 3.13.0, jax 0.4.30, CPU, seed 123, methods ed31bb0) prints energy -12.784382 +- 0.000065 [var 0.004806, R_hat 1.0005], i.e. 5.2e-4 ABOVE exact and 8.5e-4 (13 sigma) above the stored number; full summation of the same final parameters over all 1024 basis states gives -12.784376149 (above exact, as the variational principle requires) and five repeated 2^20-sample estimates of those parameters (-12.784403, -12.784375, -12.784276, -12.784286, -12.784475; sigma 6.7e-5, tau_corr <= 0.003, R_hat 1.0005) scatter around it within 1.5 sigma (checks/tfising-rbm-varbench-rerun/ising_peri_1d_L10_h=1.eval.json). By construction the script's printed energy is vstate.expect(H) with 2^20 samples from 1024 persistent Metropolis chains (NetKet 3.13.0: MetropolisSampler reset_chains=False, MCState.n_samples setter only changes chain_length; IsingJax mels are float64, only the amplitude ratios are float32; error_of_mean = sqrt(Var(chain means)/1024), the between-chain estimate, which equals sqrt(Var/2^20) only because tau_corr ~ 0), so the code as published has no mechanism that yields a value below the exact energy beyond its own error bar. The stored sigma equals sqrt(0.0024565159/2^20) = 4.84e-5 to two digits, which identifies the published number as a 2^20-sample final estimate, not a training-trace point (per-step sigma with 1024 samples is 2e-3 in the rerun log): the earlier diagnosis 'minimum of the optimization trace' (checks/results-tfising-rbm.json, complex RBM, netket 3.22) is withdrawn. What the January 2023 run did to obtain an estimate 3e-4 below E0 with a 5e-5 error bar cannot be determined from any published source (the VarBench paper arXiv:2302.04919 does not describe the baseline protocol; the methods repository has no output logs, only the 2024 scripts). The row stays as published with this flag; it is a 2023 number whose code was never published and whose only cited code produces a different, variationally consistent value.",
    "source_entry": "FB1-varbench-code-tfising#0 (qmbl-verify 2026-09-19-flagged)",
    "shared": "below-exact:varbench-rbm-rerun"
  },
  {
    "match": {
      "instance": "TFIsing/chain_10_O_1",
      "method": "RBM (alpha = 1)",
      "energy": -12.381718
    },
    "flag": "below-exact",
    "finding": "-12.381718(22) sits 2.28e-4 (10.4 sigma) below the exact energy -12.38148999965 (VarBench ED via NetKet and DMRG rows; Lanczos on the 1024-state space here agrees to 1e-13). Same provenance as chain_10_P_1: the number entered VarBench in commit 6e7a021 (Dian Wu, 2023-01-09, 'Update Ising Jastrow and RBM baselines', no code), replacing -12.381447(21), var 0.00047990793 (77a95d7, 2022-12-12; 4.3e-5 = 2.0 sigma ABOVE exact) with a value 2.7e-4 (12 sigma) lower at a variance that changed by only 3% (0.00049440652). The linked script scripts/TFIsing/chain_10_O_1/vmc_rbm.sh -> programs/vmc_netket/vmc.py was written in July 2024 (methods 1347303, link added in dataset 5047bfd with the value unchanged) and does not produce the stored number: the bit-faithful rerun (NetKet 3.13.0, jax 0.4.30, CPU, seed 123) prints energy -12.381393 +- 0.000027 [var 0.000753, R_hat 1.0005], 9.7e-5 ABOVE exact and 3.2e-4 (12 sigma) above the stored value; full summation of the final parameters gives -12.381410828 (above exact) and five repeated 2^20-sample estimates (-12.381428, -12.381419, -12.381402, -12.381353, -12.381416; sigma 2.6e-5, tau_corr <= 0.04, R_hat 1.0005) scatter around it within 2.2 sigma (checks/tfising-rbm-varbench-rerun/ising_open_1d_L10_h=1.eval.json). The published code (persistent chains, float64 matrix elements, between-chain error estimate; see the chain_10_P_1 finding) has no mechanism for a below-exact value; the stored sigma = sqrt(0.00049440652/2^20) = 2.17e-5 marks the number as a 2^20-sample final estimate, so it is neither a trace point (per-step sigma 9e-4 in the rerun) nor a 10-sigma fluctuation, but a biased estimate from an unpublished January 2023 run. Earlier 'minimum of the optimization trace' diagnosis withdrawn.",
    "source_entry": "FB1-varbench-code-tfising#1 (qmbl-verify 2026-09-19-flagged)",
    "shared": "below-exact:varbench-rbm-rerun"
  },
  {
    "match": {
      "instance": "TFIsing/chain_32_P_0.5",
      "method": "RBM (alpha = 1)",
      "energy": -34.033633
    },
    "flag": "below-exact",
    "finding": "-34.033633(56) sits 2.12e-4 (3.8 sigma) below the exact free-fermion energy -34.033421119168 (recomputed here; VarBench's Exact Solution row and DMRG -34.03342111914689 agree to 2e-11). Flag renamed from below-exact-suspected to below-exact: the exact reference is analytic, the deviation is the row's own 3.8 sigma, and the same baseline was already below exact in its first upload, -34.0336(58) in 10f5c12 (Dian Wu, 2022-07-11, 'Add RBM baseline'; printed as -34.033550 with var 0.0033952969 from af1d48f 2022-09-01), 1.3e-4 = 2.2 sigma below, before commit 6e7a021 (2023-01-09, 'Update Ising Jastrow and RBM baselines', no code) replaced it with the stored value (var 0.0032365571): two independent VarBench runs, both below E0, on a row whose sigma = sqrt(0.0032365571/2^20) = 5.56e-5 identifies it as a 2^20-sample final estimate rather than a trace point (per-step sigma at 1024 samples is 3e-3 in the rerun log). The linked script (programs/vmc_netket/vmc.py, first committed 2024-07-23, link added 2024-07-30 in 5047bfd with the value unchanged) cannot be the program that produced either run: with 1088 RBM parameters >= 1024 samples it selects nkx.driver.VMC_SRt (bba4595, 2024-07-30), a driver added in NetKet 3.10 (7 Nov 2023), and it builds the Hamiltonian with IsingJax (NetKet 3.9, Jul 2023). The bit-faithful rerun of that script (NetKet 3.13.0, jax 0.4.30, CPU, seed 123, 10^4 steps, 1255 s) prints energy -34.03197 +- 0.00010 [var 0.01013, R_hat 1.0006], 1.45e-3 ABOVE exact and 1.7e-3 above the stored number, at a variance three times the stored one: the 2023 run was a different, better-converged optimisation (checks/tfising-rbm-varbench-rerun/ising_peri_1d_L32_h=0.5.eval.json and trace_summary.json). Four repeated 2^20-sample estimates of the final parameters from the continued chains (-34.032123, -34.032093, -34.032051, -34.032168; sigma 1.05e-4, tau_corr 0.06-0.09) agree with the printed value within 1.2 sigma, so the estimator is sound; the first repetition in out.eval.json (-34.027443 +- 0.000233, var 0.0392, tau_corr 0.23, R_hat 1.0012) came from a freshly initialised sampler with n_discard_per_chain = 0 and is biased UPWARD by 4.7e-3, which shows that the one restart mechanism absent from vmc.py (chains persist there: MetropolisSampler reset_chains=False, the n_samples setter keeps the chain state) would push the energy up, not down. Acceptance of MetropolisLocal at the end of training is 0.036 (h = 0.5, ordered phase) with tau_corr still < 0.1 because sweep_size = 32 flips separate samples. Full summation is impossible at 32 sites, so the rerun's only comparisons are against E0 and the stored value; both say the published code produces a variationally consistent number that is not the stored one. The mechanism inside the 2022 and 2023 runs cannot be determined from any published source (no code, no log; arXiv:2302.04919 does not describe the baseline protocol). The row stays as published with this flag.",
    "source_entry": "FB1-varbench-code-tfising#2 (qmbl-verify 2026-09-19-flagged)",
    "shared": "below-exact:varbench-rbm-rerun"
  },
  {
    "match": {
      "instance": "Heisenberg/square_196_P",
      "method": "DMRG (bond dimension = 512)"
    },
    "flag": "dof-mismatch",
    "finding": "Row stores dof = 100 on a 196-site instance. Upstream typo; the V-score derived from it would be wrong by a factor of ~2."
  },
  {
    "match": {
      "instance": "Heisenberg/triangular_144_P",
      "method": "DMRG (bond dimension = 512)"
    },
    "flag": "dof-mismatch",
    "finding": "Row stores dof = 100 on a 144-site instance. Same typo."
  },
  {
    "match": {
      "instance": "J1J2/square_100_P_0.5",
      "method": "Holographic Quantum Transformer (HQT), zero-shot 8x8->10x10 transfer"
    },
    "flag": "trace-readout",
    "finding": "E/N = -0.49782(3) (abstract; Table 3 'HQT (Ours), Transfer'; Sec. 3.4; Fig. 3 caption 'converges to E/N ≈ -0.49782'; conclusion; identical in the ACM version) is read off the optimisation trace of Fig. 3 (e-print file Fig3_Transfer_10x10.jpg): the whole 10x10 run is 110 iterations, 50 with the backbone frozen and 60 unfrozen, and the digitised transfer trace has tail (iterations 80-109) mean -0.497813, point-to-point std 2.4e-5, last iterate -0.497827, 1 px = 1e-5 (digitise_figs.out.txt). No separate evaluation, sample count or iteration count is described, and Sec. 3.4 says 'our reported statistical error bar reflects sampling fluctuation only and may underestimate the total uncertainty from optimization and residual autocorrelation'. No variance is printed for 10x10 anywhere (main text, LaTeX source and its comments, figures, ACM version), so the previous flag name asserted an inconsistency with a quantity the source does not contain; renamed. The arXiv LaTeX source carries a commented-out earlier draft (sample-sigconf.tex line 615): 'our HQT Transfer model achieves a final energy per site of -0.4960 strictly through zero-shot size extrapolation and rapid alignment. This decisively surpasses the classical CNN baseline (-0.49514) ... Rather than claiming absolute SOTA on this metric', while the same draft's Table 3 (line 608) and Fig. 3 caption (line 623) already print -0.49782(3) as 'New SOTA' and 'bypassing the previous absolute SOTA (-0.49769)'; the published text was softened to 'SOTA-level' and 'statistically consistent'. On this instance the number is 1.3e-4 below CNN-MPS -0.4976939(2) and 1.0e-4 below the ResNet zero-variance extrapolation -0.497715(9), reached in 60 unfrozen iterations; the paper's own cold start reaches -0.4974 in the same 110 iterations (Table 3 row 3; stored as a separate row). No code repository, supplement or data file exists (see the 8x8 row). Flag stands under the new name: a trace readout with a sampling-only error bar, contradicted by the paper's own earlier draft, cannot be treated as a converged measurement; an unclaimed record 4 sigma below the field is grounds for objection, not proof of error (no exact reference at 10x10).",
    "source_entry": "FP1-arxiv-2607-00398#4 (qmbl-verify 2026-09-19-flagged)",
    "shared": "trace-readout:hqt-10x10"
  },
  {
    "match": {
      "instance": "J1J2/square_64_P_0.5",
      "method": "Holographic Quantum Transformer (HQT)"
    },
    "flag": "energy-variance-inconsistent",
    "finding": "E/N = -0.5001(1) is the paper's own benchmark number: abstract, Table 1 row 8x8 'HQT (Ours)' (notes cell 'tau<0.01, sigma^2=1.4e-3'), Sec. 3.2, conclusion; identical in the ACM version and in the commented-out draft of Table 1 (sample-sigconf.tex line 512). The paper prints three variances for this state and defines none of them: Table 1 and Sec. 3.2 give sigma^2_{E/N} = 1.4e-3 for the 'high-precision benchmark'; Table 2 row 0.50 gives -0.5001 with sigma^2_{E/N} = 0.0034 for the 'coarse phase scan ... fewer samples per point' (caption); and Fig. 2(a) (Fig2_Phase_Diagram_8x8.jpg), which the caption of Table 2 says the table summarises, plots the J2 = 0.5 scan point at E/N = -0.485 with sigma^2 = 0.094 (marker centre and the axis autoscale margin agree; digitise_figs.out.txt). The other seven scan points of Fig. 2(a) match Table 2 to 1e-4 in energy, while every plotted variance is 3x-27x the tabulated one, so the Table 2 J2 = 0.50 row carries the Table 1 energy, not the scan's, with a third variance. The stored energy_variance 1.4336 converts 1.4e-3 as Var(H)/N in S.S units; that convention is an assumption of the loader (scripts/add_sweep_rows.mjs line 41, varPerSite), though the printed sigma = 1e-4 per site is consistent with it for ~2^11 samples (sqrt(1.4e-3*64/2048)/64 = 1.0e-4). Against RBM+PP (-0.4989635, V-score 9.8e-4) the stored variance gives V-score 5.6e-3; Table 2's 0.0034 gives 1.4e-2; the figure's 0.094 gives 0.37. Nothing outside the paper can settle it: arXiv has v1 only (10 pages, no appendix); the ACM DL page lists no supplemental material; GitHub searches on the title, 'HQT', 'Holographic Transfer', 'Projection Re-initialization' and the authors return nothing (the first author's account XingranGuo holds one profile-README repository); no 8x8 J2 = 0.5 trace, sample count, iteration count or error-bar method is printed. Flag stands, strengthened: the paper's own figure shows its J2 = 0.5 state 1.5e-2 above the tabulated energy with a variance 28x (Table 2) to 67x (Table 1) the tabulated values, and the earlier draft (line 519) compared the same -0.5001(1) against DMRG (Gong et al. 2014) as 'strictly approaching the tensor network limits' although it is 9e-4 below Gong's truncation-error-extrapolated 8x8 value -0.4992 (stored row 15, -127.7952) and 1.9e-3 below Gong's 8192-state bound -0.49818 (row 14).",
    "source_entry": "FP1-arxiv-2607-00398#1 (qmbl-verify 2026-09-19-flagged)",
    "shared": "energy-variance-inconsistent:hqt-8x8"
  },
  {
    "match": {
      "instance": "Heisenberg/kagome-6x6_108_P",
      "method": "GCNN, spinon pair-density-wave state (chi0, P_Z2 = -1, q = (pi, pi/sqrt3))"
    },
    "flag": "sampling-nonergodic",
    "finding": "Flag upheld from the primary text, not only from the Comment. (1) Update rule and sector are stated by the paper itself: Sec. III, last paragraph before Sec. IV (arXiv:2401.02866v2, sources/2401.02866.txt lines 1013-1020; identical wording in v1, sources/2401.02866v1.txt lines 3040-3047): \"Whilst for the 48 sites cluster the best variational energy is obtained by the free energy minimization within the total Sz = 0 sector where the samples are generated by exchanging spins at two randomly chosen lattice sites, for the 108 sites cluster the best results are found by sampling within the whole Hilbert space with samples generated by flipping a spin at random lattice site.\" Sec. II defines the Z2 spin-parity symmetry P_Z2 = prod_i sigma^x_i only \"for the eigenstates with Mz = sum_i sigma(r_i) = 0\", yet the 108-site run is not restricted to that sector; the Hamiltonian (Eq. 7, H = J sum_<ij> S_i.S_j, no constant shift) conserves S^z_tot, so single spin flips out of the S^z_tot = 0 sector have vanishing acceptance once the ansatz concentrates there. N_s = 2^13 samples per step (Sec. II). Neither arXiv version prints an acceptance rate, autocorrelation time or number of chains (grep \"acceptance\": 0 hits in v1 and v2). (2) The energy is printed as E0 = -48.18(0) (v2 Sec. III text and Fig. 5 caption; v1 Fig. 12 caption \"E_chi0 = -48.18(0)\") while the five other 108-site states in the same figure carry (3), (4), (5), (7), (8): a statistical error rounding to zero at the 0.01 level from 2^13 samples is what identical, frozen samples produce, so the printed (0) is evidence for the defect rather than a usable sigma. The 48-site run with the exchange sampler carries a normal error, -21.00 +/- 0.01 (Sec. III). (3) Nothing has changed since the Comment: arXiv:2401.02866 has v1 (5 Jan 2024) and v2 (9 Mar 2025, the PRX text, dated March 11, 2025), both with -48.18(0) and the same sampler sentence; the Comment arXiv:2605.28861 has only v1 (21 May 2026, sources/2605.28861.txt: acceptance exactly zero beyond 5000 iterations, Fig. 1(a); exchange-update optimisation of the same 4x4 GCNN converges to E ~ -45.6 vs DMRG -47.3, spin-flip-trained parameters re-evaluated ergodically give E ~ -42.6, Fig. 1(b); split-R-hat 1.39 frozen vs 1.03 ergodic; numerics in the (Gamma, chi0) sector, argued to carry over to (M, chi0)). No Reply exists: arXiv API au:Duric AND au:Sengupta lists only 2401.02866v2, 2512.11670 and 2606.14101 (sources/arxiv_api_duric_sengupta.xml); Crossref record of 10.1103/PhysRevX.15.011047 has empty updated-by (no erratum) and a bibliographic search for the Comment title returns no PRX Comment or Reply (sources/crossref_prx15_011047.json, crossref_comment_search.json); none of the 16 OpenAlex citing works is a Reply (sources/openalex_citing_prx15_011047.json). No code repository: GitHub repository search on seven title/author/method queries returns 0 hits and no author handle with public repositories; the paper has no code or data availability statement. The authors later preprint arXiv:2512.11670 (1/9 plateau, same 108-site cluster) keeps the unconstrained single-spin-flip scheme (sources/2512.11670.txt lines 416-433) and does not revisit -48.18. (4) Flag stands as written: the row keeps bound_type variational (it is what the method claims) and is skipped for the record under RULES.md 6.1 and 10 (non-ergodic sampling clause).",
    "source_entry": "FP3-arxiv-2401-02866#0 (qmbl-verify 2026-09-19-flagged)",
    "shared": "sampling-nonergodic:kagome-108"
  },
  {
    "match": {
      "instance": "Hubbard/square_64_P_32_8",
      "method": "Transformer backflow + MARCH optimizer"
    },
    "flag": "below-exact-suspected",
    "finding": "E/N = -0.52582 (total -33.65248) is printed identically, always without an error bar, in arXiv:2507.02644v1 Table S4 (p. 46), v2 Table S1 (p. 33) and Nature Communications 17, 7838 (2026) Supplementary Table 1 (p. 2, file 41467_2026_74028_MOESM1_ESM.pdf via Europe PMC PMC13439271); the main text (p. 8 / PMC full text) only says the NQS energies are 'consistent with the AFQMC results within twice the statistical errors', i.e. Qin's bar. No sigma exists anywhere: the journal Data Availability statement says 'the figures and tables shown contain all the available data' (no Source Data file; the Europe PMC supplementary bundle holds only the SI PDF, the peer-review file and figure images), and the released code (CodeOcean capsule 8740417, DOI 10.24433/CO.9301616.v1 = v2, tree 010f28f0) ships no logs or energies; its evaluation script hubbard/test.py (optimizer 'energy') writes only 'Energy: <mean> Variance: <var>' of the pooled local energies to result.txt, never a standard error, and the training log keeps loss/pmove/variance/lr per step. The capsule README documents exactly this run (L1 = L2 = 8, --fermions 64 -> 32 up + 32 down, --boundary1/2 pbc, U default 8, t = 1, hamiltonian.py H = -t sum c+c + U sum n_up n_dn with no shift), so instance, boundary, filling and coupling match. Against the stored VarBench AFQMC row -33.642(5) the NQS sits 0.01048 total = 1.64e-4 per site below, 2.10 sigma of that bar; against Qin, Shi & Zhang PRB 94, 085103 Table IV (8x8, U = 8, PBC) -33.68(3) it sits 0.02752 total = 4.3e-4 per site ABOVE, 0.92 sigma; the two exact rows differ by 0.038 = 1.25 sigma (combined), so they are consistent and their weighted mean -33.6430(49) puts the NQS 1.92 sigma below. The VarBench value is not in PRB 94, 085103: VarBench history shows it uploaded by Yiqi Yang on 2022-03-16 (commit b1b88c1) with no reference, 'TODO: ask Shiwei' on 2024-07-11 (b1a1a26), and the PRB link attached by Yiqi Yang in PR #23 on 2024-08-06 (3f160a4); its method string 'Metropolis, Trotter error extrapolated' is the VarBench-paper AFQMC (Wu et al., Science 386, 296 (2024), arXiv:2302.04919, Suppl. S3 E 2, co-authors Yiqi Yang and Shiwei Zhang), a separate computation of the same instance. Not established either way: a 2.1 sigma violation of a variational bound against one exact estimate, 0.9 sigma inside the other, with the NQS statistical error unknown. The flag stays on this row; the AFQMC row needs a reference correction, not a flag (see the correction entry on it). It holds nothing either way: no sigma, eligible for nothing (RULES.md 6).",
    "source_entry": "FP4-arxiv-2507-02644#0 (qmbl-verify 2026-09-19-flagged)"
  },
  {
    "match": {
      "instance": "Hubbard/square_64_PA_32_6",
      "method": "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16. Single hidden layer fully connected net with alpha = 1). Soft mean-field constraint for Neel order."
    },
    "flag": "below-exact",
    "finding": "No version of the paper prints -42.676, -0.6668 or -0.66681 for any lattice. The only arXiv versions are v1 (19 Nov 2021) and v2 (18 Jun 2022; abs-page submission history). v1 contains no numeric energy tables and no L x L half-filled runs (4xL only). v2 SI Table V (p. 21) and PNAS SI Table 5 (p. 9), row L = 8, column U = 6, both print -0.6574(2) per site (8x8, half filling, periodic along one side, anti-periodic along the other) = -42.0736 total, sigma 0.0128; of the 131 parenthesised numbers in the SI exactly two cells differ between v2 and PNAS (4x8 PBC-OBC -0.7309(6) -> -0.7350(6); 6x6 U = 8 -0.5289(3) -> -0.5270(3)), neither of them this cell. The paper's own SI Fig. 4 (p. 7, relative error to AFQMC of Ref. 47 = Qin, Shi & Zhang PRB 94, 085103 vs 1/L^2) plots the U = 6 point at 1/L^2 = 1/64 at about +0.22e-2, which is (42.17 - 42.0736)/42.17 = 2.3e-3 from the printed table and AFQMC -42.17(2) (Table IV, 8x8 PBC-APBC); the stored value would be -1.2e-2, below AFQMC and off the figure. The paper's 8x8 setting (SI Sec. 6: N~ = 16, alpha = 1 for 8x8) matches the row's method string, so the row is the right instance with the wrong digits. The value entered VarBench in commit c810bdc (jrm874 = first author, 2022-07-16 16:50 PDT, 'first upload') as -42.676 | 0.007 | 0.82(1) together with the other three 8x8 files, whose totals match the paper (-76.162 -> -1.190031 vs -1.1900(2); -55.18 -> -0.862188 vs -0.8621(4); -33.57 -> -0.524531 vs -0.5244(6)); it was never edited afterwards (107dd73 DOF, abd23ae Einf, 37648ad rename, 66642cd method typo, b1a1a26 reference) and upstream main (390a21e, 2024-10-22, unchanged on 2026-09-19) still carries it. A single-digit slip of the author's raw total, -42.076 -> -42.676, is the only reading consistent with every printed digit (-42.076 / 64 = -0.657438 rounds to -0.6574; the printed cell admits any total in [-42.0768, -42.0704]); it cannot be confirmed because no raw data exist outside the paper (PNAS Data Availability: 'All study data are included in this article and/or SI Appendix'; jrm874/1st_quantized_fermions is an example script without data). Sigma 0.007 and variance 0.82(1) are upload-only values with no printed counterpart. The paper value is already carried as row 1 of this instance (-42.0736, sigma 0.0128). Flag stands as written; the row cannot be corrected to a guessed total.",
    "source_entry": "FA1-10-1073-pnas-2122059119#1 (qmbl-verify 2026-09-19-flagged)"
  },
  {
    "match": {
      "instance": "Hubbard/square_36_PA_18_2",
      "method": "VMC Hidden Fermion Determinant State Ansatz (N_hidden = 16. Single hidden layer fully connected net with alpha = 1). Soft mean-field constraint for Neel order.",
      "energy": -76.162
    },
    "flag": "wrong-instance",
    "finding": "The row is the 8x8, U = 2 upload copied into the 6x6, U = 2 file. VarBench commit c810bdc (jrm874 = Javier Robledo Moreno, 2022-07-16 16:50 PDT, 'first upload') created Hubbard/square_8_AP_32_32_2.md with -76.162 | 0.006 | 0.14(2); commit 21f00e5 (same author, 17:57 PDT, 'upload square_6_AP_18_18') created square_6_AP_18_18_2.md with the identical line, while the three sibling files of that commit carry genuine 6x6 totals (-31.3822, -23.794, -18.9738 = -0.871728, -0.660944, -0.527050 per site; PNAS SI Table 5 row L = 6 prints -0.8717(2), -0.6609(4), -0.5270(3)). No later commit touched the value: 107dd73 (DOF), abd23ae (Einf), 37648ad (rename to square_36_PA_18_2.md), 66642cd ('Hiden' -> 'Hidden'), b1a1a26 (reference URL); upstream main is still 390a21e (2024-10-22) and raw.githubusercontent.com/varbench/varbench/main/Hubbard/square_36_PA_18_2.md still reads -76.162 on 2026-09-19. The paper prints -1.2079(1) per site for L = 6, U = 2 (PNAS SI Table 5, p. 9, row L = 6, column U = 2; arXiv:2111.10420v2 SI Table V, p. 21, identical cell) = -43.4844 total, sigma 0.0036, which the table already carries as row 1 of this instance; -76.162 / 64 = -1.190031 is the L = 8, U = 2 cell -1.1900(2) of the same table. arXiv v1 (19 Nov 2021) has no L x L half-filled data at all (4xL only, no numeric tables), so no version prints anything near -76.162 or -2.1156 per site for 36 sites. -76.162 on 36 sites is 16.449 below the U = 0 ground state of this lattice (-59.712813) and 32.663 below sign-free AFQMC -43.499(2) (Qin, Shi & Zhang, PRB 94, 085103, Table IV, 6x6 PBC-APBC U = 2). No author data repository exists to check against: the PNAS Data Availability statement says 'All study data are included in this article and/or SI Appendix', and the uploader's only related GitHub repository (jrm874/1st_quantized_fermions, 7 commits on 2022-04-14) is a 4x4 U = 10 example script with no data files. Flag stands as written.",
    "source_entry": "FA1-10-1073-pnas-2122059119#0 (qmbl-verify 2026-09-19-flagged)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_36_O",
      "method": "PEPS, gradient optimization (GO) after SU initialization, D=8, Dc=16 (finite, open-boundary 6x6 cluster)",
      "energy": -86.907312
    },
    "flag": "below-exact",
    "finding": "Correctly transcribed from arXiv:1611.09467v3 (posted 2017-05-04; the accepted version of Phys. Rev. B 95, 195154, received 2016-12-11, published 2017-05-24) Table II, row 'D=8', column 'L=6': -0.603523(1) per site, read in three extractions (pypdf layout, pypdf plain, pdftotext -layout) and on a 300 dpi render of page 5. It sits 1.17e-6 per site (1.68e-4 total) below the instance's exact energy -0.6035218345 (VarBench ED, uploaded by Dian Wu 2022-08-23 with the instance, unchanged since; ed_ls.py, lattice_symmetries, S^z = 0, all point-group sectors 0), 8.3e-7 below Sandvik's SSE -0.60352217(17) (this instance, J. Stat. Mech. 2026 Table 2) and 1.17e-6 below the paper's own L=6 reference, Huang et al.'s 4096-state DMRG, printed as -0.6035218 with the citation superscript 34 (Table II 'Exact'; primary: E = -21.7267859 total, arXiv:1611.09574 Fig. 4 caption, = -0.60352183 per site). That is 1.2 printed sigma (0.8 sigma combined with the SSE bar): below the 3 sigma of RULES.md 9.4, so not a validator violation, but as stored the row lies below every exact-level reference and would otherwise be listed as the instance's best variational bound (6.1). The printed '(1)' is the Monte Carlo sampling error only: the paper's only statements about errors are 'The MC sampling error is order of 10^-6' (Fig. 5 caption) and 'The error bars are too small to show' (Fig. 3 caption); the bond-dimension-cut-off systematic is treated separately in Appendix A, which tests D=8 on 10x10 (Dc=16 against Dc=20: 'absolute error 8x10^-6') and 4x6 at J2=0.5, never 6x6, and is not folded into any bar. No convention shift can produce a 1e-6 dip: H = J1 sum S_i.S_j with S_i.S_i = 3/4 (Eq. 7), energies per site; the paper's 4x4 'Exact' -0.57432544 (Table I) is reproduced by a local S.S exact diagonalization to 1.6e-9 (checks/peps-4x4-open-ed/ed_4x4_open.py: -0.5743254416), a per-bond mislabel (60 bonds) would move the value by a factor 60/36 and an S.S-1/4 shift by 0.4167 per site. Against the paper's own accuracy trend the cell is anomalous as well: GO at D=8 has relative error +1.1e-5 on 4x4, +1.3e-5 on 4x6 (J2=0) and +2.4e-4 on 10x10 (Table I, every cell above its exact value), so a 6x6 D=8 energy within 2e-6 of the exact value, let alone below it, is at least 1e-5 per site outside that trend. Version history: v1 (2016-11-29) and v2 (2016-12-13) print this cell as -0.6034(3) and -0.6034(8), above the exact value; v3 replaced Table II with re-optimised runs and 1e-6 bars. The authors released their tensor library (github.com/Shaojun-Dong/libTNSP, TNSPackage, Comput. Phys. Commun. 228, 163) but no PEPS-GO run scripts, tensors or energies for this paper; the PRB full text is paywalled and unread. Whether the dip is the truncated boundary-MPS contraction entering the local-energy ratios W(S')/W(S) differently from the weights (the estimator is a Rayleigh quotient of a well-defined state only if both use the same truncated contraction, which the paper does not state), a minimum taken over the noisy GO trace (Fig. 2(b) shows a 5e-4 band on 10x10), or a misprint, cannot be decided from the sources; the authors' final-measurement output for the 6x6 runs, or an exact re-contraction of their D=8 tensors (feasible at 6x6), would settle it.",
    "source_entry": "FP2-arxiv-1611-09467#0 (qmbl-verify 2026-09-19-flagged)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_36_O",
      "method": "PEPS, gradient optimization (GO) after SU initialization, D=10, Dc=20 (finite, open-boundary 6x6 cluster)",
      "energy": -86.90904
    },
    "flag": "below-exact",
    "finding": "Correctly transcribed from arXiv:1611.09467v3 (posted 2017-05-04; the accepted version of Phys. Rev. B 95, 195154, received 2016-12-11, published 2017-05-24) Table II, row 'D=10', column 'L=6': -0.603535(1) per site, read in three extractions (pypdf layout, pypdf plain, pdftotext -layout) and on a 300 dpi render of page 5; the cell first appears in v3 (v1 and v2 have no D=10 row). It sits 1.32e-5 per site (1.90e-3 total) below the instance's exact energy -0.6035218345 (VarBench ED, Dian Wu 2022-08-23, lattice_symmetries, S^z = 0, all point-group sectors 0, unchanged since), 1.28e-5 below Sandvik's SSE -0.60352217(17) and 1.32e-5 below the paper's own L=6 reference, Huang et al.'s 4096-state DMRG printed as -0.6035218 with the citation superscript 34 (primary: -21.7267859/36 = -0.60352183, arXiv:1611.09574 Fig. 4 caption). That is 13.2 printed sigma (12.7 combined with the SSE bar), a violation of RULES.md 9.4 by any reading, and cannot be sampling noise at the printed bar. The '(1)' is the Monte Carlo sampling error only ('The MC sampling error is order of 10^-6', Fig. 5 caption; 'The error bars are too small to show', Fig. 3 caption); the cut-off systematic is treated separately in Appendix A, whose only number, 'absolute error 8x10^-6' between Dc=16 and Dc=20, is for D=8 on 10x10 and is 1.6x smaller than this dip; D=10/Dc=20 and the 6x6 cluster are not tested there, so the paper gives no accuracy claim that covers this cell. It does not comment on the L=6 cells lying below its own 'Exact' row; Sec. IV calls the agreement 'remarkable', Table III claims relative error ~1e-4 for MC+GO. No convention shift applies: H = J1 sum S_i.S_j, S_i.S_i = 3/4 (Eq. 7), per site; Table I's 4x4 'Exact' -0.57432544 is reproduced by a local S.S exact diagonalization to 1.6e-9 (checks/peps-4x4-open-ed/ed_4x4_open.py); a per-bond mislabel (60 bonds) would change the value by a factor 60/36 and an S.S-1/4 shift by 0.4167. Against the paper's own trend the cell is off by at least 2e-5 per site: GO at D=10 has relative error +4.2e-6 on 4x4, +2.5e-6 on 4x6 (J2=0) and +8.7e-5 on 10x10 (Table I and the text of Sec. IV, all above their exact values), whereas this cell is -2.2e-5; the D=8 to D=10 change at L=6 (-1.2e-5) has the size of the genuine improvements at L=8..16 (-2.0e-5 to -9.4e-5), but at L=6 the D=8 value already sits at the exact energy and there is no room below it. The authors' public code (github.com/Shaojun-Dong/libTNSP, the TNSPackage library) contains no PEPS-GO run scripts, tensors or energies for this paper; the PRB full text is paywalled and unread. The three candidate causes (truncation entering the local-energy ratios W(S')/W(S) differently from the sampling weights so the estimate is not a Rayleigh quotient; a minimum over the noisy GO trace, cf. the 5e-4 band of Fig. 2(b); a misprint, e.g. of -0.603515) cannot be told apart from the sources. The authors' final-measurement output for the 6x6 D=10 run, or an exact re-contraction of their tensors, would settle it.",
    "source_entry": "FP2-arxiv-1611-09467#3 (qmbl-verify 2026-09-19-flagged)"
  },
  {
    "match": {
      "instance": "TFIsing/chain_10_O_1",
      "method": "1D LRU (linear recurrent unit) NQS, iterative retraining from cold start"
    },
    "flag": "below-exact",
    "finding": "E/N = -1.2381549(7) (arXiv:2605.13807v1, Table I, row N = 10, column e_1DLRU(N); the only arXiv version, submitted 2026-05-13, PDF byte-identical to the cached copy) against e_exact(10) = -1.2381490 printed in the same row: 5.90e-6 per site, 8.4 sigma, below an exact value the paper itself derives from [1 - csc(pi/(2(2N+1)))]/N and that its released code recomputes with the same formula (PSR-NQS/lru_1d/run_training.py line 22-23, exact_obc_critical_energy_density) for the same Hamiltonian H = -sum sz sz - h sum sx, J = -1, h = 1, open chain (run_training.py 282, 318-319; vmc_utils.py 12-13, 28). Stored total -12.381549 +/- 0.000007 = 10 x per-site value, matches the instance exact row -12.38148999965 to 7 digits. The released code shows what the number is: run_training.py 189-230 evaluates the model state at the END of training with 1000 x 1024 = 1,024,000 fresh autoregressive samples and writes energy_mean and energy_error_of_mean = sqrt(Var/1024000) to final_stats.csv; the Table I caption says the same. A 1024-sample training-step bar would be sqrt(1000) = 31.6x larger (2.2e-5 per site, printed as (2) at five decimals), so the printed (7) is the final-estimate standard error, not a per-step one. The lowest_energy checkpoint (run_training.py 52-58, 141-160, UCB rule after half the steps) is saved but never restored; the reported energy is not a minimum over the optimization trace, and the mechanism established for the VarBench RBM (alpha = 1) row on this instance does not apply here (that dip would be ~4 sigma_step = 9e-5 per site, 15x deeper than observed, with a 30x wider bar). Samples are exact autoregressive draws (wvfn_1d.py 116-151, log_softmax conditionals, categorical sampling), so no autocorrelation correction is missing either. With a normalized causal ansatz (checked: the parallel path shifts inputs by one site and skip-adds the unshifted input, ssm_1d.py 108-112, ssm_blocks.py 50-55, identical to the sampler loop at wvfn_1d.py 134-149) and consistent psi evaluations, the estimator is unbiased and 8.4 sigma below E0 has probability ~1e-17: the printed value cannot come from the released procedure unless the two psi evaluations it mixes disagree. They are different code paths: the denominator psi(sigma) is the sampler sequential recurrence (run_training.py 200-201, model.log_psis(samples, clp)), the N numerators psi(sigma^i) are a parallel associative-scan forward pass (vmc_utils.py 22-24, parallel=True). A mismatch delta between them enters as exp(delta) and biases the field term downward (Jensen); an rms mismatch of ~4e-3 in log psi would reproduce the N = 10 dip. The repository sanity check never tests this: benchmark_trainstep_vs_L_1D_lru.py 280-292 passes clp into both sides of the sampled-input comparison, as its own comment admits. Not run here (out of scope for this pass); no results, logs or CSVs were ever committed (27 commits, 1D code in one commit 8335644 of 2026-05-12). Whatever the mechanism, the same column has two more sub-exact entries (N = 24: -1.57e-5, 15.7 sigma; N = 32: -5.92e-5, 29.6 sigma) and two entries within 1 sigma of exact (N = 8, N = 128), so the printed bars understate the true uncertainty of the column by an order of magnitude; the paper and the script both print the relative error unsigned (rel_err = abs(E - exact)/abs(exact), run_training.py 221), which is why the sign flips went unnoticed and Table I text reads the non-monotonic error as optimization noise. The flag stands; the row holds no record. Corrections: the RBM-rerun diagnosis attached to this row through SHARED[\"below-exact\"] in scripts/defects.mjs is about a different row and must come off (separate correction entry).",
    "source_entry": "FP5-arxiv-2605-13807#0 (qmbl-verify 2026-09-19-flagged)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_64_P",
      "method": "HQT (Ours)"
    },
    "flag": "below-exact",
    "finding": "E/N = -0.6735 is the paper's own number: Table 2 (8x8 phase scan), row J2/J1 = 0.00, in arXiv:2607.00398v1 (HTML and PDF), identical in the ACM KDD '26 version (pp. 11028-11037) and in the commented-out earlier draft of Table 2 in the arXiv LaTeX source (sample-sigconf.tex line 563); the J2 = 0 point of Fig. 2(a) (e-print file Fig2_Phase_Diagram_8x8.jpg) digitises to -0.6733 +/- 0.0002 (checks/hqt-figure-readings/digitise_figs.out.txt). No error bar, sample count or iteration count for this point exists in the main text, the LaTeX source including its comments, the figures or the ACM version; the Table 2 caption only says the scan 'uses fewer samples per point than the high-precision benchmark (Table 1)'. The stored -172.416 sits 0.0025 (1.0e-5 per site in S.S units, not 1.3e-5) below the SSE row -172.4134528(51). The print precision is 1e-4 per site: every value in [-0.67349005, -0.67345] rounds to the same '-0.6735', so the printed digits do not place the state below the ground state, and without a sigma they cannot place it above either (RULES 9.4 counts the gap past a relative 1e-8 when no sigma is stated). The variance printed for the point, sigma^2_{E/N} = 0.0005 (Table 2), disagrees with Fig. 2(a), where the same point plots at 0.0020, and sigma^2_{E/N} is defined nowhere (Var(H)/N, Var(H/N) or per-sample), so no sigma can be derived from it. Flag stands as a statement about the stored digits against the exact row. Note for scripts/defects.mjs: the per-flag diagnosis attached to 'below-exact' ('alpha=1 complex RBM, 2000 SR steps ... checks/tfising_rbm_check.py') describes the TFIsing RBM rerun and is displayed on this row, which it does not describe.",
    "source_entry": "FP1-arxiv-2607-00398#0 (qmbl-verify 2026-09-19-flagged)"
  },
  {
    "match": {
      "instance": "Heisenberg/square_64_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -172.4172032
    },
    "flag": "sigma-understated",
    "finding": "The printed bar, 2e-7 per site, is the standard error of the mean of 1000 bootstrap refits (authors' notebook, cell 13), not the spread of the refits, 6.6e-6 per site. Against Sandvik's SSE energy on this instance the row sits 73 printed sigma below, 2.2 of the bootstrap spread below."
  },
  {
    "match": {
      "instance": "Heisenberg/square_100_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -268.638
    },
    "flag": "sigma-understated",
    "finding": "The printed bar, 5e-7 per site, is the standard error of the mean of 1000 bootstrap refits (authors' notebook, cell 13), not the spread of the refits, 1.5e-5 per site. Against Sandvik's SSE energy on this instance the row sits 85 printed sigma below, 2.9 of the bootstrap spread below."
  },
  {
    "match": {
      "instance": "Heisenberg/square_144_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -386.3236608
    },
    "flag": "sigma-understated",
    "finding": "The printed bar, 1e-7 per site, is the standard error of the mean of 1000 bootstrap refits (authors' notebook, cell 13), not the spread of the refits, 3.6e-6 per site. Against Sandvik's SSE energy on this instance the row sits 185 printed sigma below, 5.2 of the bootstrap spread below."
  },
  {
    "match": {
      "instance": "Heisenberg/square_196_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -525.5224128
    },
    "flag": "sigma-understated",
    "finding": "The printed bar, 5e-7 per site, is the standard error of the mean of 1000 bootstrap refits (authors' notebook, cell 13), not the spread of the refits, 1.5e-5 per site. Against Sandvik's SSE energy on this instance the row sits 154 printed sigma below, 5.0 of the bootstrap spread below."
  },
  {
    "match": {
      "instance": "Heisenberg/square_400_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -1071.5872
    },
    "flag": "sigma-understated",
    "finding": "The printed bar, 6e-7 per site, is the standard error of the mean of 1000 bootstrap refits (authors' notebook, cell 13), not the spread of the refits, 1.5e-5 per site. Against Sandvik's SSE energy on this instance the row sits 37 printed sigma below, 1.5 of the bootstrap spread below."
  },
  {
    "match": {
      "instance": "Heisenberg/square_576_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -1542.7876608
    },
    "flag": "sigma-understated",
    "finding": "The printed bar, 5e-7 per site, is the standard error of the mean of 1000 bootstrap refits (authors' notebook, cell 13), not the spread of the refits, 1.6e-5 per site. Against Sandvik's SSE energy on this instance the row sits 17 printed sigma below, 0.5 of the bootstrap spread below."
  },
  {
    "match": {
      "instance": "Heisenberg/square_784_P",
      "method": "2D RNN wavefunction, zero-variance extrapolation",
      "energy": -2099.733888
    },
    "flag": "sigma-understated",
    "finding": "The printed bar, 4e-7 per site, is the standard error of the mean of 1000 bootstrap refits (authors' notebook, cell 13), not the spread of the refits, 1.3e-5 per site. Against Sandvik's SSE energy on this instance the row sits 33 printed sigma below, 1.0 of the bootstrap spread below."
  },
  {
    "match": {
      "instance": "tV/square_64_P_32_4",
      "method": "QMC (continuous-time expansion)",
      "energy": -9.7906046108775
    },
    "flag": "exact-above-variational-bound",
    "finding": "Stored -9.7906 +- 0.166 sits 0.458 ABOVE the variational DMRG row -10.2486 (2.76 sigma) and 0.430 above Hartree-Fock (2.59 sigma), which an unbiased ground-state estimate can only do by fluctuation. The committed h5 is a second run of the same estimator: -10.0373 +- 0.1194, again 1.77 sigma above DMRG; the two runs combined, -9.953 +- 0.097, are 3.05 sigma above. On that h5 the vertex-count estimator (KinE + IntE2, error 20x smaller) gives -10.2491 +- 0.0069, 0.08 sigma from DMRG: the projection and the sign are fine and E0 is about -10.249; it is the single-random-site Wick Energy estimator whose error bar is understated at V = 4 (per-measurement variance 1096, binning reports no autocorrelation where the vertex observables show tau = 137). Below the 3 sigma of RULES.md 9.4, so not a validator issue; held off the record at its stated sigma."
  }
];

export const SHARED = {
  "sampling-nonergodic:kagome-108": {
    "diagnosis": "The reported energy is an artifact of non-ergodic Monte Carlo sampling, not a property of the ansatz. The kagome Heisenberg Hamiltonian is SU(2) symmetric and its ground state lies in a fixed total-magnetisation sector, so a single-spin-flip update - which changes S^z_tot - is incompatible with the symmetry. As the network concentrates on the physical S^z_tot = 0 sector the acceptance rate collapses to exactly zero beyond 5000 iterations and the chains freeze, so the reported average is taken over a non-representative set of configurations. With the magnetisation-preserving exchange update the same architecture and optimizer converge stably to E ~ -45.6 against a DMRG value of E ~ -47.3; re-evaluating the spin-flip-optimised PARAMETERS under ergodic sampling raises the energy further, to E ~ -42.6. The published -48.18 lies below all of them.",
    "ruled_out": "NOT a variational-principle violation, and that is the point: DMRG at finite bond dimension is itself an upper bound, so an energy below it is not on its own evidence of error - it would ordinarily just be a better state. Nothing about the number alone identifies it as wrong. The refutation had to come from the sampler.",
    "evidence": "arXiv:2605.28861 (Kamal, Kufel, Vu, Laumann & Yao), Fig. 1(a) acceptance-rate collapse and Fig. 1(b) energy convergence; Ðurić et al., Phys. Rev. X 15, 011047 (2025), arXiv:2401.02866, Sec. IV."
  },
  "energy-variance-inconsistent:hqt-8x8": {
    "diagnosis": "The reported energy is inconsistent with the paper's OWN reported variance. At 8x8 the claimed E/N = -0.5001 beats RBM+PP's -0.4989635 while the reported variance (sigma^2 = 1.4e-3 per site, S.S units) gives a V-score of 5.6e-3 against RBM+PP's 9.81e-4 - 5.7x worse. Energy and variance move together - a state further from an eigenstate cannot be lower in energy - so by the V-score calibration this energy should be ~1.2e-3 higher than claimed.",
    "ruled_out": "NOT 'below the exact ground state'. There is no exact reference at 8x8 or 10x10: ED for this model reaches about 6x6, and the paper correctly uses 6x6 ED (-0.5038) as its only exact anchor. Chen & Heyl's -0.497715(9) is a zero-variance extrapolation, not a bound, so a lower variational energy would only mean the extrapolation carries systematic error. The sigma^2 is per site, so the V-score is 5.6e-3 and not a range. Separately, the paper is internally inconsistent about it: Table 1 gives sigma^2 = 1.4e-3 for the 8x8 run while the J2 scan lists 0.0034 at J2 = 0.50, which would make the V-score 1.4e-2 and the contradiction larger.",
    "evidence": "arXiv:2607.00398 Tables 1-3; V-scores recomputed from this instance's own rows."
  },
  "below-exact:varbench-rbm-rerun": {
    "diagnosis": "The three values were entered in VarBench commit 6e7a021 (Dian Wu, 2023-01-09, 'Update Ising Jastrow and RBM baselines', no code, no log), replacing uploads that sat above the exact energy: chain_10_P_1 -12.784707(48) and chain_10_O_1 -12.381447(21) of 2022-12-12 (77a95d7; 4.2 and 2.0 sigma above), while chain_32_P_0.5 was below exact in both its uploads (2022-07 and 2023-01). The linked program, programs/vmc_netket in varbench/methods, was written in July 2024 (IsingJax and VMC_SRt did not exist in January 2023) and the links were attached on 2024-07-30 (5047bfd) without regenerating a number. Run as pinned (NetKet 3.13.0, jax 0.4.30, seed 123, CPU, 2026-09-19) the script gives -12.784382(65), -12.381393(27) and -34.03197(10): all above the exact energies, with full summation of the same parameters at -12.784376 and -12.381411 and five repeated 2^20-sample estimates scattering around them (tau_corr ~ 0, R_hat 1.0005). The stored sigmas equal sqrt(stored variance / 2^20), so the stored numbers are final 2^20-sample estimates of a better-converged 2023 state (variance about half of the rerun's) whose bias below the exact energy no published source explains.",
    "ruled_out": "Not a minimum of the optimisation trace: the program prints a separate final estimate, the per-step noise (2.2e-3, 8.9e-4, 3.1e-3 at 1024 samples) is 40x the stored bars, and the trace minima lie about 1e-2 below the exact energy, not 2-3e-4. Not an unthermalised restart of the sampler: the chains persist into the final estimate, and a fresh restart biases the estimate upward (seen on the 32-site evaluation). Not float32 local energies: the local energy is accumulated in float64 with float32 amplitude ratios. The 2026-09-11 check (checks/tfising_rbm_check.py: complex RBM, netket 3.22.4, 2000 steps) ran a different program and is withdrawn as a diagnosis.",
    "evidence": "VarBench dataset commits 77a95d7, 6e7a021, 5047bfd; varbench/methods programs/vmc_netket/vmc.py (1347303, c686621, bba4595); checks/tfising-rbm-varbench-rerun/ (run.sh, run.log, *.eval.json, trace_summary.json); the first rerun, checks/tfising_rbm_check.py, for the withdrawn diagnosis."
  },
  "trace-readout:hqt-10x10": {
    "diagnosis": "The energy is read off the optimisation trace (Fig. 3, 110 iterations on 10x10: 50 with the backbone frozen, 60 unfrozen) with an error bar the authors describe as sampling fluctuation only; the digitised tail (iterations 80-109) has mean -0.497813 and standard deviation 2.4e-5, the last iterate is -0.497827. The arXiv LaTeX source's commented-out earlier draft reports -0.4960 for the same protocol.",
    "ruled_out": "Not a variance inconsistency: no variance is printed for 10x10. Not proof of error: there is no exact reference at 10x10, so a number 1.3e-4 below the best variational energy and 1.0e-4 below the zero-variance extrapolation is grounds for objection only.",
    "evidence": "arXiv:2607.00398v1 Sec. 3.4 and Fig. 3; e-print sample-sigconf.tex lines 608-623; checks/hqt-figure-readings/ (digitise_figs.py and its output)."
  }
};
