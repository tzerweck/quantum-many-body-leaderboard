// arXiv candidate harvester for the refresh sweep. Writes sweep-candidates.tsv.
import fs from "node:fs";
const Q = [
 ["triangular-nqs", `cat:cond-mat.str-el AND abs:"triangular" AND (abs:"neural network" OR abs:"variational Monte Carlo" OR abs:"tensor network")`],
 ["kagome-energy",  `cat:cond-mat.str-el AND abs:"kagome" AND (abs:"ground-state energy" OR abs:"ground state energy" OR abs:"DMRG")`],
 ["pyrochlore-gs",  `cat:cond-mat.str-el AND abs:"pyrochlore" AND (abs:"ground state" OR abs:"variational")`],
 ["hubbard-nqs",    `cat:cond-mat.str-el AND abs:"Hubbard" AND (abs:"neural network quantum state" OR abs:"neural quantum state" OR abs:"backflow")`],
 ["hubbard-stripe", `cat:cond-mat.str-el AND abs:"Hubbard" AND abs:"stripe" AND (abs:"AFQMC" OR abs:"DMRG" OR abs:"variational")`],
 ["nqs-benchmark",  `(abs:"neural quantum state" OR abs:"neural-network quantum state") AND (abs:"benchmark" OR abs:"state-of-the-art" OR abs:"lowest variational energy")`],
 ["vscore",         `all:"V-score" OR all:"variational benchmark"`],
 ["heis-square",    `cat:cond-mat.str-el AND abs:"Heisenberg" AND abs:"square lattice" AND abs:"variational"`],
 ["tV-spinless",    `cat:cond-mat.str-el AND abs:"spinless fermions" AND (abs:"variational" OR abs:"DMRG")`],
 ["tfim",           `cat:cond-mat.str-el AND abs:"transverse field Ising" AND (abs:"variational" OR abs:"neural")`],
 ["shastry",        `cat:cond-mat.str-el AND (abs:"Shastry-Sutherland" OR abs:"shuriken") AND abs:"variational"`],
 ["minsr-opt",      `abs:"stochastic reconfiguration" OR abs:"minimum-step" OR abs:"MinSR" OR abs:"SPRING optimizer"`],
];
const strip = s => s.replace(/\s+/g, " ").trim();
const get = async u => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u); if (r.ok) return await r.text(); } catch {} await new Promise(r => setTimeout(r, 4000)); } return ""; };
const seen = new Map();
for (const [tag, q] of Q) {
  const t = await get(`http://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=40`);
  let n = 0;
  for (const m of t.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const id = (e.match(/<id>.*?abs\/([^<v]+)/) || [])[1];
    const d = ((e.match(/<published>([^<]+)/) || [])[1] || "").slice(0, 10);
    if (!id || d < "2025-01-01") continue;
    const ti = strip((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const ab = strip((e.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || "");
    const jr = strip((e.match(/<arxiv:journal_ref[^>]*>([\s\S]*?)<\/arxiv:journal_ref>/) || [])[1] || "");
    const doi = strip((e.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/) || [])[1] || "");
    // score: does the abstract promise an energy we could actually use?
    let sc = 0;
    if (/ground[- ]state energ|variational energ|lowest energ/i.test(ab)) sc += 3;
    if (/state[- ]of[- ]the[- ]art|benchmark|outperform|improve.{0,20}energ/i.test(ab)) sc += 2;
    if (/\b(kagome|pyrochlore|triangular|J_?1.?J_?2|Hubbard|shuriken|Shastry)/i.test(ab)) sc += 2;
    if (jr) sc += 2;                       // peer reviewed
    if (/\b(neural|RNN|transformer|PEPS|DMRG|AFQMC|VMC|backflow)/i.test(ab)) sc += 1;
    const prev = seen.get(id);
    if (!prev || sc > prev.sc) seen.set(id, { id, d, ti, jr, doi, sc, tag });
    n++;
  }
  console.error(`${tag}: ${n} since 2025`);
  await new Promise(r => setTimeout(r, 3500));
}
const rows = [...seen.values()].sort((a, b) => b.sc - a.sc || b.d.localeCompare(a.d));
fs.writeFileSync("sweep-candidates.tsv",
  "score\tdate\tarxiv\tpeer_reviewed\tjournal_ref\tdoi\ttitle\n" +
  rows.map(r => [r.sc, r.d, r.id, r.jr ? "yes" : "no", r.jr, r.doi, r.ti].join("\t")).join("\n") + "\n");
console.error(`\n${rows.length} unique candidates -> sweep-candidates.tsv`);
