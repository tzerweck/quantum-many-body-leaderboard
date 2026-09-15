// arXiv candidate harvester for the refresh sweep. Writes sweep-candidates.tsv.
//
// Rewritten 2026-09-14. The previous version made its output a FLOOR rather than a
// census, and said nothing about either reason:
//
//   1. `max_results=40` with no paging. Every query was truncated at 40 hits no matter
//      how many matched, so the "161 unique candidates" of 2026-09-12 was 12 queries
//      capped at 40, not 12 queries answered.
//   2. `get()` returned "" on any HTTP or network failure. A 429 from arXiv (which this
//      environment hits routinely) logged as "<tag>: 0 since 2025", indistinguishable
//      from a query that genuinely matched nothing.
//
// Both are fixed. The harvester pages until it reaches the date floor, and a failed
// request is a hard error: it is named in `sweep-queries.tsv`, printed in a banner, and
// sets a non-zero exit code. A page cap that binds is reported as TRUNCATED with the hit
// count it gave up on, so a bounded harvest never reads as a complete one.
//
// The date floor is now a parameter. 54 of the first 97 accepted rows came from pre-2025
// papers, and arXiv has no HTML at all before ~Dec 2023 (see fetch_pdfs.mjs), so the
// backlog is mined by the same tool with a different --since.
//
// Output is MERGED into the existing candidate file by default: a partial run can only
// ever add candidates, never silently drop the ones a previous run found. --fresh opts
// out.
//
// There are also two ways to reach arXiv, and they are rate-limited separately. The API
// at export.arxiv.org returned 429 to every request for over an hour on 2026-09-14 while
// arxiv.org served PDFs and HTML normally, so --via auto falls back to the arxiv.org
// search UI rather than let an outage produce an empty sweep.
//
// Usage: node scripts/sweep_search.mjs [--since 2019-01-01] [--max-pages 40]
//                                      [--only tag,tag] [--out sweep-candidates.tsv]
//                                      [--via api|search|auto] [--fresh]
import fs from "node:fs";

// --- queries ----------------------------------------------------------------------
// The first block is the original 2026-09-12 set. The second targets the families with
// ZERO post-2024 coverage: tV (0/14 instances), Impurity (0/12), TFIsing (0/7), plus
// pyrochlore and shuriken, which had only one thin keyword each. Nobody has ever run a
// query written for these; the old set reached them only incidentally.
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

 // --- zero-coverage families -------------------------------------------------------
 // tV: the instances are spinless fermions on chain/square at V = 0.01 … 10, which is
 // the t-V model and the extended Hubbard model under two different names.
 ["tV-model",       `cat:cond-mat.str-el AND (abs:"t-V model" OR abs:"extended Hubbard") AND (abs:"ground-state energy" OR abs:"ground state energy" OR abs:"DMRG" OR abs:"variational")`],
 ["tV-cdw",         `cat:cond-mat.str-el AND abs:"spinless fermions" AND (abs:"charge density wave" OR abs:"nearest-neighbor interaction" OR abs:"nearest neighbour repulsion")`],
 // Impurity: SB-/TB-DMFT instances with 9…309 bath sites. These are impurity-solver
 // benchmark papers, a literature that shares no vocabulary with the lattice papers.
 ["impurity-solver", `(abs:"Anderson impurity" OR abs:"impurity solver" OR abs:"quantum impurity") AND (abs:"ground-state energy" OR abs:"DMRG" OR abs:"tensor network" OR abs:"matrix product" OR abs:"neural")`],
 ["impurity-bath",  `abs:"fork tensor product" OR abs:"bath discretization" OR abs:"bath discretisation" OR (abs:"dynamical mean-field" AND abs:"multi-orbital" AND abs:"benchmark")`],
 // TFIsing: chain L=10,32 and square 36/144/400 at h = 0.5, 1, 3.
 ["tfising-bench",  `cat:cond-mat.str-el AND (abs:"transverse-field Ising" OR abs:"transverse field Ising") AND (abs:"ground-state energy" OR abs:"ground state energy" OR abs:"benchmark" OR abs:"tensor network" OR abs:"quantum Monte Carlo")`],
 ["ising-2d-var",   `(abs:"2D Ising" OR abs:"two-dimensional Ising" OR abs:"square-lattice Ising") AND (abs:"variational" OR abs:"neural network" OR abs:"PEPS")`],
 // pyrochlore and shuriken, without the "variational"/"ground state" narrowing that
 // kept the old queries from seeing DMRG and QMC papers on these lattices.
 ["pyrochlore-heis", `abs:"pyrochlore" AND (abs:"Heisenberg" OR abs:"spin liquid" OR abs:"spin ice") AND (abs:"energy" OR abs:"DMRG" OR abs:"tensor network" OR abs:"Monte Carlo")`],
 ["shuriken-lat",   `abs:"shuriken" OR abs:"square-kagome" OR abs:"squagome" OR abs:"square kagome"`],
 // A broad net for the ansatz literature, which names its lattice only in the body.
 ["nqs-any",        `abs:"neural network quantum state" OR abs:"neural quantum states" OR abs:"neural-network wave function" OR abs:"neural network wavefunction"`],
];

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SINCE = opt("--since", "2019-01-01");
const MAXPAGES = +opt("--max-pages", 40);
const OUT = opt("--out", "sweep-candidates.tsv");
const ONLY = (opt("--only", "") || "").split(",").filter(Boolean);
const FRESH = args.includes("--fresh");
const VIA = opt("--via", "auto");       // api | search | auto (API, falling back to search)
const PAGE = 100;                       // arXiv serves 100/page comfortably
const GAP = 3500;                       // arXiv asks for one request per 3 s

const UA = "qmbl-sweep/2.0 (quantum-many-body-leaderboard; academic literature sweep)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = s => s.replace(/\s+/g, " ").trim();

// --- fallback: arxiv.org/search ----------------------------------------------------
// export.arxiv.org/api and arxiv.org are rate-limited separately, and the API is the one
// that goes first: on 2026-09-14 it returned 429 to every request for over an hour while
// arxiv.org served PDFs and HTML normally. With only the API path, a sweep in that state
// harvests nothing at all, which is the same outcome the old silent-failure bug produced
// and the reason the pool has never been a census.
//
// The queries stay defined ONCE, in API syntax, and are parsed into groups here. The
// search UI applies its operators left to right with no grouping, so `A AND (B OR C)`
// cannot be expressed - instead the OR groups are expanded into their cartesian product
// of flat AND queries and the results unioned. More requests, but no reliance on the
// UI's operator precedence.
const FIELD_UI = { abs: "abstract", ti: "title", all: "all", au: "author" };

function parseQuery(q) {
  const groups = [];
  let cat = "";
  // split on top-level AND, respecting parentheses
  const parts = [];
  let depth = 0, cur = "";
  for (let i = 0; i < q.length; i++) {
    if (q[i] === "(") depth++;
    if (q[i] === ")") depth--;
    if (depth === 0 && q.slice(i, i + 5) === " AND ") { parts.push(cur); cur = ""; i += 4; continue; }
    cur += q[i];
  }
  parts.push(cur);

  for (let p of parts) {
    p = p.trim().replace(/^\((.*)\)$/s, "$1");
    const alts = [];
    for (const a of p.split(/\s+OR\s+/)) {
      const m = a.trim().match(/^(\w+):\s*"?([^"]+)"?$/);
      if (!m) continue;
      if (m[1] === "cat") { cat = m[2]; continue; }
      alts.push({ field: m[1], phrase: m[2] });
    }
    if (alts.length) groups.push(alts);
  }
  return { cat, groups };
}

// cartesian product of the OR groups -> one flat AND query per combination
function expand(groups) {
  return groups.reduce((acc, g) => acc.flatMap(c => g.map(t => [...c, t])), [[]]);
}

function searchUrl(terms, cat, since, start, size) {
  const p = new URLSearchParams({ advanced: "", start: String(start), size: String(size) });
  terms.forEach((t, i) => {
    p.append(`terms-${i}-operator`, i === 0 ? "AND" : "AND");
    p.append(`terms-${i}-term`, t.phrase);
    p.append(`terms-${i}-field`, FIELD_UI[t.field] || "all");
  });
  // the UI filters by ARCHIVE, not by category, so cat:cond-mat.str-el becomes cond-mat.
  // That is slightly broader than the API query, which costs recall nothing.
  if (cat) {
    p.append("classification-physics", "y");
    p.append("classification-physics_archives", cat.split(".")[0]);
  } else p.append("classification-physics_archives", "all");
  p.append("date-filter_by", "date_range");
  p.append("date-date_type", "submitted_date");
  p.append("date-from_date", since);
  p.append("date-to_date", "");
  return `https://arxiv.org/search/advanced?${p}`;
}

const MONTH = { January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
                July: "07", August: "08", September: "09", October: "10", November: "11", December: "12" };
const asDate = s => {
  const m = s.match(/([0-9]{1,2})\s+(\w+),\s*([0-9]{4})/);
  return m ? `${m[3]}-${MONTH[m[2]] || "01"}-${m[1].padStart(2, "0")}` : "";
};
const unent = s => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">").replace(/&#x?[0-9a-f]+;/gi, " ").replace(/&[a-z]+;/gi, " ");
const untag = s => strip(unent(s.replace(/<[^>]+>/g, " ")));

// parse one arxiv-result <li> into the same shape the Atom path produces
function parseResult(li) {
  const id = (li.match(/arxiv\.org\/abs\/([0-9]{4}\.[0-9]{4,5})/) || [])[1];
  if (!id) return null;
  const ti = untag((li.match(/<p class="title is-5 mathjax">([\s\S]*?)<\/p>/) || [])[1] || "");
  const ab = untag((li.match(/<span class="abstract-full[^"]*"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "")
               .replace(/\s*△?\s*Less\s*$/, "");
  const jr = untag((li.match(/Journal ref:<\/span>([\s\S]*?)<\/p>/) || [])[1] || "");
  const doi = untag((li.match(/<p class="list-doi[^"]*">[\s\S]*?doi\.org\/([^"<]+)/) || [])[1] || "");
  // the v1 date is what the API reports as <published>; prefer it over a revision date
  const sub = li.match(/v1 submitted\s*([0-9]{1,2}\s+\w+,\s*[0-9]{4})/)
           || li.match(/Submitted<\/span>\s*([0-9]{1,2}\s+\w+,\s*[0-9]{4})/);
  return { id, ti, ab, jr, doi, d: sub ? asDate(sub[1]) : "" };
}

async function getSearchPage(terms, cat, since, start, size) {
  const url = searchUrl(terms, cat, since, start, size);
  let last = "no attempt";
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.ok) {
        const text = await r.text();
        if (/arxiv-result|Sorry, your query returned no results/.test(text)) return { ok: true, text };
        last = `HTTP 200 but not a results page (${text.length} bytes)`;
      } else {
        last = `HTTP ${r.status}`;
        if (r.status === 429) { await sleep(30000); continue; }
      }
    } catch (e) { last = `network: ${String(e?.message || e).slice(0, 70)}`; }
    await sleep(5000 * (a + 1));
  }
  return { ok: false, err: last };
}

// A request either returns an Atom feed or it FAILS. There is no third outcome that
// looks like an empty result set - that conflation is the bug this rewrite exists for.
async function getPage(q, start) {
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(q)}` +
              `&sortBy=submittedDate&sortOrder=descending&start=${start}&max_results=${PAGE}`;
  let last = "no attempt";
  for (let a = 0; a < 5; a++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.ok) {
        const text = await r.text();
        if (/<feed/i.test(text)) return { ok: true, text };
        last = `HTTP 200 but not an Atom feed (${text.length} bytes)`;
      } else {
        last = `HTTP ${r.status}`;
        if (r.status === 429) {                       // arXiv throttling, back off hard
          const ra = Number(r.headers.get("retry-after")) || 0;
          await sleep(Math.max(ra * 1000, 30000));
          continue;
        }
      }
    } catch (e) { last = `network: ${String(e?.message || e).slice(0, 70)}`; }
    await sleep(5000 * (a + 1));
  }
  return { ok: false, err: last };
}

// --- merge with what previous runs found -------------------------------------------
const seen = new Map();
let carried = 0;
if (!FRESH && fs.existsSync(OUT)) {
  const [, ...rest] = fs.readFileSync(OUT, "utf8").split("\n").filter(Boolean);
  for (const l of rest) {
    const c = l.split("\t");
    if (!c[2]) continue;
    seen.set(c[2], { id: c[2], d: c[1], ti: c[6] || "", jr: c[4] || "", doi: c[5] || "",
                     sc: +c[0] || 0, tag: c[8] || "(prior run)", fam: c[7] || "" });
    carried++;
  }
  console.error(`carried ${carried} candidates forward from ${OUT}\n`);
}

// Which QMBL families does this abstract name? Carried on the row so the triage in
// step 3 can be driven by family instead of by score alone.
const FAM = [
  ["kagome", /kagome/i], ["pyrochlore", /pyrochlore/i], ["triangular", /triangular/i],
  ["shuriken", /shuriken|square[- ]kagome|squagome/i], ["Shastry", /shastry[- ]sutherland/i],
  ["J1J2", /J\s*_?1\s*[-–]\s*J\s*_?2|J_\{?1\}?-J_\{?2\}?/i],
  ["Hubbard", /hubbard/i], ["TFIsing", /transverse[- ]field ising|\bTFIM\b/i],
  ["tV", /spinless fermion|\bt-V\b|extended hubbard/i],
  ["Impurity", /anderson impurity|impurity solver|quantum impurity|dynamical mean[- ]field|\bDMFT\b/i],
  ["Heisenberg", /heisenberg/i],
];

const audit = [];
let hardFail = 0, newThisRun = 0;

// score and merge one paper. Shared by both harvest paths so the two can never disagree
// about what a candidate is worth.
function record({ id, d, ti, ab, jr, doi }, tag) {
  const fam = FAM.filter(([, re]) => re.test(`${ti} ${ab}`)).map(([n]) => n);
  // score: does the abstract promise an energy we could actually use?
  let sc = 0;
  if (/ground[- ]state energ|variational energ|lowest energ/i.test(ab)) sc += 3;
  if (/state[- ]of[- ]the[- ]art|benchmark|outperform|improve.{0,20}energ/i.test(ab)) sc += 2;
  if (/\b(kagome|pyrochlore|triangular|J_?1.?J_?2|Hubbard|shuriken|Shastry)/i.test(ab)) sc += 2;
  if (jr) sc += 2;                       // peer reviewed
  if (/\b(neural|RNN|transformer|PEPS|DMRG|AFQMC|VMC|backflow)/i.test(ab)) sc += 1;
  // a family with no post-2024 row at all is worth more attention per hit
  if (fam.some(f => f === "tV" || f === "Impurity" || f === "TFIsing" ||
                    f === "pyrochlore" || f === "shuriken")) sc += 2;

  const prev = seen.get(id);
  if (!prev) newThisRun++;
  if (!prev || sc > prev.sc) seen.set(id, { id, d, ti, jr, doi, sc, tag, fam: fam.join("+") });
}

// --- harvest via arxiv.org/search ---------------------------------------------------
async function harvestViaSearch(tag, q) {
  const { cat, groups } = parseQuery(q);
  const combos = expand(groups);
  let entriesSeen = 0, kept = 0, pages = 0, failed = 0, truncated = 0;

  for (const terms of combos) {
    let start = 0;
    for (let p = 0; p < MAXPAGES; p++) {
      const r = await getSearchPage(terms, cat, SINCE, start, 200);
      if (!r.ok) { failed++; break; }
      pages++;
      const lis = [...r.text.matchAll(/<li class="arxiv-result">([\s\S]*?)<\/li>/g)];
      if (!lis.length) break;
      for (const m of lis) {
        const e = parseResult(m[1]);
        entriesSeen++;
        if (!e || (e.d && e.d < SINCE)) continue;
        kept++;
        record(e, tag);
      }
      if (lis.length < 200) break;                    // last page
      start += 200;
      if (p === MAXPAGES - 1) truncated++;
      await sleep(GAP);
    }
    await sleep(GAP);
  }
  const stop = failed ? `${failed}/${combos.length} sub-queries FAILED`
             : truncated ? `PAGE CAP ${MAXPAGES} BOUND on ${truncated} sub-queries - TRUNCATED`
             : `${combos.length} sub-queries complete`;
  if (failed) hardFail++;
  return { total: "", pages, entriesSeen, kept, stop };
}

// --- harvest via export.arxiv.org/api -----------------------------------------------
async function harvestViaApi(tag, q) {
  let start = 0, pages = 0, entriesSeen = 0, kept = 0, total = null, stop = "";

  while (pages < MAXPAGES) {
    const r = await getPage(q, start);
    if (!r.ok) { stop = `FAILED after retries: ${r.err}`; hardFail++; break; }
    pages++;

    if (/<id>http:\/\/arxiv\.org\/api\/errors/.test(r.text)) {
      stop = `QUERY REJECTED: ${strip((r.text.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || "")}`.slice(0, 120);
      hardFail++; break;
    }
    if (total === null) total = +((r.text.match(/opensearch:totalResults[^>]*>\s*([0-9]+)/) || [])[1] ?? 0);

    const entries = [...r.text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
    if (!entries.length) { stop = total === 0 ? "no hits" : "exhausted"; break; }

    let oldest = "9999-99-99";
    for (const m of entries) {
      const e = m[1];
      entriesSeen++;
      const id = (e.match(/<id>.*?abs\/([^<v]+)/) || [])[1];
      const d = ((e.match(/<published>([^<]+)/) || [])[1] || "").slice(0, 10);
      if (d && d < oldest) oldest = d;
      if (!id || d < SINCE) continue;
      const ti = strip((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
      const ab = strip((e.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || "");
      const jr = strip((e.match(/<arxiv:journal_ref[^>]*>([\s\S]*?)<\/arxiv:journal_ref>/) || [])[1] || "");
      const doi = strip((e.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/) || [])[1] || "");
      kept++;
      record({ id, d, ti, ab, jr, doi }, tag);
    }

    if (oldest < SINCE) { stop = `reached --since ${SINCE}`; break; }
    start += PAGE;
    await sleep(GAP);
  }
  if (!stop) stop = `PAGE CAP ${MAXPAGES} BOUND - TRUNCATED at ${start + PAGE} of ${total} hits`;
  return { total, pages, entriesSeen, kept, stop };
}

for (const [tag, q] of Q) {
  if (ONLY.length && !ONLY.includes(tag)) continue;

  let r;
  if (VIA === "search") r = await harvestViaSearch(tag, q);
  else {
    r = await harvestViaApi(tag, q);
    // auto: the API is rate-limited separately from arxiv.org and fails for hours at a
    // time. Falling back keeps a sweep from returning nothing at all.
    if (VIA === "auto" && /FAILED after retries/.test(r.stop)) {
      hardFail--;                                   // the API attempt is not the verdict
      console.error(`${tag.padEnd(16)} API unavailable (${r.stop}) - falling back to arxiv.org/search`);
      const s = await harvestViaSearch(tag, q);
      r = { ...s, stop: `${s.stop} [via arxiv.org/search; API said ${r.stop}]` };
    }
  }
  const { total, pages, entriesSeen, kept, stop } = r;

  audit.push({ tag, q, total: total ?? "", pages, entriesSeen, kept, stop });
  console.error(`${tag.padEnd(16)} ${String(total ?? "?").padStart(6)} hits  ${String(pages).padStart(3)}p  ` +
                `${String(entriesSeen).padStart(4)} seen  ${String(kept).padStart(4)} since ${SINCE}  [${stop}]`);
  await sleep(GAP);
}

const rows = [...seen.values()].sort((a, b) => b.sc - a.sc || b.d.localeCompare(a.d));
fs.writeFileSync(OUT,
  "score\tdate\tarxiv\tpeer_reviewed\tjournal_ref\tdoi\ttitle\tfamilies\tquery_tag\n" +
  rows.map(r => [r.sc, r.d, r.id, r.jr ? "yes" : "no", r.jr, r.doi, r.ti, r.fam || "", r.tag].join("\t")).join("\n") + "\n");

fs.writeFileSync("sweep-queries.tsv",
  "query_tag\ttotal_hits\tpages_fetched\tentries_seen\tkept\tstop_reason\tquery\n" +
  audit.map(a => [a.tag, a.total, a.pages, a.entriesSeen, a.kept, a.stop, a.q].join("\t")).join("\n") + "\n");

const trunc = audit.filter(a => a.stop.startsWith("PAGE CAP"));
console.error(`\n${rows.length} unique candidates -> ${OUT} (${newThisRun} new this run, ${carried} carried)`);
console.error(`${audit.length} queries audited -> sweep-queries.tsv`);
if (trunc.length) console.error(`TRUNCATED by the page cap: ${trunc.map(a => a.tag).join(" ")}; raise --max-pages`);
if (hardFail) {
  console.error(`\n!! ${hardFail} QUERIES FAILED OR WERE REJECTED. This harvest is INCOMPLETE.`);
  console.error(`!! See sweep-queries.tsv. Prior candidates were carried forward, so nothing was lost.`);
  process.exit(1);
}
