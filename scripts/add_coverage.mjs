// Instance-level `coverage` (DATA.md): when an instance's literature was checked, by what
// method, against which papers, and how many of them carry an energy for it. A check that
// found nothing is recorded too - it is what lets an instance page say how current it is.
//
// One file per checking pass, appended in date order. `found` counts the screened papers
// that the instance carries at least one energy from, read off the rows as built (reference,
// or the note of a row quoted from it), so it can never disagree with the page. A reader's
// own "has results" judgement is not used: in the first pass it said no for papers whose
// rows were already on the instance.
import fs from "node:fs";

const PASSES = [
  {
    file: "sweep-coverage-2026-09-15.json", checked_on: "2026-09-15",
    method: "table harvest of cached arXiv sources (match_tables.mjs --all), every matched paper read for this instance",
    note: "Only papers whose tables matched the instance by size were read; not a citation screen.",
  },
  {
    file: "sweep-coverage-2026-09-15-cites.json", checked_on: "2026-09-15",
    method: c => `citation screen of ${c.seed}: citing works from OpenAlex and Semantic Scholar (scripts/cited_by.mjs)`,
    note: c => `${c.citing_total} citing works, ${c.citing_arxiv} on arXiv, ${c.citing_text} fetched; ${c.screened.length} read in full, ${c.excluded} excluded by a text filter (no energy to four decimals, or no QMBL model named).`,
  },
];

let entries = 0;
for (const pass of PASSES) {
  if (!fs.existsSync(pass.file)) continue;
  for (const c of JSON.parse(fs.readFileSync(pass.file, "utf8"))) {
    const p = `data/${c.instance_id}.json`;
    if (!fs.existsSync(p)) { console.log(`MISS coverage instance ${c.instance_id}`); continue; }
    const inst = JSON.parse(fs.readFileSync(p, "utf8"));
    const carried = c.screened.filter(a => inst.rows.some(r => (r.reference || "").includes(a.slice(6)) ||
      (r.verified?.secondary_of || "").includes(a.slice(6)) || (r.verified?.note || "").includes(a)));
    (inst.coverage ||= []).push({
      checked_on: pass.checked_on, method: typeof pass.method === "function" ? pass.method(c) : pass.method,
      ...(c.screened.length <= 12 ? { screened: c.screened } : { screened_count: c.screened.length }),
      found: carried.length,
      note: [typeof pass.note === "function" ? pass.note(c) : pass.note, carried.length ? `Energies from: ${carried.join(", ")}.` : ""].filter(Boolean).join(" "),
    });
    fs.writeFileSync(p, JSON.stringify(inst, null, 2) + "\n");
    entries++;
  }
}
console.log(`coverage: ${entries} entries`);
