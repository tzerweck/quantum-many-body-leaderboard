// Rows from the all-results pass, 2026-09-15: every published finite-size ground-state
// energy the table harvest could map onto an instance, not only the ones that challenge a
// record. A 2017 simple-update PEPS 0.4% above the record is a row like any other; the
// database records what the field has published, and the leaderboard ranks what is eligible.
//
// Pipeline: `match_tables.mjs --all` banded 4586 cell-instance pairs from 44 cached papers;
// one reader per batch of papers mapped each distinct cell to an instance or rejected it;
// every row that claimed a record, sat below an exact value or was filed with low confidence
// was re-read by a second, adversarial reader (35 re-read, 22 refuted, most of them
// duplicates or the wrong boundary condition). The rows and their evidence are data, in
// sweep-rows-2026-09-15.json; this script only converts units and appends.
//
// What the reading caught, so the next pass does not repeat it:
// - site count is not geometry: an 8x32 cylinder and the 16x16 torus both have 256 sites;
// - a superscript citation glued onto the last digits (-1.1147 [44] read as -1.114744);
// - a comparison table's "Exact" column that is really DMRG at finite bond dimension;
// - quoted VarBench rows coming back under a second paper's name.
//
// The rows were read before the exactly solved batches of the same day landed, so the
// duplicate check runs here, against the tree as built, and reports what it skipped.
import fs from "node:fs";
import { perSiteDivisor, expectedDof, expectedEinf, vScore } from "./units.mjs";

const CHECKED = "2026-09-15";
const ROWS = JSON.parse(fs.readFileSync("sweep-rows-2026-09-15.json", "utf8"));
const REASON = {
  variational: "variational ansatz at a stated size; energy is an upper bound (assigned during source reading)",
  extrapolated: "zero-variance or bond-dimension extrapolation; not an upper bound (assigned during source reading)",
  projected: "projection (GFMC/fixed-node) on a trial state; not a strict variational bound (assigned during source reading)",
  exact: "numerically exact reference as stated by the source (assigned during source reading)",
};

const byInst = {};
for (const r of ROWS) (byInst[r.instance_id] ||= []).push(r);
let added = 0;
const skipped = [];
for (const [id, rows] of Object.entries(byInst)) {
  const p = `data/${id}.json`;
  const inst = JSON.parse(fs.readFileSync(p, "utf8"));
  const div = perSiteDivisor(inst);
  const dof = expectedDof(inst) ?? inst.rows[0].dof;
  const einf = expectedEinf(inst) ?? inst.rows[0].einf;
  for (const r of rows) {
    // A quoted exact value rounded to its error bar is the exact row already carried; any other
    // quoted value repeats a stored row only to its printed digits (Kochkov et al.'s -0.5022(4)
    // is not the 2048-state DMRG row 3e-4 away).
    const dup = inst.rows.find(x => Math.abs(x.energy / div - r.eps) <=
      (r.origin === "quoted" && r.bound_type === "exact" ? Math.max(r.tol, r.sigma_per_site ?? 0) : r.tol) &&
      ((r.origin === "quoted" && x.bound_type === r.bound_type) || x.method === r.method || (x.reference || "").includes(r.arxiv) ||
       (x.verified?.note || "").includes(r.arxiv) || (x.bound_type === "exact" && r.bound_type === "exact")));
    if (dup) { skipped.push(`${id} ${r.reported_as} [${r.arxiv}] = "${dup.method.slice(0, 40)}"`); continue; }
    const energy = +(r.eps * div).toPrecision(12);
    // sigma^2/N_site as printed; totals scale with the site count (as in add_worklist_rows)
    const varTot = r.var_per_site == null ? null : +(r.var_per_site * inst.n_sites).toPrecision(8);
    const row = {
      energy, sigma: r.sigma_per_site == null ? null : +(r.sigma_per_site * Math.abs(div)).toPrecision(6),
      energy_variance: varTot, dof, einf,
      v_score: varTot == null ? null : vScore(varTot, dof, energy, einf),
      method: r.method, bound_type: r.bound_type, bound_type_reason: REASON[r.bound_type],
      reference: r.reference, peer_reviewed: r.peer_reviewed,
      source: "sweep-allresults-2026-09-15", provenance: r.origin === "own" ? "primary" : "secondary",
      verified: {
        checked_on: CHECKED,
        method: `source text of arXiv:${r.arxiv} read locally (arXiv HTML or pypdf layout text); value copied from the harvested cell and the text, no LLM transcription of numbers; ${r.verified_by}`,
        reported_as: r.reported_as,
        note: [r.evidence, r.convention_check, r.variance_as_reported != null && r.var_per_site == null
          ? `variance reported as ${r.variance_as_reported}, not stored: convention not verified` : ""].filter(Boolean).join(" | "),
        secondary_of: r.origin === "quoted" ? `arXiv:${r.arxiv}` : null,
      },
    };
    if (r.compute) row.compute = r.compute;
    inst.rows.push(row);
    added++;
  }
  fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
}
console.log(`added ${added} all-results rows; ${skipped.length} already on their instance`);
if (process.env.QMBL_VERBOSE) skipped.forEach(s => console.log("  dup", s));
