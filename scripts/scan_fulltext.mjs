// Score candidates on their FULL TEXT, not the abstract. Abstracts almost never
// quote energies; tables do. Caches HTML under sources/ so reruns are free.
import fs from "node:fs";
const strip = s => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#[0-9]+;|&[a-z]+;/g, " ").replace(/\s+/g, " ");
const MODELS = [["kagome",/kagome/i],["triangular",/triangular/i],["pyrochlore",/pyrochlore/i],
  ["J1J2",/J\s*_?1\s*[-–]\s*J\s*_?2|J_\{?1\}?-J_\{?2\}?/i],["Hubbard",/Hubbard/i],
  ["shuriken",/shuriken/i],["Shastry",/Shastry[- ]Sutherland/i],["tV",/spinless fermion|t-V model/i],
  ["TFIsing",/transverse[- ]field Ising/i],["square-Heis",/square[- ]lattice Heisenberg/i]];
const rows = fs.readFileSync("sweep-candidates.tsv","utf8").split("\n").slice(1).filter(Boolean)
  .map(l => { const c = l.split("\t"); return { id:c[2], pr:c[3], jr:c[4], ti:c[6] }; });
const out = [];
let got = 0, miss = 0;
for (const [i, r] of rows.entries()) {
  const f = `sources/${r.id}.html`;
  let h = "";
  if (fs.existsSync(f)) h = fs.readFileSync(f, "utf8");
  else {
    for (let k = 0; k < 2 && !h; k++) {
      try { const res = await fetch(`https://arxiv.org/html/${r.id}`); if (res.ok) { h = await res.text(); fs.writeFileSync(f, h); } } catch {}
      if (!h) await new Promise(x => setTimeout(x, 2500));
    }
    await new Promise(x => setTimeout(x, 1800));
  }
  if (!h || h.length < 5000) { miss++; out.push({ ...r, ok:0, sc:-1, en:0, enErr:0, tbl:0, models:"" }); continue; }
  got++;
  const s = strip(h);
  // energies quoted to >=4 decimals, and the subset carrying an error bar
  const en = new Set([...s.matchAll(/-\s?[0-9]\.[0-9]{4,}/g)].map(m => m[0].replace(/\s/g,"")));
  const enErr = [...s.matchAll(/-\s?[0-9]\.[0-9]{4,}\s*\(\s*[0-9]+\s*\)/g)].length;
  const tbl = (h.match(/<table/gi) || []).length;
  const models = MODELS.filter(([, re]) => re.test(s)).map(([n]) => n);
  let sc = 0;
  if (en.size >= 5) sc += 3; else if (en.size >= 2) sc += 1;
  if (enErr >= 3) sc += 3; else if (enErr >= 1) sc += 1;   // error bars = a results table
  if (tbl >= 2) sc += 2;
  sc += Math.min(models.length, 3);
  if (/ground[- ]state energ|variational energ/i.test(s)) sc += 1;
  if (r.pr === "yes") sc += 2;
  out.push({ ...r, ok:1, sc, en:en.size, enErr, tbl, models: models.join("+") });
  if ((i+1) % 25 === 0) console.error(`  ${i+1}/${rows.length} (html ${got}, missing ${miss})`);
}
out.sort((a,b) => b.sc - a.sc);
fs.writeFileSync("sweep-fulltext.tsv",
  "score\tarxiv\tpeer_reviewed\tn_energies\tn_with_errorbar\tn_tables\tmodels\tjournal_ref\ttitle\n" +
  out.map(r => [r.sc,r.id,r.pr,r.en,r.enErr,r.tbl,r.models,r.jr,r.ti].join("\t")).join("\n") + "\n");
console.error(`\nHTML retrieved for ${got}/${rows.length}; ${miss} have none (pre-2024 arXiv has no HTML).`);
