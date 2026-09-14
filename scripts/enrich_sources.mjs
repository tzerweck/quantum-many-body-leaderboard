// Resolve every paper identifier in the table to authors, institutions and countries,
// and cache the result in sources/openalex.json.
//
// Run by hand, NOT from build.sh: this is the only script that touches the network, and
// the build must stay offline and byte-idempotent. The cache is committed, so a rebuild
// on a fresh clone produces the same tables without an API key or a connection. Only
// identifiers missing from the cache are fetched; pass --refresh to re-fetch everything.
//
//   node scripts/enrich_sources.mjs [--refresh]
//
// Source is OpenAlex: one call gives title, year, DOI, the author list, institutions and
// ISO country codes. arXiv ids resolve through their DataCite DOI, 10.48550/arXiv.<id>.
import fs from "node:fs";
import path from "node:path";
import { collect } from "./summary.mjs";

// NOT under data/: emit.mjs wipes that directory on every build, and this cache is an
// expensive network artefact that must survive a rebuild. It is committed.
const CACHE = "sources/openalex.json";
const MAILTO = "finance@kayba.ai"; // OpenAlex "polite pool" - faster and rate-limit-friendly
const UA = { headers: { "User-Agent": `qmbl/0.1 (mailto:${MAILTO})` } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A reference may carry an arXiv id, a journal DOI, both, or only a link to a run
// script. VarBench cited code rather than papers for a large part of its table, so
// "no identifier" is a common and honest outcome, not a parse failure.
export function identify(ref) {
  ref = ref || "";
  const arxiv = ref.match(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})|arXiv:\s?(\d{4}\.\d{4,5})/i);
  const doi = ref.match(/10\.\d{4,9}\/[^\s)\]]+/);
  if (doi) return { key: `doi:${doi[0]}`, doi: doi[0] };
  if (arxiv) { const id = arxiv[1] || arxiv[2]; return { key: `arxiv:${id}`, arxiv: id }; }
  return null;
}

const get = async url => {
  const r = await fetch(url, UA);
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  return j && !j.error ? j : null;
};

const affiliations = w => ({
  institutions: [...new Set((w.authorships || []).flatMap(a => a.institutions.map(i => i.display_name)))],
  countries: [...new Set((w.authorships || []).flatMap(a => a.countries || []))],
});

// The FIRST author's affiliation, kept separately from the paper-wide lists. A paper
// with twelve authors across four countries has no single country; the first author's
// institution is the one defensible choice, and it is what the by-country view uses.
//
// Note what this is NOT: it is an institution's country, not anyone's nationality.
// A Chinese researcher at ETH counts as CH here. The field name says "institution"
// so that no reader has to guess which of the two was meant.
const firstAuthor = w => {
  const a = (w.authorships || [])[0];
  return {
    first_author_institution: a?.institutions?.[0]?.display_name ?? null,
    first_author_institution_country: a?.countries?.[0] ?? a?.institutions?.[0]?.country_code ?? null,
  };
};

// DataCite mints the arXiv DOIs, so it has every preprint the moment it is posted -
// including the recent ones OpenAlex has not indexed yet. Thinner data (rarely any
// affiliation), but it is authors and a year where the alternative is nothing.
// Names arrive as "Chen, Ao", which is flipped here so one surname rule serves both.
async function resolveDatacite(id) {
  const doi = id.doi || `10.48550/arXiv.${id.arxiv}`;
  const j = await get(`https://api.datacite.org/dois/${doi}`);
  const a = j?.data?.attributes;
  if (!a) return null;
  const authors = (a.creators || []).map(c => {
    const n = c.name || [c.givenName, c.familyName].filter(Boolean).join(" ");
    const m = n.match(/^([^,]+),\s*(.+)$/);
    return m ? `${m[2]} ${m[1]}` : n;
  });
  const institutions = [...new Set((a.creators || [])
    .flatMap(c => (c.affiliation || []).map(x => x.name || x).filter(Boolean)))];
  return {
    key: id.key, resolved_via: doi, openalex: null,
    doi: id.doi ?? doi,
    title: a.titles?.[0]?.title ?? null,
    year: a.publicationYear ?? null,
    type: a.types?.resourceTypeGeneral?.toLowerCase() ?? "preprint",
    venue: a.publisher ?? null,
    authors, institutions, countries: [],
    first_author_institution: institutions[0] ?? null,
    first_author_institution_country: null,
    affiliations_from: null,
    source_api: "datacite",
    checked_on: new Date().toISOString().slice(0, 10),
  };
}

async function resolve(id) {
  const doi = id.doi || `10.48550/arXiv.${id.arxiv}`;
  let w = await get(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`);
  if (!w) return resolveDatacite(id);

  let { institutions, countries } = affiliations(w);
  let first = firstAuthor(w);
  let merged_from = null;
  // Preprint records in OpenAlex usually carry the author list but no affiliations. The
  // published version of the same paper does, so when we land on a bare preprint we look
  // it up by title and take the affiliations from there - the authors stay the preprint's.
  if (!institutions.length && w.display_name) {
    await sleep(150);
    const q = `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(w.display_name)}&per_page=5`;
    const alt = await get(q);
    const hit = (alt?.results || []).find(r =>
      r.id !== w.id && affiliations(r).institutions.length &&
      r.display_name?.toLowerCase() === w.display_name.toLowerCase());
    if (hit) {
      ({ institutions, countries } = affiliations(hit));
      first = firstAuthor(hit);
      merged_from = hit.doi || hit.id;
    }
  }

  const authors = (w.authorships || []).map(a => a.author.display_name);
  return {
    key: id.key,
    resolved_via: doi,
    openalex: w.id,
    doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//, "") : null,
    title: w.display_name || null,
    year: w.publication_year ?? null,
    type: w.type || null,
    venue: w.primary_location?.source?.display_name || null,
    authors,
    institutions,
    countries,
    ...first,
    // Recorded so a later reader can tell a genuine "no affiliation data" from one we
    // patched in from the published version of the same paper.
    affiliations_from: merged_from,
    source_api: "openalex",
    checked_on: new Date().toISOString().slice(0, 10),
  };
}

// Read the committed cache, with locally-parsed affiliations layered on top. Every
// consumer goes through this rather than reading the files directly, so there is one
// place that knows what to do when either is absent.
//
// The local layer only fills gaps: where a registry supplied a first-author affiliation
// it wins, because it is the checkable one. affiliations_local.mjs only ever writes
// entries the registries left empty, so in practice the two do not overlap.
const LOCAL = "sources/affiliations-local.json";
export function sources() {
  const base = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
  if (!fs.existsSync(LOCAL)) return base;
  for (const [key, loc] of Object.entries(JSON.parse(fs.readFileSync(LOCAL, "utf8")))) {
    const s = base[key];
    if (!s || s.first_author_institution_country) continue;
    s.first_author_institution = s.first_author_institution ?? loc.first_author_institution;
    s.first_author_institution_country = loc.first_author_institution_country;
    s.first_author_country_from = loc.from;
  }
  return base;
}

// The metadata for a row, or null when its reference names no paper at all.
export function sourceOf(row, cache = sources()) {
  const id = identify(row.reference);
  return id ? cache[id.key] ?? null : null;
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  const cache = refresh ? {} : sources();

  const wanted = new Map();
  let noId = 0;
  for (const inst of collect())
    for (const r of inst.rows) {
      const id = identify(r.reference);
      if (id) wanted.set(id.key, id); else noId++;
    }

  const todo = [...wanted.values()].filter(id => !cache[id.key]);
  console.log(`${wanted.size} distinct identifiers, ${todo.length} to fetch, ${noId} rows carry no identifier`);

  let ok = 0;
  for (const [i, id] of todo.entries()) {
    const rec = await resolve(id);
    if (rec) { cache[id.key] = rec; ok++; }
    else console.log(`  UNRESOLVED ${id.key}`);
    process.stdout.write(`\r  ${i + 1}/${todo.length}`);
    await sleep(150);
  }
  console.log(`\nresolved ${ok}/${todo.length}`);

  // Sorted so the committed file has a stable diff.
  const sorted = Object.fromEntries(Object.keys(cache).sort().map(k => [k, cache[k]]));
  fs.writeFileSync(CACHE, JSON.stringify(sorted, null, 2) + "\n");
  const withInst = Object.values(sorted).filter(s => s.institutions.length).length;
  console.log(`${CACHE}: ${Object.keys(sorted).length} sources, ${withInst} with institutions`);
}

// Network access only when run directly - importing this module must never fetch.
if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) await main();
