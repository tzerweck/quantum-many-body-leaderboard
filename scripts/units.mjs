// Unit and bookkeeping conventions for the VarBench schema.
// Getting these wrong is the single most likely source of a wrong record,
// so every rule here is stated once and reused rather than inlined per script.

export const SPIN_MODELS = new Set(["Heisenberg", "J1J2", "TFIsing"]);

// Is the reported energy a Monte-Carlo estimate, or a deterministic contraction?
// RULES.md 6 requires a stated sigma before a row can hold a record, but that rule
// only makes sense for a sampled energy. DMRG at a stated bond dimension, exact
// diagonalization and statevector circuits carry no statistical error at all, and
// 144 of the 399 variational rows are of that kind - requiring sigma of them would
// vacate more than half the table's records over a field that cannot exist.
// Deterministic is asserted by explicit markers; everything else counts as sampled.
// A method string that is only "HF" is the Hartree-Fock energy a paper prints beside its
// own (arXiv:2210.05871, Tables 1 and 2). "HB K = 0 (HF)" is not: the HB paper samples its
// K = 0 state like every other depth (arXiv:2606.00924, Table II caption, "sampling errors
// are around 0.0003"), so the bare abbreviation matches only as the whole string.
const DETERMINISTIC = /\bdmrg\b|\bmps\b|\bpeps\b|\bmera\b|tensor network|statevector|exact diagonaliz|exact solution|bethe ansatz|hartree|mean[- ]field|truncation error|bond dimension|\bfci\b|full configuration|^HF$/i;
export const isSampled = method => !DETERMINISTIC.test(method || "");

// Did WE find any error metric for this row? Neither a sigma nor an energy variance
// turned up in the source that was read, so there is currently no way to judge how
// converged the number is.
//
// The claim is about our search, not about the authors. The figure may well be in a
// supplement, a companion paper, or the group's own records - which is exactly why the
// row is marked rather than demoted: the marker is an open question addressed to whoever
// can close it. Deliberately NOT a `defect`, which asserts a suspected error and
// withholds the record; RULES.md 3 says a missing field excludes nothing. `exact` rows
// are not marked - an exact diagonalization has no error to report, so nothing is
// missing there.
export const noErrorMetrics = r =>
  r.bound_type !== "exact" && r.sigma == null && r.energy_variance == null;

// Sector-resolved exact diagonalization, as VarBench labels it: "Exact Diagonalization
// 0.C1.A -1" is the lowest state in ONE symmetry sector, not the ground state, so an
// unconstrained variational energy may legitimately sit below it and it cannot stand in for
// the instance's exact energy. One regex, used by the record, the validator and the table
// matcher alike.
export const SECTOR_RESOLVED = /[A-Z][0-9a-z]*\.[A-Z]/;

// The one sector row that IS the ground state. J1J2/triangular_48_P_0.125 carries all 48
// (k.irrep, spin-flip) sectors of the Sz = 0 space from Wietek et al., PRX 14, 021010, whose
// App. B names Gamma.A1 (spin-flip +1) as the ground state; the qmbl-verify pass of
// 2026-09-15 confirmed the number against the paper's own upload, and Tristan ruled on
// 2026-09-16 (qmbl-verify DECISIONS.md, 3c) that this row stays and the other 47 move to a
// per-instance spectrum record. Until that move lands the row is named here, because the
// regex above cannot tell the ground-state sector from the others.
const RULED_GROUND_STATE = new Set(["Exact Diagonalization Gamma.D6.A1 1"]);

// Does this exact row state the ground-state energy, rather than a sector minimum?
export const groundStateExact = r =>
  r.bound_type === "exact" && (!SECTOR_RESOLVED.test(r.method || "") || RULED_GROUND_STATE.has(r.method));

// An exact row that states the instance's ground-state energy: exact diagonalization, an
// exact solution, or sign-problem-free QMC where that is established (RULES.md 4). Such a
// row IS the record wherever one exists (RULES.md 6): the answer outranks every claim
// about it. A flagged exact row is skipped like any other (6.1).
export const exactEligible = r => groundStateExact(r) && !r.defect;

// A row may hold its instance's VARIATIONAL record only if it is a strict variational
// bound, carries no unresolved defect (RULES.md 6.1), and - when its energy was sampled -
// states the error bar the tie rule needs (RULES.md 6). On an instance with an eligible
// exact row this decides the best variational bound, not the record.
export function recordEligible(r) {
  if (r.bound_type !== "variational" || r.defect) return false;
  return !isSampled(r.method) || r.sigma != null;
}

// VarBench writes spin Hamiltonians with PAULI matrices (sigma.sigma) and stores
// TOTAL energies. NQS papers quote E/N in the S.S convention. Factor 4 N_sites.
// Fermionic models (Hubbard, tV) are stored as totals; papers quote per site.
//
// TFIsing is the exception, and grouping it with the Heisenberg models was a factor-4
// error (found 2026-09-14). Its Hamiltonian is -sum s^z s^z - h sum s^x, already written
// in Pauli operators with no S.S term to rescale, so the per-site energy is E/N.
//
// This is checkable rather than a matter of opinion: TFIsing/chain_32_P_1 is the critical
// 1D transverse-field Ising chain, where the free-fermion ground state is exact. Summing
// -2 sqrt(h^2 - 2h cos k + 1) over the antiperiodic momenta k = pi(2n+1)/N reproduces the
// stored total -40.760032 to 7e-15, and E/N = -1.2738 sits just below the thermodynamic
// limit -4/pi = -1.2732, as it must for PBC at criticality. Under the 4N divisor the same
// instance read -0.3184, so every TFIsing cell in the literature missed by a factor of 4
// and the family could never produce a single match - which is most of why it shows
// 0 of 7 instances covered. scripts/validate.mjs asserts the identity on every run.
export function perSiteDivisor(inst) {
  if (inst.model === "TFIsing") return inst.n_sites;
  if (SPIN_MODELS.has(inst.model)) return 4 * inst.n_sites;
  if (inst.model === "Hubbard" || inst.model === "tV") return inst.n_sites;
  return null; // Impurity: no meaningful per-site energy
}

export function toPerSite(energy, inst) {
  const d = perSiteDivisor(inst);
  return d == null ? null : energy / d;
}

export function perSiteLabel(inst) {
  if (inst.model === "TFIsing") return "E/N (Pauli)";
  if (SPIN_MODELS.has(inst.model)) return "E/N (S.S)";
  return perSiteDivisor(inst) == null ? "E (total)" : "E/site";
}

// Degrees of freedom: spins for spin models, N_up + N_dn for fermions.
// VarBench filenames carry Nf = N_up = N_dn.
export function expectedDof(inst) {
  if (SPIN_MODELS.has(inst.model)) return inst.n_sites;
  // t-V is SPINLESS, so Nf is already the total particle number.
  if (inst.model === "tV") return inst.params?.Nf ?? null;
  if (inst.params?.Nf != null) return 2 * inst.params.Nf;
  return null;
}

// E_inf = Tr H / dim H. Zero for traceless spin Hamiltonians written in Pauli form;
// U * N_up * N_dn / N_sites for the Hubbard model.
export function expectedEinf(inst) {
  if (SPIN_MODELS.has(inst.model)) return 0;
  // Hopping terms are traceless, so a t' variant keeps the same E_inf; extra
  // density-density terms (V1, V2) do not, so those variants are excluded.
  if (inst.model === "Hubbard" && !/UV|V1|V2/.test(inst.instance_id)
      && inst.params?.U != null && inst.params?.Nf != null)
    return (inst.params.U * inst.params.Nf * inst.params.Nf) / inst.n_sites;
  return null;
}

export const vScore = (variance, dof, energy, einf) =>
  variance == null || !dof || einf == null || energy === einf
    ? null : (dof * variance) / (energy - einf) ** 2;
