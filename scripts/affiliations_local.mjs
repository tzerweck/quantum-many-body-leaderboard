// Extract the first author's affiliation from the paper itself, for the sources where
// OpenAlex has none.
//
// Why this exists: every source missing an affiliation is an arXiv preprint, and that
// is not a random gap - it is the newest work, which is where the current frontier and
// several of the record-holding groups are. Building a by-country view on OpenAlex
// alone reported China once while the papers holding four of the nine frontier records
// are from the Chinese Academy of Sciences and Peking University. The affiliations are
// printed on the papers we already downloaded, so we read them there.
//
// Output goes to sources/affiliations-local.json, a SEPARATE committed file rather than
// an edit to the OpenAlex cache, so that `enrich_sources.mjs --refresh` cannot silently
// discard it. Run by hand after a sweep adds papers:
//
//   node scripts/affiliations_local.mjs
import fs from "node:fs";
import path from "node:path";
import { collect } from "./summary.mjs";
import { identify, sources } from "./enrich_sources.mjs";

const OUT = "sources/affiliations-local.json";

// Enough of the world to cover this literature. Order matters only in that longer,
// more specific names are tested first ("South Korea" before "Korea").
const COUNTRIES = [
  // "State Key Laboratory" is a PRC national programme, so the phrase identifies the
  // country on its own - which matters because those affiliation lines often name the
  // laboratory and put the university on a separate line that gets split away.
  ["CN", /\bchina\b|\bp\.?\s?r\.?\s?china\b|beijing|shanghai|hefei|shenzhen|tsinghua|peking university|chinese academy|state key laborator|bytedance/i],
  ["US", /\bu\.?\s?s\.?a\.?\b|\bunited states\b|massachusetts|california|new york|illinois|princeton|harvard|\bmit\b|flatiron/i],
  ["JP", /\bjapan\b|tokyo|kyoto|osaka|riken|waseda/i],
  ["DE", /\bgermany\b|münchen|munich|berlin|augsburg|dresden|stuttgart|max.?planck/i],
  ["CH", /\bswitzerland\b|zürich|zurich|lausanne|geneva|genève|\bepfl\b|\beth\b|\bpsi\b/i],
  ["FR", /\bfrance\b|paris|saclay|grenoble|toulouse|marseille|palaiseau|\bcnrs\b/i],
  ["IT", /\bitaly\b|trieste|rome|roma|milano|\bsissa\b|padova|pisa/i],
  ["GB", /\bunited kingdom\b|\bu\.?k\.?\b|england|london|oxford|cambridge, uk|edinburgh|\bnottingham\b/i],
  ["CA", /\bcanada\b|toronto|waterloo|vancouver|montreal|montréal|perimeter institute/i],
  ["AT", /\baustria\b|vienna|wien|graz|innsbruck/i],
  ["NL", /\bnetherlands\b|amsterdam|delft|leiden|utrecht/i],
  ["BE", /\bbelgium\b|ghent|gent|leuven|brussels/i],
  ["SG", /\bsingapore\b/i],
  ["KR", /\bsouth korea\b|\brepublic of korea\b|\bkorea\b|seoul/i],
  ["IN", /\bindia\b|mumbai|bangalore|bengaluru|\biit\b/i],
  ["RU", /\brussia\b|moscow|petersburg/i],
  ["ES", /\bspain\b|madrid|barcelona|donostia|san sebastián/i],
  ["SE", /\bsweden\b|stockholm|uppsala|gothenburg/i],
  ["DK", /\bdenmark\b|copenhagen|aarhus/i],
  ["IL", /\bisrael\b|jerusalem|tel aviv|weizmann|technion/i],
  ["AU", /\baustralia\b|sydney|melbourne|brisbane/i],
  ["CZ", /\bczech\b|prague|praha/i],
  ["PL", /\bpoland\b|warsaw|krakow|kraków/i],
  ["BR", /\bbrazil\b|são paulo|sao paulo|rio de janeiro/i],
];
// Email domains settle cases the institution name cannot. "Northeastern University"
// is in Boston and also in Shenyang; "@northeastern.edu" is decisively the former,
// since a Chinese university would be .edu.cn. Checked before the name patterns.
const TLDS = [
  [/@[\w.-]+\.edu\.cn\b|@[\w.-]+\.ac\.cn\b|@[\w.-]+\.cn\b/i, "CN"],
  [/@[\w.-]+\.ac\.uk\b|@[\w.-]+\.uk\b/i, "GB"],
  [/@[\w.-]+\.edu\b/i, "US"],
  [/@[\w.-]+\.ac\.jp\b|@[\w.-]+\.jp\b/i, "JP"],
  [/@[\w.-]+\.ch\b/i, "CH"], [/@[\w.-]+\.de\b/i, "DE"], [/@[\w.-]+\.fr\b/i, "FR"],
  [/@[\w.-]+\.it\b/i, "IT"], [/@[\w.-]+\.ca\b/i, "CA"], [/@[\w.-]+\.nl\b/i, "NL"],
  [/@[\w.-]+\.at\b/i, "AT"], [/@[\w.-]+\.be\b/i, "BE"], [/@[\w.-]+\.es\b/i, "ES"],
];
const countryOf = text => {
  const t = text || "";
  return TLDS.find(([re]) => re.test(t))?.[1]
    ?? COUNTRIES.find(([, re]) => re.test(t))?.[0]
    ?? null;
};

const strip = s => s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();

// arXiv's LaTeXML HTML marks up authors and their affiliations explicitly. We take the
// block up to the SECOND author's name, so the affiliations we read belong to the first.
function fromHtml(html) {
  const block = html.match(/<div class="ltx_authors">([\s\S]{0,24000}?)<\/div>\s*<\/div>/)
    || html.match(/<div class="ltx_authors">([\s\S]{0,24000})/);
  if (!block) return null;
  // Class attributes carry several classes at once ("ltx_contact ltx_role_affiliation")
  // and the spans nest, so matching them by regex is fragile - a lazy close bracket
  // swallows the next affiliation or stops inside the label. Strip the tags first and
  // work on the text, where "Affiliation:" is a reliable separator.
  const names = [...block[1].matchAll(/<span class="[^"]*ltx_personname[^"]*">([\s\S]{0,300}?)<\/span>/g)];
  const firstName = names.length
    ? strip(names[0][1]).replace(/\s*(thanks|affiliation):.*$/i, "").trim()
    : null;
  const segments = text => text
    .split(/Affiliation:\s*/i)
    .slice(1)
    .map(a => a.replace(/\s*(Thanks|Email|Contact):.*$/i, "").trim())
    .filter(a => a.length > 4 && !/contributed equally|corresponding author/i.test(a));

  // Two layouts. Normally each author is followed by their own affiliations, so slicing
  // at the second name isolates the first author. But "ltx_authors_1line" lists all
  // eighteen names first and the affiliations afterwards, where that slice cuts the
  // first affiliation mid-sentence. So: use the sliced region when it yields a country,
  // and otherwise fall back to the first affiliation in the document, which belongs to
  // the first author under both layouts.
  let affs = [];
  if (names.length > 1) affs = segments(strip(block[1].slice(0, block[1].indexOf(names[1][0]))));
  if (!affs.some(a => countryOf(a))) {
    const all = segments(strip(block[1]));
    if (all.length) affs = affs.some(a => countryOf(a)) ? affs : all.slice(0, 1);
  }
  // A single affiliation line is sometimes split across spans, so that the line naming
  // the university and the line naming the city sit apart ("... School of Intelligence
  // Science and Technology" / "Peking University"). When no one line carries a country,
  // test them joined - they are all the same author's affiliations either way.
  const withCountry = affs.find(a => countryOf(a));
  const institution = withCountry || affs[0];
  // Fall back through progressively weaker evidence: a single affiliation naming a
  // country, then all of them joined (a line is sometimes split mid-address), then the
  // header text before the first affiliation, which is where contact emails live.
  const header = strip(block[1]).split(/Affiliation:/i)[0];
  const country_hint = withCountry ? null : (countryOf(affs.join(", ")) ?? countryOf(header));
  return institution ? { first_author: firstName, institution, country_hint } : null;
}

// PDF text extracts: affiliations sit in the first ~2000 characters, unstructured. We
// only look for a country name there, since parsing institution lines out of running
// text is guesswork - a country is the one thing stated unambiguously.
function fromText(txt) {
  const head = txt.slice(0, 2500);
  const cc = countryOf(head);
  return cc ? { first_author: null, institution: null, country_hint: cc } : null;
}

const cache = sources();
const out = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};

// Only sources that still lack a first-author country are worth the work.
const wanted = new Map();
for (const inst of collect())
  for (const r of inst.rows) {
    const id = identify(r.reference);
    if (!id?.arxiv) continue;
    const s = cache[id.key];
    if (s && !s.first_author_institution_country) wanted.set(id.key, id.arxiv);
  }

let done = 0, missing = [];
for (const [key, arxiv] of wanted) {
  const html = `sources/${arxiv}.html`, txt = `sources/${arxiv}.txt`;
  let got = null, from = null;
  if (fs.existsSync(html)) { got = fromHtml(fs.readFileSync(html, "utf8")); from = html; }
  if (!got && fs.existsSync(txt)) { got = fromText(fs.readFileSync(txt, "utf8")); from = txt; }
  if (!got) { missing.push(`${key} (no local copy or no parseable author block)`); continue; }
  const country = got.country_hint ?? countryOf(got.institution);
  if (!country) { missing.push(`${key} (affiliation found, country unrecognised: "${got.institution?.slice(0, 60)}")`); continue; }
  out[key] = {
    first_author: got.first_author,
    first_author_institution: got.institution,
    first_author_institution_country: country,
    from,
    checked_on: new Date().toISOString().slice(0, 10),
  };
  done++;
}

const sorted = Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
fs.writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`${wanted.size} sources lacked a country; resolved ${done} locally, ${missing.length} still open`);
for (const m of missing) console.log(`  ${m}`);
console.log(`${OUT}: ${Object.keys(sorted).length} entries`);
