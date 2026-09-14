// Triangular-lattice rows above L=6, from Roth, Szabo & MacDonald, "High-accuracy
// variational Monte Carlo for frustrated magnets with deep neural networks",
// Phys. Rev. B 108, 054410 (2023), arXiv:2211.07749, Table III.
//
// This closes the "triangular above L=6" gap, but not the way it was expected to. The
// obvious lead, arXiv:2505.20406, reports L=6..30 only in FIGURES - its tables carry
// V-scores and thermodynamic-limit values, neither of which is a row. The usable
// finite-size data was in a 2022 paper that no HTML sweep could see.
//
// How the table was read matters. Plain pypdf text renders a missing entry ("—") and a
// minus sign as the same character, so the columns could not be assigned unambiguously
// - exactly the failure the project's own method note warns about. Re-extracted with
// pypdf extraction_mode="layout", which preserves column positions, and only then read.
//
// The "Exact/Interpolated" column is NOT exact above 36 sites and is imported as
// `extrapolated`: the caption states those values come from the thermodynamic-limit
// estimate of Ref. [10] plus the exact 36-site energy, "assuming that finite-size
// effects scale as 1/L^3". That is an interpolation, not an achieved energy (RULES.md 4).
import fs from "node:fs";

const CHECKED = "2026-09-14";
const GCNN = { ref: "Roth, Szabo & MacDonald, High-accuracy variational Monte Carlo for frustrated magnets with deep neural networks, Phys. Rev. B 108, 054410 (2023), arXiv:2211.07749", pr: true };
const GRAPH = "Kochkov, Pfaff, Sanchez-Gonzalez, Battaglia & Clark, Learning ground states of quantum Hamiltonians with graph networks, arXiv:2110.06390 (2021)";
const IQBAL = "Iqbal, Hu, Thomale, Poilblanc & Becca, Spin liquid nature in the Heisenberg J1-J2 triangular antiferromagnet, Phys. Rev. B 93, 144411 (2016)";

const T3 = 'Read from Table III of arXiv:2211.07749 (J1-J2 triangular lattice, periodic, energies in units of J1 per spin, i.e. the S.S per-site convention), extracted from the PDF with pypdf in layout mode so the column positions are unambiguous.';
const INTERP = T3 + ' Column "Exact/Interpolated [10,63]". Per the caption this is NOT an exact energy above 36 sites: it is built from the thermodynamic-limit estimate of Ref. [10] and the exact 36-site energy, assuming finite-size effects scale as 1/L^3. Carried as `extrapolated` (RULES.md 4).';

const ADD = {
  "Heisenberg/triangular_108_P": {
    create: { model: "Heisenberg", lattice: "triangular", n_sites: 108, boundary: "P", params: {}, dof: 108, einf: 0 },
    rows: [
      { eps: -0.55315, err: 3e-5, m: "GCNN (deep group-equivariant CNN)", bt: "variational", primary: null,
        note: T3 + ' Row J2/J1 = 0, N = 108.' },
      { eps: -0.5519, err: 4e-4, m: "Graph neural network", bt: "variational", primary: GRAPH,
        note: T3 + ' Column "Graph NN [64]" at J2/J1 = 0, N = 108 = arXiv:2110.06390.' },
    ]},

  "J1J2/triangular_108_P_0.125": {
    create: { model: "J1J2", lattice: "triangular", n_sites: 108, boundary: "P", params: { J2: 0.125 }, dof: 108, einf: 0 },
    rows: [
      { eps: -0.51268, err: 9e-5, m: "GCNN + Lanczos step", bt: "variational", primary: null,
        note: T3 + ' Column "GCNN+LS" at J2/J1 = 1/8, N = 108. A Lanczos step on a variational state stays variational (RULES.md 4).' },
      { eps: -0.51175, err: 7e-5, m: "GCNN (deep group-equivariant CNN)", bt: "variational", primary: null, note: T3 + ' Row J2/J1 = 1/8, N = 108.' },
      { eps: -0.5069, err: 8e-4, m: "Graph neural network", bt: "variational", primary: GRAPH, note: T3 + ' Column "Graph NN [64]".' },
      { eps: -0.51297, err: null, m: "Thermodynamic-limit estimate interpolated to this size (1/L^3)", bt: "extrapolated", primary: IQBAL, note: INTERP },
    ]},

  "J1J2/triangular_144_P_0.125": {
    create: { model: "J1J2", lattice: "triangular", n_sites: 144, boundary: "P", params: { J2: 0.125 }, dof: 144, einf: 0 },
    rows: [
      { eps: -0.51218, err: 9e-5, m: "GCNN + Lanczos step", bt: "variational", primary: null, note: T3 + ' Column "GCNN+LS" at J2/J1 = 1/8, N = 144.' },
      { eps: -0.51101, err: 6e-5, m: "GCNN (deep group-equivariant CNN)", bt: "variational", primary: null, note: T3 + ' Row J2/J1 = 1/8, N = 144.' },
      { eps: -0.510558, err: 5e-6, m: "Gutzwiller-projected fermionic state + Lanczos step", bt: "variational", primary: IQBAL,
        note: T3 + ' Column "Gutzwiller+LS [10]" = Phys. Rev. B 93, 144411 (2016).' },
      { eps: -0.51275, err: null, m: "Thermodynamic-limit estimate interpolated to this size (1/L^3)", bt: "extrapolated", primary: IQBAL, note: INTERP },
    ]},
};

let added = 0, created = 0;
for (const [id, spec] of Object.entries(ADD)) {
  const p = `data/${id}.json`;
  const exists = fs.existsSync(p);
  const inst = exists ? JSON.parse(fs.readFileSync(p, "utf8")) : { ...spec.create, instance_id: id, rows: [] };
  if (!exists) { delete inst.dof; delete inst.einf; created++; }
  const r0 = inst.rows[0];
  const dof = r0 ? r0.dof : spec.create.dof;
  const einf = r0 ? r0.einf : spec.create.einf;
  const f = 4 * inst.n_sites;
  for (const r of spec.rows) {
    inst.rows.push({
      energy: +(r.eps * f).toPrecision(12),
      sigma: r.err == null ? null : +(r.err * f).toPrecision(6),
      energy_variance: null, dof, einf, v_score: null,
      method: r.m, bound_type: r.bt,
      bound_type_reason: "assigned during source verification (RULES.md 4)",
      reference: r.primary ?? GCNN.ref,
      peer_reviewed: r.primary ? null : GCNN.pr,
      source: "sweep-pdf-2026-09-14",
      provenance: r.primary ? "secondary" : "primary",
      verified: {
        checked_on: CHECKED,
        method: "arXiv PDF extracted locally with pypdf in layout mode, no LLM transcription",
        reported_as: `${r.eps}${r.err != null ? ` (+/- ${r.err})` : ""} per site in S.S units`,
        note: r.note, secondary_of: r.primary ? GCNN.ref : null,
      },
    });
    added++;
  }
  fs.mkdirSync(`data/${id.split("/")[0]}`, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} triangular rows (${created} new instances)`);
