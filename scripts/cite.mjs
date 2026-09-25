// Render a row's reference as a human citation, linked to its DOI.
//
// "[paper]" tells a reader nothing. "Nomura & Imada (2021)" tells them whose result
// holds the record, and the link goes to the DOI rather than to a publisher URL that
// will rot. Rows whose reference names no paper - VarBench cited run scripts for a
// large part of its table - keep the code link and are visibly marked as such.
import { sourceOf, sources, paperOf, identify } from "./enrich_sources.mjs";

// Last name for the citation. Both registries are inconsistent about ordering: most
// records read "Yuntian Gu", some read "Gu, Yuntian". The comma form is unambiguous
// and must be checked first - taking the trailing word of "Gu, Yuntian" cites the
// paper as "Yuntian et al.", which is someone's given name in a public attribution
// table. Remaining wrong case is unmarked particles ("van der Waals"); the full author
// list is in sources/openalex.json when the exact form matters.
const surname = name => {
  const n = (name || "").trim();
  const comma = n.match(/^([^,]+),/);
  return comma ? comma[1].trim() : n.split(/\s+/).pop();
};

export function citeText(s) {
  const a = s.authors || [];
  const y = s.year ? ` (${s.year})` : "";
  if (!a.length) return (s.title || "source").slice(0, 40) + y;
  if (a.length === 1) return `${surname(a[0])}${y}`;
  if (a.length === 2) return `${surname(a[0])} & ${surname(a[1])}${y}`;
  return `${surname(a[0])} et al.${y}`;
}

export const citeUrl = s =>
  s.doi ? `https://doi.org/${s.doi}`
    : s.resolved_via?.startsWith("10.48550/arXiv.")
      ? `https://arxiv.org/abs/${s.resolved_via.replace("10.48550/arXiv.", "")}`
      : s.openalex;

// Author-year read off a reference that has no resolved paper behind it: the leading run
// of personal names and the publication year after them. The names are the forms the rows
// use - "W.-J. Hu, F. Becca, A. Parola, and S. Sorella", "Choo, Neupert & Carleo",
// "Francesco Ferrari, Federico Becca, and Juan Carrasquilla." - and a candidate counts only
// when what follows it is a list separator or the end of the list, so a title's first words
// ("C. Roth, Iterative Retraining of ...") are not taken for an author. Null unless both
// the names and a year are found: the caller then shows the reference text, never a guess.
const QUOTING = /\([^()]*\b(?:cited|quoted)\b[^()]*\)/gi;
const PART = "\\p{Lu}[\\p{L}'’-]+";
const NAME = new RegExp(`^(?:(?:\\p{Lu}\\.(?:-\\p{Lu}\\.)?\\s?)+(?:${PART}\\s)?${PART}|${PART}(?:\\s(?:\\p{Lu}\\.|${PART})){0,2})`, "u");
const NEXT = /^(?:,\s+and\s+|\s+and\s+|\s*&\s*|,\s+)/;
const ENDS = /^(?:[,.]|\s\(|$)/;
function authorYear(ref) {
  let rest = ref.replace(QUOTING, "").trim();
  const names = [];
  for (let last = false; ;) {
    const m = rest.match(NAME);
    if (!m) { if (last) return null; break; }
    const after = rest.slice(m[0].length), sep = after.match(NEXT);
    if (last || !sep) {
      if (ENDS.test(after)) { names.push(m[0]); rest = after; }
      // After "and" the next name must be the last one; one that does not read off cleanly
      // would silently drop an author, so give up rather than cite a shorter list.
      else if (last) return null;
      break;
    }
    names.push(m[0]);
    rest = after.slice(sep[0].length);
    if (/^et al\./.test(rest)) { names.push("et al."); rest = rest.slice(7); break; }
    last = /and|&/.test(sep[0]);
  }
  const year = rest.match(/\(((?:19|20)\d{2})\)/)?.[1] ?? rest.match(/(?<![\d.:\/])((?:19|20)\d{2})(?!\d|\.\d)/)?.[1];
  if (!names.length || !year) return null;
  const s = names.map(x => x.split(/\s+/).pop());
  const who = s.length === 1 ? s[0] : s.length === 2 && s[1] !== "al." ? `${s[0]} & ${s[1]}` : `${s[0]} et al.`;
  return { text: `${who} (${year})`, year: +year };
}

// The year a row's number was published: its resolved paper's, else the year read off the
// reference text. The site's year column, the currency counts and the year figures use this.
export const paperYear = (row, cache = sources()) =>
  sourceOf(row, cache)?.year ?? (row.reference && !/\]\(https?:/.test(row.reference) ? authorYear(row.reference)?.year ?? null : null);

// The source of a row as text + url, before any markup. Falls back to the reference itself
// when the row names no paper we have resolved, so nothing is ever silently dropped: an
// identifier not yet in the cache is shown and linked as itself, a citation without one as
// author-year where that reads off cleanly, else as its opening words. A quoted row with no
// paper of its own says where it was read. The README renders this as markdown and the site
// as HTML; splitting it here is what keeps the citation under a number identical in both.
// A row QMBL computed cites the code that produced it, at the commit that ran, so it can be rerun.
const REPO = "https://github.com/tzerweck/quantum-many-body-leaderboard";

export function citeRef(row, cache = sources()) {
  if (row.computed_by === "qmbl") {
    const commit = (row.reference || "").match(/commit ([0-9a-f]{7,40})/)?.[1];
    return { text: "QMBL run", url: commit ? `${REPO}/tree/${commit}/checks/cost` : `${REPO}/tree/main/checks/cost`, note: "code, protocol and results" };
  }
  const s = sourceOf(row, cache);
  if (s) return { text: citeText(s), url: citeUrl(s) };
  const ref = row.reference || "";
  const code = ref.match(/\[code\]\((https?:\/\/[^\s)]+)\)/);
  if (code) return { text: "run script", url: code[1], note: "no paper cited" };
  const link = ref.match(/\((https?:\/\/[^\s)]+)\)/);
  if (link) return { text: "source", url: link[1] };
  const via = row.verified?.secondary_of && identify(row.verified.secondary_of);
  const note = via && cache[via.key] ? `quoted in ${citeText(cache[via.key])}` : undefined;
  const id = paperOf(row);
  if (id) return id.arxiv
    ? { text: `arXiv:${id.arxiv}`, url: `https://arxiv.org/abs/${id.arxiv}`, note }
    : { text: id.doi, url: `https://doi.org/${id.doi}`, note };
  const ay = authorYear(ref);
  if (ay) return { text: ay.text, url: null, note };
  const plain = ref.replace(QUOTING, "").trim();
  const cut = plain.length <= 40 ? plain : plain.slice(0, 40).replace(/[\s,;:.]+\S*$/, "") + "…";
  return { text: cut || "n/a", url: null, note };
}

// Markdown for the source cell.
export function citeCell(row, cache = sources()) {
  const r = citeRef(row, cache);
  const link = r.url ? `[${r.text}](${r.url})` : r.text;
  return r.note ? `${link}, ${r.note}` : link;
}
