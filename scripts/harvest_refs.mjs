// Pull arXiv ids out of the bibliographies of seed papers, count how often each is
// cited across them, and flag ones we have not already seen as candidates.
import fs from "node:fs";
const SEEDS = process.argv.slice(2);
const strip = s => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#[0-9]+;|&[a-z]+;/g, " ").replace(/\s+/g, " ");
const get = async id => {
  const f = `sources/${id}.html`;
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8");
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(`https://arxiv.org/html/${id}`); if (r.ok) { const t = await r.text(); fs.writeFileSync(f, t); return t; } } catch {}
    await new Promise(r => setTimeout(r, 3000));
  }
  return "";
};
const known = new Set(fs.existsSync("sweep-candidates.tsv")
  ? fs.readFileSync("sweep-candidates.tsv", "utf8").split("\n").slice(1).map(l => l.split("\t")[2]).filter(Boolean) : []);
const cited = new Map();
for (const s of SEEDS) {
  const h = await get(s);
  if (!h) { console.log(`  ${s}: no HTML`); continue; }
  const txt = strip(h);
  const ids = new Set([...txt.matchAll(/arXiv[:\s]*([0-9]{4}\.[0-9]{4,5})/gi)].map(m => m[1]));
  // keep the title-ish context so the list is readable
  for (const id of ids) {
    const i = txt.indexOf(id);
    const ctx = txt.slice(Math.max(0, i - 150), i).replace(/^.*?\)\s*/, "");
    const e = cited.get(id) || { n: 0, ctx: "", seeds: [] };
    e.n++; e.seeds.push(s); if (!e.ctx) e.ctx = ctx.slice(-110);
    cited.set(id, e);
  }
  console.log(`  ${s}: ${ids.size} arXiv refs`);
  await new Promise(r => setTimeout(r, 2500));
}
const rows = [...cited].filter(([id]) => !SEEDS.includes(id)).sort((a, b) => b[1].n - a[1].n);
console.log(`\n${rows.length} distinct cited arXiv ids; ${rows.filter(([id]) => !known.has(id)).length} NOT already in sweep-candidates\n`);
console.log("MOST-CITED ACROSS SEEDS (n = how many seed papers cite it):");
for (const [id, e] of rows.filter(r => r[1].n >= 2).slice(0, 22))
  console.log(`  n=${e.n} ${known.has(id) ? "known" : "NEW  "} ${id}  ${e.ctx.slice(-88)}`);
fs.writeFileSync("sweep-refs.tsv", "arxiv\tcited_by_n_seeds\tin_candidates\tcontext\n" +
  rows.map(([id, e]) => [id, e.n, known.has(id) ? "yes" : "no", e.ctx].join("\t")).join("\n") + "\n");
