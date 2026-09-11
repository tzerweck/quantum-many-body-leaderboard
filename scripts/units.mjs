// Unit and bookkeeping conventions for the VarBench schema.
// Getting these wrong is the single most likely source of a wrong record,
// so every rule here is stated once and reused rather than inlined per script.

export const SPIN_MODELS = new Set(["Heisenberg", "J1J2", "TFIsing"]);

// VarBench writes spin Hamiltonians with PAULI matrices (sigma.sigma) and stores
// TOTAL energies. NQS papers quote E/N in the S.S convention. Factor 4 N_sites.
// Fermionic models (Hubbard, tV) are stored as totals; papers quote per site.
export function perSiteDivisor(inst) {
  if (SPIN_MODELS.has(inst.model)) return 4 * inst.n_sites;
  if (inst.model === "Hubbard" || inst.model === "tV") return inst.n_sites;
  return null; // Impurity: no meaningful per-site energy
}

export function toPerSite(energy, inst) {
  const d = perSiteDivisor(inst);
  return d == null ? null : energy / d;
}

export function perSiteLabel(inst) {
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
