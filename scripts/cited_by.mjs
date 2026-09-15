// Who has cited this paper? The cheapest way to ask whether anyone has computed a second
// energy for an instance that only one paper ever touched.
//
// The keyword sweep cannot find those papers: an instance like Hubbard/square_256_P_113_8
// is one column of one doping scan, and nobody else writes its parameters in an abstract.
// The citation graph can, because a second calculation on the same Hamiltonian cites the
// first. This is the method that settled the Impurity family (247 citing papers screened,
// none of them uses VarBench's bath discretisations), and it is what lets an instance carry
// a `coverage` entry saying the literature was checked and nothing newer exists.
//
// Two registries, merged, because neither is complete: OpenAlex indexes preprints
// inconsistently and Semantic Scholar misses some journal-only records.
//
// A failed request is a hard error, never an empty result (SWEEP.md): an outage that logs
// as "0 citing papers" would be recorded as a screen that found nothing.
//
// usage: node scripts/cited_by.mjs --seed 10.1103/physrevb.107.115133 --seed 2311.11561 \
//          [--tag sorella-2023] [--out sweep-cites-sorella.tsv]
import fs from "node:fs";

const MAILTO = "admin@kayba.ai";
const UA = `qmbl-sweep/1.0 (quantum-many-body-leaderboard; mailto:${MAILTO})`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const argv = process.argv.slice(2);
const seeds = [], flags = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--seed") seeds.push(argv[++i]);
  else if (argv[i].startsWith("--")) flags[argv[i]] = argv[++i];
}
if (!seeds.length) { console.error("usage: node scripts/cited_by.mjs --seed <arxiv-id|doi> [--seed ...] [--tag t] [--out f.tsv]"); process.exit(1); }
const TAG = flags["--tag"] || seeds[0].replace(/[^0-9a-z.]/gi, "-");
const OUT = flags["--out"] || `sweep-cites-${TAG}.tsv`;

async function get(url, { tries = 4 } = {}) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (r.status === 200) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(5000 * (i + 1)); continue; }
    if (r.status === 404) return null;                       // the registry does not have it
    throw new Error(`HTTP ${r.status} on ${url}`);
  }
  throw new Error(`gave up after ${tries} tries: ${url}`);
}

const isDoi = s => s.includes("/") && !/^\d{4}\.\d{4,5}$/.test(s);
const arxivOf = ids => {
  if (!ids) return "";
  if (ids.arxiv) return ids.arxiv;                            // Semantic Scholar externalIds
  if (ids.ArXiv) return ids.ArXiv;
  const d = (ids.doi || ids.DOI || "").toLowerCase();
  const m = d.match(/10\.48550\/arxiv\.(.+)$/);
  return m ? m[1] : "";
};

// -------------------------------------------------------------------------- OpenAlex
async function openalexCiting(seed) {
  const key = isDoi(seed) ? `doi:${seed}` : `doi:10.48550/arXiv.${seed}`;
  const work = await get(`https://api.openalex.org/works/${key}?mailto=${MAILTO}`);
  if (!work) return { work: null, citing: [] };
  const citing = [];
  let cursor = "*";
  while (cursor) {
    const page = await get(`https://api.openalex.org/works?filter=cites:${work.id.split("/").pop()}` +
      `&per-page=200&cursor=${encodeURIComponent(cursor)}&mailto=${MAILTO}`);
    for (const w of page.results) citing.push({
      arxiv: arxivOf(w.ids) || (w.locations || []).map(l => (l.landing_page_url || "").match(/arxiv\.org\/abs\/(.+)$/)?.[1]).find(Boolean) || "",
      doi: (w.doi || "").replace("https://doi.org/", ""),
      year: w.publication_year || "",
      venue: w.primary_location?.source?.display_name || "",
      title: (w.title || "").replace(/\s+/g, " "),
      via: "openalex",
    });
    cursor = page.meta?.next_cursor || null;
    if (cursor) await sleep(400);
  }
  return { work, citing };
}

// ------------------------------------------------------------------ Semantic Scholar
async function s2Citing(seed) {
  const key = isDoi(seed) ? `DOI:${seed}` : `arXiv:${seed}`;
  const paper = await get(`https://api.semanticscholar.org/graph/v1/paper/${key}?fields=title,citationCount`);
  if (!paper) return { paper: null, citing: [] };
  const citing = [];
  for (let offset = 0; ; offset += 100) {
    const page = await get(`https://api.semanticscholar.org/graph/v1/paper/${key}/citations` +
      `?fields=title,year,venue,externalIds&limit=100&offset=${offset}`);
    for (const c of page.data || []) {
      const p = c.citingPaper || {};
      citing.push({
        arxiv: arxivOf(p.externalIds), doi: (p.externalIds?.DOI || "").toLowerCase(),
        year: p.year || "", venue: p.venue || "", title: (p.title || "").replace(/\s+/g, " "), via: "s2",
      });
    }
    if (!page.data || page.data.length < 100 || page.next == null) break;
    await sleep(1200);                                        // S2 is strict without a key
  }
  return { paper, citing };
}

// The same paper arrives with an arXiv id from one registry and without one from the
// other, so an id-only key lists it twice. Titles are the only field both always carry.
const merged = new Map(), byTitle = new Map();
const titleKey = t => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 90);
for (const seed of seeds) {
  const [oa, s2] = [await openalexCiting(seed), await s2Citing(seed)];
  const title = oa.work?.title || s2.paper?.title || "";
  console.log(`seed ${seed}: ${oa.citing.length} citing (OpenAlex), ${s2.citing.length} citing (S2)  "${title.slice(0, 60)}"`);
  if (!oa.work && !s2.paper) throw new Error(`neither registry resolved seed ${seed}; a screen cannot be recorded as empty`);
  for (const c of [...oa.citing, ...s2.citing]) {
    const tk = titleKey(c.title);
    const k = c.arxiv || c.doi || tk;
    if (!k) continue;
    const prev = merged.get(k) || (tk ? byTitle.get(tk) : null);
    if (prev) {
      prev.seeds.add(seed); prev.via.add(c.via);
      for (const f of ["arxiv", "doi", "year", "venue", "title"]) prev[f] ||= c[f];
      if (tk) byTitle.set(tk, prev);
    } else {
      const rec = { ...c, seeds: new Set([seed]), via: new Set([c.via]) };
      merged.set(k, rec);
      if (tk) byTitle.set(tk, rec);
    }
  }
}

const rows = [...merged.values()].sort((a, b) => (b.year || 0) - (a.year || 0));
const cols = ["arxiv", "doi", "year", "venue", "title", "seeds", "via"];
fs.writeFileSync(OUT, [cols.join("\t"), ...rows.map(r =>
  [r.arxiv, r.doi, r.year, r.venue, r.title, [...r.seeds].join("+"), [...r.via].join("+")]
    .map(v => String(v).replace(/[\t\n]+/g, " ")).join("\t"))].join("\n") + "\n");
console.log(`${rows.length} distinct citing papers -> ${OUT}  (${rows.filter(r => r.arxiv).length} with an arXiv id)`);
