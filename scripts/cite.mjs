// Render a row's reference as a human citation, linked to its DOI.
//
// "[paper]" tells a reader nothing. "Nomura & Imada (2021)" tells them whose result
// holds the record, and the link goes to the DOI rather than to a publisher URL that
// will rot. Rows whose reference names no paper - VarBench cited run scripts for a
// large part of its table - keep the code link and are visibly marked as such.
import { sourceOf, sources } from "./enrich_sources.mjs";

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

// Markdown for the source cell. Falls back to the raw reference when the row names no
// paper, so nothing is ever silently dropped.
export function citeCell(row, cache = sources()) {
  const s = sourceOf(row, cache);
  if (s) return `[${citeText(s)}](${citeUrl(s)})`;
  const ref = row.reference || "";
  const code = ref.match(/\[code\]\((https?:\/\/[^\s)]+)\)/);
  if (code) return `[run script](${code[1]}) &mdash; no paper cited`;
  const link = ref.match(/\((https?:\/\/[^\s)]+)\)/);
  return link ? `[source](${link[1]})` : (ref.slice(0, 32) || "n/a");
}
