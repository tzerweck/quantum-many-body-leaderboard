// Build the read-only site at qmbl.org into _site/.
//
// Generated from data/ by the same modules the README is generated from: units.mjs for
// every conversion, summary.mjs for what a record is, readme_table.mjs for how an
// instance is named and how a number is quoted. The site and the README therefore cannot
// disagree about a number - if they ever do, one of those modules is wrong and both
// surfaces are wrong together, which is the only kind of disagreement worth having.
//
// The figures on the front page are the committed figures/*.svg, drawn by size_accuracy.mjs
// and pareto.mjs from the same data/; this script only copies them. A figure carries its
// own title and subtitle, so the page puts nothing above it; the title and caption listed
// here are its alt text.
// RULES.md and DATA.md are not rendered here - they live on GitHub, and /rules/ and
// /data/ redirect there so links that predate the change keep resolving.
//
// No dependencies and no build step: plain strings, written once. `_site/` is generated
// output and is never committed.
import fs from "node:fs";
import path from "node:path";
import { perSiteDivisor, perSiteLabel, isSampled, recordEligible } from "./units.mjs";
import { collect, recordOf, summarize } from "./summary.mjs";
import { citeRef } from "./cite.mjs";
import { sources, sourceOf } from "./enrich_sources.mjs";
import { quote, marks, shorten, MODELS, BOUNDARY, instanceLabel, byGeometry, noRecordReason, gapAbove } from "./readme_table.mjs";
import { logoSvg, faviconSvg, LOGO_CSS } from "./logo.mjs";

const OUT = "_site";
const REPO = "https://github.com/tzerweck/quantum-many-body-leaderboard";
const RULES = `${REPO}/blob/main/RULES.md`;
const DATA = `${REPO}/blob/main/DATA.md`;
const DOI = "10.5281/zenodo.22753734";
const SNAPSHOT = "varbench@2024-10-22";
const BUILT = new Date().toISOString().slice(0, 10);

// The citation the Cite button copies and the front page prints, from CITATION.cff so a
// release bump changes it in one place.
const CFF = fs.readFileSync("CITATION.cff", "utf8");
const cffField = k => CFF.match(new RegExp(`^${k}:\\s*"?([^"\\n]+)"?\\s*$`, "m"))?.[1];
const VERSION = cffField("version");
const RELEASED = cffField("date-released");
if (!VERSION || !RELEASED) throw new Error("CITATION.cff: version or date-released not found");
const CITATION = `Tristan Zerweck, QMBL - the Quantum Many-Body Leaderboard, v${VERSION}, Zenodo (${RELEASED.slice(0, 4)}). https://doi.org/${DOI}`;

const cache = sources();
const instances = collect();
const summary = summarize(instances);

// ------------------------------------------------------------------------------ html
const esc = s => String(s)
  // Entities written in the source markdown (&#9675;, &dagger;) must survive escaping;
  // a bare ampersand must not.
  .replace(/&(?![#A-Za-z0-9]+;)/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const NAV = [
  ["/", "Leaderboard"],
  ["/instances/", "Instances"],
  ["/contribute/", "Contribute"],
];

// GitHub's mark (octicon mark-github, MIT), inline so it takes the nav's colour.
const GITHUB_MARK = `<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

// The Cite button copies CITATION; where the clipboard is unavailable (no HTTPS, an old
// browser, a denied permission) it goes to the citing section on the front page instead,
// so the button never does nothing.
const CITE_SCRIPT = `<script>
for (const b of document.querySelectorAll("button.cite-btn")) b.addEventListener("click", () => {
  const done = () => { b.classList.add("copied"); b.querySelector("span").textContent = "Copied";
    setTimeout(() => { b.classList.remove("copied"); b.querySelector("span").textContent = "Cite"; }, 2000); };
  const fallback = () => { location.href = "/#cite"; };
  if (navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(b.dataset.cite).then(done, fallback);
  else fallback();
});
</script>`;

function page({ url, title, description, body, wide = false }) {
  const head = title === null ? "QMBL" : `${title} &middot; QMBL`;
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${head}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="https://qmbl.org${url}">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="${esc(title ?? "QMBL - the Quantum Many-Body Leaderboard")}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://qmbl.org${url}">
<header class="site">
  <a class="wordmark" href="/">${logoSvg()}<b>QMBL<span>the quantum many-body leaderboard</span></b></a>
  <nav>${NAV.map(([href, label]) =>
    `<a href="${href}"${href === url ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
    <a class="ext" href="${REPO}" aria-label="QMBL on GitHub" title="Source and data on GitHub">${GITHUB_MARK}</a>
    <button class="cite-btn" type="button" data-cite="${esc(CITATION)}" title="Copy the citation">&#10077;<span>Cite</span></button></nav>
</header>
<main class="${wide ? "wide" : ""}">
${body}
</main>
<footer class="site">
  <p><a href="${REPO}">Source and data on GitHub</a> &middot; Apache-2.0 &middot;
     cite <a href="https://doi.org/${DOI}">${DOI}</a> &middot;
     <a href="/api/qmbl.json">JSON</a> &middot; <a href="/llms.txt">llms.txt</a></p>
  <p class="muted">Every energy on this site is someone else's published result, cited on its row.
     Built ${BUILT} from <a href="${REPO}/tree/main/data">data/</a>.</p>
</footer>
${CITE_SCRIPT}
</html>
`;
}

// ---------------------------------------------------------------------- redirects
// RULES.md and DATA.md are read on GitHub. /rules/ and /data/ existed as rendered pages
// until 2026-09-16 and are linked from outside, so each keeps a page that forwards to the
// file - fragment included, so a link to a section still lands on that section.
function redirectPage(url, target, title) {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${target}">
<title>${title} &middot; QMBL</title>
<script>location.replace("${target}" + location.hash);</script>
<p>${title} now lives on GitHub: <a href="${target}">${target}</a></p>
</html>
`;
}

// ------------------------------------------------------------------------------- data
const instUrl = inst => `/i/${inst.instance_id}/`;
const jsonUrl = inst => `/api/i/${inst.instance_id}.json`;
const yearOf = r => sourceOf(r, cache)?.year ?? null;

const BOUND_ORDER = ["variational", "projected", "extrapolated", "exact", null];
const BOUND_LABEL = {
  variational: "Strict variational upper bounds",
  projected: "Projected or fixed-node estimates",
  extrapolated: "Extrapolations",
  exact: "Numerically exact",
  null: "Not yet classified",
};
const BOUND_NOTE = {
  variational: "Where the instance is not solved, the record is the lowest eligible energy in this group; where it is, the lowest eligible energy here is the best variational bound and the closest challenger to the exact one.",
  projected: "Variational only within a constraint: fixed-node, constrained-path, GFMC on a trial state. Node- or constraint-dependent, so not cleanly comparable to each other or to the group above, and never the record.",
  extrapolated: "Zero-variance, bond-dimension or Trotter-error extrapolations. Not a bound: no ansatz ever reached the number, so it cannot hold the record.",
  exact: "Exact diagonalization, an exact solution, or sign-problem-free QMC where that is established: the answer, not a claim about it, and therefore the record wherever one exists. Sector-resolved diagonalizations state the lowest energy in one symmetry sector and do not hold it.",
  null: "The method string does not say whether the energy is sign-problem-free or constrained, so no bound_type could be assigned without guessing.",
};

// The energy as the papers quote it, in the instance's own convention.
function perSite(row, inst) {
  const f = perSiteDivisor(inst) ?? 1;
  return { energy: row.energy / f, sigma: row.sigma == null ? null : row.sigma / f };
}

// One significant digit of uncertainty, the energy truncated to match. readme_table.mjs
// owns that convention; this only feeds it the converted numbers.
const quoteRow = (row, inst) => quote(perSite(row, inst).energy, perSite(row, inst).sigma);

// `decimals` forces a challenger to be quoted at the record's precision, so the two are
// readable against each other.
function energyCell(row, inst, decimals) {
  const { energy, sigma } = perSite(row, inst);
  const q = decimals == null ? quote(energy, sigma) : { text: energy.toFixed(decimals) };
  return `<span class="num">${q.text}</span>${marks(row)}`;
}

function citeHtml(row) {
  const r = citeRef(row, cache);
  const link = r.url ? `<a href="${esc(r.url)}">${esc(r.text)}</a>` : esc(r.text);
  return r.note ? `${link}<span class="muted">, ${r.note}</span>` : link;
}

// What the instance page says about its own currency: when the newest number here was
// published, whether anything has been added since the VarBench snapshot, and - only where
// an instance carries a `coverage` entry (DATA.md) - when its literature was last checked,
// how, and whether that check found anything. No sentence claims a search that was not run.
function coverage(inst) {
  const added = inst.rows.filter(r => r.source !== SNAPSHOT);
  const years = inst.rows.map(yearOf).filter(Boolean);
  const newest = years.length ? Math.max(...years) : null;
  const when = newest ? `Newest published number here: <strong>${newest}</strong>.` :
    "No row here carries a publication year.";
  const rows = added.length
    ? `${when} ${added.length} row${added.length === 1 ? "" : "s"} added from the 2026-09 literature sweep, on top of the VarBench snapshot of 2024-10-22.`
    : `${when} Nothing has been added to this instance since the VarBench snapshot of 2024-10-22.`;
  const last = (inst.coverage ?? []).at(-1);
  if (!last) return rows;
  const n = last.screened?.length ?? last.screened_count;
  return `${rows} Literature last checked <strong>${last.checked_on}</strong> (${last.method}): ${n} paper${n === 1 ? "" : "s"} read, ${last.found} of them with an energy on this page.`;
}

// Written out because an instance is only a claim if the Hamiltonian is stated. Couplings
// come from the instance's own params; J1 = 1 and t = 1 set the energy scale.
function hamiltonian(inst) {
  const p = inst.params ?? {};
  const s = (x, y) => `<span class="ham">${x}</span>${y ?? ""}`;
  const sum = sub => `&sum;<sub>${sub}</sub>`;
  const nn = "&#10216;ij&#10217;";
  const nnn = "&#10216;&#10216;ij&#10217;&#10217;";
  const dot = "&sigma;<sub>i</sub>&middot;&sigma;<sub>j</sub>";
  switch (inst.model) {
    case "Heisenberg":
      return { formula: `H = ${sum(nn)} ${dot}`,
        note: "Nearest-neighbour Heisenberg antiferromagnet, J = 1, written with Pauli matrices." };
    case "J1J2":
      return { formula: `H = ${sum(nn)} ${dot} + J<sub>2</sub> ${sum(nnn)} ${dot}`,
        note: `J<sub>1</sub> = 1, J<sub>2</sub> = ${p.J2}, nearest and next-nearest neighbours, written with Pauli matrices.` };
    case "TFIsing":
      return { formula: `H = &minus;${sum(nn)} &sigma;<sup>z</sup><sub>i</sub>&sigma;<sup>z</sup><sub>j</sub> &minus; h ${sum("i")} &sigma;<sup>x</sup><sub>i</sub>`,
        note: `Transverse field h = ${p.h}. Already in Pauli operators, with no S&middot;S term to rescale, so the per-site energy is E/N.` };
    case "Hubbard":
      return { formula: `H = &minus;t ${sum(`${nn},&sigma;`)} (c<sup>&dagger;</sup><sub>i&sigma;</sub>c<sub>j&sigma;</sub> + h.c.) + U ${sum("i")} n<sub>i&uarr;</sub>n<sub>i&darr;</sub>`,
        note: `t = 1, U = ${p.U}, N<sub>&uarr;</sub> = N<sub>&darr;</sub> = ${p.Nf} on ${inst.n_sites} sites.` };
    case "tV":
      return { formula: `H = &minus;t ${sum(nn)} (c<sup>&dagger;</sup><sub>i</sub>c<sub>j</sub> + h.c.) + V ${sum(nn)} n<sub>i</sub>n<sub>j</sub>`,
        note: `Spinless fermions, t = 1, V = ${p.V}, ${p.Nf} particles on ${inst.n_sites} sites.` };
    default:
      return { formula: null,
        note: `An impurity model from the upstream set (<code>${esc(inst.lattice)}</code>). Its Hamiltonian is defined by VarBench rather than here, so it is identified by name rather than restated, and it has no meaningful per-site energy.` };
  }
}

// Hamiltonian variants VarBench does not document. Named, never interpreted.
function variantNote(inst) {
  if (/_t12(?=_|$)/.test(inst.instance_id))
    return "This instance is the <code>t12</code> variant: it carries a second-neighbour hopping in addition to the above. Upstream does not document its value, so the variant is identified by name rather than written out.";
  if (/_UV1V2(?=_|$)/.test(inst.instance_id))
    return "This instance is the <code>UV1V2</code> variant: it carries extended density-density interactions V<sub>1</sub>, V<sub>2</sub> in addition to U. Upstream does not document their values, so the variant is identified by name rather than written out.";
  return null;
}

// -------------------------------------------------------------------------- home page
// The front page is the figures. Each is drawn into figures/ by the build (size_accuracy.mjs,
// pareto.mjs) and committed; one entry here per figure, light and dark variants side by
// side because an SVG shown as an <img> cannot see the page's colour scheme. The Pareto
// figure joins this list when pareto.mjs draws it.
const FIGURES = [
  ["size-vs-accuracy", "How far published energies sit from the exact answer, by system size",
    "Every energy on an instance with an exact ground-state energy, as its relative distance from that energy. Colour is the kind of number; filled marks can hold a record, hollow ones cannot."],
  ["size-vs-accuracy-by-family", "The same distances, one panel per method family",
    "Each panel colours one family's energies over all the others in grey and joins the family's best distance at each size."],
  ["size-vs-accuracy-ladders", "Accuracy as the same Hamiltonian grows",
    "Six families of instances that differ only in size. Distance is from the exact energy where one exists, otherwise from the standing record, whose holder then sits in the column at the left."],
  ["energy-vs-compute", "What a published energy cost, against how far it sits from the reference",
    "The energies whose papers state what they cost in GPU-hours, or as a device count and a wall-clock, on the instances they were computed for. CPU core-hours are never put on the same axis."],
];

function figure([name, title, caption]) {
  for (const v of [name, `${name}-dark`])
    if (!fs.existsSync(`figures/${v}.svg`)) throw new Error(`figures/${v}.svg is missing; run the build first`);
  return `<figure id="${name}">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="/figures/${name}-dark.svg">
    <img src="/figures/${name}.svg" alt="${esc(title)}. ${esc(caption)}" loading="lazy">
  </picture>
  <figcaption><a href="#${name}" class="anchor" aria-label="Link to this figure">#</a>
    <a href="${REPO}/blob/main/figures/${name}.svg">SVG</a></figcaption>
</figure>`;
}

function homePage() {
  const current = instances.filter(i => i.rows.some(r => (yearOf(r) ?? 0) >= 2025)).length;
  const b = summary.blocked_on_sigma;
  const body = `
<h1>The best published ground-state energies, in one table</h1>
<p class="lead">QMBL is a record book of the state of the art in quantum many-body simulation: one row
per published energy, ranked within each Hamiltonian instance, every row citing the paper that
produced the number and declaring what kind of quantity it is. Where an instance is solved, the
exact energy is the record; everywhere else the best variational bound is.
<a href="/instances/">All ${summary.instances} instances and their ${summary.rows} energies &rarr;</a></p>

${FIGURES.map(figure).join("\n")}

<h2>How current this is</h2>
<p>${current} of ${summary.instances} instances carry a result published in 2025 or 2026; the rest
stand where the <a href="https://doi.org/10.1126/science.adg9774">VarBench</a> compilation left
them on 2024-10-22. Every instance page says which of the two it is, because a website that says
nothing about its own currency reads as more authoritative than it is.</p>
<p>Separately, <b>${b.rows} sampled variational energies across ${b.instances} instances carry no
error bar</b>, so they are listed and rank for nothing &mdash; and ${b.would_take_record} of them sit
below their instance's current record. If one of those is your paper,
<a href="/contribute/">the error bar is the only thing missing</a>.</p>

<h2>What a row claims</h2>
<p>Every row is one published claim about one Hamiltonian instance: the energy, its error bar, the
method, the primary reference, and a declared <code>bound_type</code> saying what the number
actually is &mdash; a strict variational bound, a projected or fixed-node estimate, a zero-variance
extrapolation, or a numerically exact result. An exact result is the record wherever one exists;
on every other instance only strict variational bounds compete for it, which is what keeps an
extrapolated number from beating a measured one.
The rules are in <a href="${RULES}">RULES.md</a>, the row format in <a href="${DATA}">DATA.md</a>.</p>

<section class="cite" id="cite">
  <h2>Citing QMBL</h2>
  <p>Cite the dataset by its concept DOI, which always resolves to the latest release:</p>
  <p class="citation">${esc(CITATION.slice(0, CITATION.indexOf(" https://")))}
  <a href="https://doi.org/${DOI}"><code>${DOI}</code></a></p>
  <p>Individual energies should cite the primary paper named on the row, not this site.</p>
</section>`;
  return page({
    url: "/", title: null, body, wide: true,
    description: `The best published variational ground-state energies for ${summary.instances} lattice Hamiltonian instances, ranked by energy, every row citing its primary paper.`,
  });
}

// ------------------------------------------------------------------------ browse page
// A row is the instance and its record; clicking it opens every energy published for it
// below, in rank order, so the shape of the competition on an instance is one click away
// rather than a page away. The instance page still exists at its stable URL for search
// engines, llms.txt and the API, and is not linked from here; the JSON is.

// The badge families: the lattice name without its cell spec (kagome-36a -> kagome), and
// four size bands. Both are per model, and a band or lattice that no instance of the model
// falls in is not offered.
const latticeOf = inst => inst.lattice.replace(/-.*$/, "");
const SIZE_BANDS = [
  ["s1", n => n <= 36, "&le; 36 sites"],
  ["s2", n => n > 36 && n <= 100, "37&ndash;100"],
  ["s3", n => n > 100 && n <= 400, "101&ndash;400"],
  ["s4", n => n > 400, "&gt; 400"],
];
const sizeBand = inst => SIZE_BANDS.find(([, test]) => test(inst.n_sites))[0];

const BOUND_SHORT = { variational: "variational", projected: "projected", extrapolated: "extrapolated", exact: "exact", null: "unclassified" };

// Every row of the instance, the record marked, challengers with their gap above it. sigma
// is shown because 62% of rows carry one (2026-09-16); Var(E) and the V-score, on 36%, stay
// on the instance page.
function allRows(inst) {
  const rec = recordOf(inst);
  const sorted = [...inst.rows].sort((a, b) => a.energy - b.energy);
  const f = perSiteDivisor(inst) ?? 1;
  const decimals = rec ? quoteRow(rec, inst).decimals : null;
  const rows = sorted.map(r => {
    const isRec = r === rec;
    const gap = rec && !isRec && r.bound_type === "variational" && !r.defect ? gapAbove(rec, r, f, decimals) : null;
    const { sigma } = perSite(r, inst);
    return `<tr class="${isRec ? "is-record" : ""}${r.defect ? " is-flagged" : ""}">
      <td class="record">${energyCell(r, inst, isRec ? null : decimals)}${isRec ? '<span class="tag">record</span>' : gap ? ` <span class="muted num">(${esc(gap)})</span>` : ""}</td>
      <td class="num">${sigma == null ? '<span class="muted">n/a</span>' : sigma.toExponential(1)}</td>
      <td><span class="badge">${BOUND_SHORT[String(r.bound_type ?? null)]}</span>${r.defect ? ` <span class="badge flag">flagged</span>` : ""}</td>
      <td>${esc(shorten(r.method, 60))}</td>
      <td>${citeHtml(r)}</td>
      <td class="num">${yearOf(r) ?? '<span class="muted">n/a</span>'}</td>
    </tr>`;
  }).join("");
  return `<table class="next"><thead><tr><th>${perSiteLabel(inst)}</th><th>&sigma;</th><th>kind</th><th>method</th><th>source</th><th>year</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="links"><a href="${jsonUrl(inst)}">JSON</a> <span class="muted"><code>${esc(inst.instance_id)}</code></span></p>`;
}

function instancesPage() {
  const sections = MODELS.map(([model, name]) => {
    const group = instances.filter(i => i.model === model).sort(byGeometry);
    if (!group.length) return "";
    const held = group.filter(recordOf).length;
    const rows = group.map(inst => {
      const rec = recordOf(inst);
      const label = instanceLabel(inst);
      const search = `${label} ${inst.instance_id} ${rec ? rec.method : "no record"}`.toLowerCase();
      const cells = rec
        ? `<td class="record">${energyCell(rec, inst)}</td><td>${esc(shorten(rec.method, 52))} ${citeHtml(rec)}</td>`
        : `<td class="none">no record</td><td>${esc(noRecordReason(inst))}</td>`;
      const id = `x-${inst.instance_id.replace(/[^\w-]/g, "_")}`;
      return `<tr class="inst" data-search="${esc(search)}" data-lattice="${esc(latticeOf(inst))}" data-size="${sizeBand(inst)}">
        <th scope="row"><button type="button" aria-expanded="false" aria-controls="${id}">${esc(label)}</button></th>
        ${cells}<td class="num">${inst.rows.length}</td></tr>
      <tr class="more" id="${id}" hidden><td colspan="4">${allRows(inst)}</td></tr>`;
    });
    const lattices = [...new Set(group.map(latticeOf))].sort();
    const bands = SIZE_BANDS.filter(([key]) => group.some(i => sizeBand(i) === key));
    const badges = `<div class="quick">
      <span class="muted">lattice</span>${lattices.map(l => `<button type="button" data-lattice="${esc(l)}">${esc(l)}</button>`).join("")}
      ${bands.length > 1 ? `<span class="muted">size</span>${bands.map(([key, , label]) => `<button type="button" data-size="${key}">${label}</button>`).join("")}` : ""}
    </div>`;
    return `<section data-model="${model}">
      <h2 id="${model.toLowerCase()}">${esc(name)}<a class="anchor" href="#${model.toLowerCase()}" aria-label="Link to this section">#</a></h2>
      <p class="muted"><span class="count">${group.length} instances</span>, ${held} with a record, energies as <code>${perSiteLabel(group[0])}</code></p>
      ${badges}
      <div class="scroll"><table class="leaderboard">
        <thead><tr><th>instance</th><th>record</th><th>method</th><th>rows</th></tr></thead>
        <tbody>${rows.join("")}</tbody></table></div>
    </section>`;
  }).join("\n");

  const body = `
<h1>All ${summary.instances} instances</h1>
<p class="lead">One row per Hamiltonian instance with its record; click a row for every energy
published on it. ${summary.records.held} instances have a record; the rest say why they do not.</p>
<p><input id="filter" type="search" placeholder="Filter by lattice, size, coupling or method…" autocomplete="off" spellcheck="false">
<span id="filter-count" class="muted"></span></p>
<nav class="jump">${MODELS.filter(([m]) => instances.some(i => i.model === m))
    .map(([m, n]) => `<a href="#${m.toLowerCase()}">${esc(n)}</a>`).join("")}</nav>
${sections}
<script>
const box = document.getElementById("filter");
const count = document.getElementById("filter-count");
const sections = [...document.querySelectorAll("section[data-model]")];
const total = document.querySelectorAll("tr.inst").length;

// One selection per badge row per section; a badge toggles, and the text box applies on top.
function apply() {
  const q = box.value.trim().toLowerCase();
  let shown = 0;
  for (const section of sections) {
    const lattice = section.querySelector(".quick button[data-lattice].on")?.dataset.lattice;
    const size = section.querySelector(".quick button[data-size].on")?.dataset.size;
    const rows = [...section.querySelectorAll("tr.inst")];
    let n = 0;
    for (const row of rows) {
      const hit = (!q || row.dataset.search.includes(q))
        && (!lattice || row.dataset.lattice === lattice)
        && (!size || row.dataset.size === size);
      row.hidden = !hit;
      const more = row.nextElementSibling;
      if (!hit) { more.hidden = true; row.querySelector("button").setAttribute("aria-expanded", "false"); }
      if (hit) n++;
    }
    shown += n;
    section.hidden = !n && !lattice && !size;
    section.querySelector(".count").textContent = (n === rows.length ? "" : n + " of ") + rows.length + " instances";
  }
  count.textContent = q ? shown + " of " + total + " instances" : "";
}
box.addEventListener("input", apply);
for (const b of document.querySelectorAll(".quick button")) b.addEventListener("click", () => {
  const on = b.classList.contains("on");
  const key = "lattice" in b.dataset ? "lattice" : "size";
  for (const o of b.parentElement.querySelectorAll("button[data-" + key + "]")) o.classList.remove("on");
  if (!on) b.classList.add("on");
  apply();
});
for (const row of document.querySelectorAll("tr.inst")) row.addEventListener("click", e => {
  if (e.target.closest("a")) return;
  const more = row.nextElementSibling;
  more.hidden = !more.hidden;
  row.querySelector("button").setAttribute("aria-expanded", String(!more.hidden));
  row.classList.toggle("open", !more.hidden);
});
</script>`;
  return page({ url: "/instances/", title: `All ${summary.instances} instances`, body, wide: true,
    description: `Every Hamiltonian instance in QMBL: ${summary.instances} instances across ${MODELS.length} models, with the record energy and method for each.` });
}

// ---------------------------------------------------------------------- instance page
function rowTable(rows, inst) {
  const head = `<thead><tr><th>${perSiteLabel(inst)}</th><th>&sigma;</th><th>Var(E)</th><th>V-score</th>
    <th>method</th><th>source</th><th>year</th></tr></thead>`;
  const body = rows.map(r => {
    const rec = recordOf(inst) === r;
    const badges = [
      r.defect ? `<span class="badge flag">flagged: ${esc(r.defect.flag)}</span>` : "",
      r.baseline ? '<span class="badge">VarBench reference run</span>' : "",
      r.provenance === "secondary" ? '<span class="badge">quoted from another paper</span>' : "",
      r.peer_reviewed === true ? '<span class="badge">peer reviewed</span>' : "",
      r.peer_reviewed === false ? '<span class="badge">preprint</span>' : "",
      !r.defect && r.bound_type === "variational" && !recordEligible(r) && isSampled(r.method) && r.sigma == null
        ? '<span class="badge">ineligible: sampled, no error bar</span>' : "",
    ].filter(Boolean).join(" ");
    const { sigma } = perSite(r, inst);
    return `<tr class="${rec ? "is-record" : ""}${r.defect ? " is-flagged" : ""}">
      <td class="record">${energyCell(r, inst)}${rec ? '<span class="tag">record</span>' : ""}</td>
      <td class="num">${sigma == null ? '<span class="muted">n/a</span>' : sigma.toExponential(1)}</td>
      <td class="num">${r.energy_variance == null ? '<span class="muted">n/a</span>' : r.energy_variance.toExponential(2)}</td>
      <td class="num">${r.v_score == null ? '<span class="muted">n/a</span>' : r.v_score.toExponential(1)}</td>
      <td>${esc(r.method)}${badges ? `<div class="badges">${badges}</div>` : ""}</td>
      <td>${citeHtml(r)}</td>
      <td class="num">${yearOf(r) ?? '<span class="muted">n/a</span>'}</td>
    </tr>`;
  }).join("");
  return `<div class="scroll"><table class="rows">${head}<tbody>${body}</tbody></table></div>`;
}

const modelName = model => MODELS.find(([m]) => m === model)?.[1] ?? model;

function instancePage(inst) {
  const label = `${modelName(inst.model)} ${instanceLabel(inst)}`;
  const rec = recordOf(inst);
  const ham = hamiltonian(inst);
  const variant = variantNote(inst);
  const sorted = [...inst.rows].sort((a, b) => a.energy - b.energy);

  const groups = BOUND_ORDER.map(bound => {
    const rows = sorted.filter(r => (r.bound_type ?? null) === bound);
    if (!rows.length) return "";
    return `<section class="bound bound-${bound ?? "unclassified"}">
      <h3>${BOUND_LABEL[String(bound)]} <span class="muted">(${rows.length})</span></h3>
      <p class="muted">${BOUND_NOTE[String(bound)]}</p>
      ${rowTable(rows, inst)}
    </section>`;
  }).join("");

  const flagged = sorted.filter(r => r.defect).map(r => `
    <details class="defect">
      <summary><b>${esc(r.defect.flag)}</b> &mdash; ${esc(shorten(r.method, 60))}, ${energyCell(r, inst)}</summary>
      <p><b>Finding.</b> ${esc(r.defect.finding)}</p>
      ${r.defect.diagnosis ? `<p><b>Diagnosis.</b> ${esc(r.defect.diagnosis)}</p>` : ""}
      ${r.defect.ruled_out ? `<p><b>Ruled out.</b> ${esc(r.defect.ruled_out)}</p>` : ""}
      ${r.defect.evidence ? `<p><b>Evidence.</b> ${esc(r.defect.evidence)}</p>` : ""}
    </details>`).join("");

  const verified = sorted.filter(r => r.verified).map(r => `
    <details class="verified">
      <summary>${energyCell(r, inst)} &mdash; ${esc(shorten(r.method, 60))}</summary>
      <p class="muted">Checked ${esc(r.verified.checked_on)} &middot; ${esc(r.verified.method)}</p>
      ${r.verified.reported_as ? `<p><b>Reported as.</b> ${esc(r.verified.reported_as)}</p>` : ""}
      ${r.verified.note ? `<p>${esc(r.verified.note)}</p>` : ""}
    </details>`).join("");

  const recordBox = rec
    ? `<div class="record-box">
        <p class="eyebrow">Record</p>
        <p class="big"><span class="num">${quoteRow(rec, inst).text}</span>${marks(rec)}
          <span class="unit">${perSiteLabel(inst)}</span></p>
        <p>${esc(rec.method)}</p>
        <p class="muted">${citeHtml(rec)} &middot; ${rec.bound_type === "exact"
          ? "exact energy: the instance is solved, and this is the state of the art on it"
          : "lowest eligible strict variational bound"}
          (<a href="${RULES}#6-records-and-ties">rules &sect;6</a>)</p>
      </div>`
    : `<div class="record-box none">
        <p class="eyebrow">No record</p>
        <p class="big">&mdash;</p>
        <p>${esc(noRecordReason(inst))} (<a href="${RULES}#6-records-and-ties">rules &sect;6</a>).
        Every row is still listed below.</p>
      </div>`;

  const params = Object.entries(inst.params ?? {})
    .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="num">${esc(v)}</dd></div>`).join("");

  const body = `
<p class="crumbs"><a href="/instances/">All instances</a> / <a href="/instances/#${inst.model.toLowerCase()}">${esc(modelName(inst.model))}</a></p>
<h1>${esc(label)}</h1>
<p class="muted id"><code>${esc(inst.instance_id)}</code></p>

${recordBox}

<section class="hamiltonian">
  <h2>The Hamiltonian</h2>
  ${ham.formula ? `<p class="formula">${ham.formula}</p>` : ""}
  <p>${ham.note}</p>
  ${variant ? `<p>${variant}</p>` : ""}
  <dl class="facts">
    <div><dt>lattice</dt><dd>${esc(inst.lattice)}</dd></div>
    <div><dt>sites</dt><dd class="num">${inst.n_sites}</dd></div>
    <div><dt>boundary</dt><dd>${inst.boundary ? esc(BOUNDARY[inst.boundary] ?? "periodic") : "&mdash;"}</dd></div>
    ${params}
    <div><dt>energies</dt><dd class="num">${inst.rows.length}</dd></div>
  </dl>
  <p class="muted">Stored as a total energy in the convention of
    <a href="https://doi.org/10.1126/science.adg9774">VarBench</a>; quoted here as
    <code>${perSiteLabel(inst)}</code>, which is what the papers report
    (<a href="${DATA}#units-and-conventions">how the conversion works</a>).</p>
</section>

<section>
  <h2>Every published energy</h2>
  <p>Grouped by what the number is. Ranking happens only inside the first group.</p>
  ${groups}
</section>

${flagged ? `<section><h2>Flagged rows</h2>
  <p>A flag withholds the record and nothing else: the row stays listed, in rank order.
  <a href="${RULES}#10-pending-confirmed-objections">Rules &sect;10</a> is how a flag is lifted or upheld.</p>
  ${flagged}</section>` : ""}

${verified ? `<section><h2>How these numbers were read</h2>
  <p>Rows added after the VarBench import record where the number came from.</p>
  ${verified}</section>` : ""}

<section>
  <h2>Coverage</h2>
  <p>${coverage(inst)}</p>
</section>

<section class="machine">
  <h2>This instance as data</h2>
  <p><a href="${jsonUrl(inst)}">JSON</a> &middot;
     <a href="${REPO}/blob/main/data/${inst.instance_id}.json">source file on GitHub</a> &middot;
     <a href="${REPO}/issues/new?title=${encodeURIComponent(`[${inst.instance_id}] `)}">open an issue about this instance</a></p>
</section>`;

  const recText = rec ? `Record ${quoteRow(rec, inst).text} ${perSiteLabel(inst)} by ${shorten(rec.method, 40)}.` : "No row currently holds the record.";
  return page({ url: instUrl(inst), title: label, body, wide: true,
    description: `${label}: ${inst.rows.length} published ground-state energies. ${recText}` });
}

// --------------------------------------------------------------------- contribute page
function contributePage() {
  const b = summary.blocked_on_sigma;
  const costed = instances.flatMap(i => i.rows).filter(r => r.compute?.gpu_hours != null || r.compute?.cpu_core_hours != null || r.compute?.parameters != null).length;
  const body = `
<h1>Contribute</h1>
<p class="lead">Everything here is someone else's published work. Corrections are the most valuable
thing you can send, and a correction about your own paper gets acted on the same day.</p>

<h2>Open an issue</h2>
<p>All of it goes through <a href="${REPO}/issues">GitHub issues</a>. There is no form and no
account to create beyond GitHub.</p>
<ul>
  <li><b>A number is wrong, or attributed to the wrong paper.</b> Name the instance and what it
  should be. Rows are corrected in place and the history stays in git.</li>
  <li><b>A missing result.</b> The instance, the energy, its error bar, the method, and the paper
  it was published in. Anything missing renders as <code>n/a</code> rather than blocking the row
  (<a href="${RULES}#3-required-fields">rules &sect;3</a>).</li>
  <li><b>An error bar we could not find.</b> ${b.rows} sampled energies across ${b.instances}
  instances are listed but rank for nothing because no error bar was found in the source we read,
  and ${b.would_take_record} of them sit below their instance's current record. One message closes
  that (<a href="${RULES}#6-records-and-ties">rules &sect;6</a>).</li>
  <li><b>An objection to a row.</b> Wrong symmetry sector, a mis-declared <code>bound_type</code>,
  an error bar with no autocorrelation correction: these are technical disputes with a process,
  <a href="${RULES}#10-pending-confirmed-objections">rules &sect;10</a>. Rulings cite a clause
  rather than anyone's judgement about anyone's work.</li>
  <li><b>What a number cost.</b> GPU-hours &times; device, parameter count, wall-clock. ${costed}
  rows state at least one of these, which is what the <a href="/#energy-vs-compute">energy-versus-cost
  figure</a> is drawn from; yours can join them
  (<a href="${DATA}#what-a-number-cost-the-compute-block">the format is specified</a>).</li>
</ul>

<h2>The marks on a row are questions, not criticism</h2>
<p><b>&#9675;</b> means we found no error metric in the source we read. It is a statement about our
search, not about the authors: the figure may well be in a supplement, a companion paper, or your
own records. The row stays in the table and stays in the ranking either way
(<a href="${DATA}#error-metrics">error metrics</a>).</p>

<h2>Variance and checkpoints</h2>
<p>Var(E) &mdash; the variance of the local energy, not the error bar &mdash; is what the V-score
needs, and almost nobody reports it. It is a by-product of any sampling pass, so if you send an
optimized checkpoint and the model code, the variance can be measured and credited on your row.
A state we retrain ourselves is a new row rather than a variance for yours
(<a href="${RULES}#11-corrections">rules &sect;11</a>).</p>`;
  return page({ url: "/contribute/", title: "Contribute", body,
    description: "How to correct a row, add a published result, supply a missing error bar, or object to a record in QMBL." });
}

function notFoundPage() {
  return page({ url: "/404.html", title: "Not found", description: "Page not found.", body: `
<h1>Not found</h1>
<p class="lead">That page does not exist. Instance URLs look like
<code>/i/J1J2/square_100_P_0.5/</code> and are listed in full on
<a href="/instances/">the instances page</a>.</p>` });
}

// ------------------------------------------------------------------------ machine api
function apiInstance(inst) {
  const rec = recordOf(inst);
  const f = perSiteDivisor(inst);
  return {
    ...inst,
    url: `https://qmbl.org${instUrl(inst)}`,
    per_site_divisor: f,
    per_site_label: perSiteLabel(inst),
    record: rec ? {
      energy: rec.energy, sigma: rec.sigma, method: rec.method, reference: rec.reference,
      bound_type: rec.bound_type, energy_per_site: f == null ? null : rec.energy / f,
    } : null,
    no_record_reason: rec ? null : noRecordReason(inst),
  };
}

function llmsTxt() {
  const lines = [
    "# QMBL - the Quantum Many-Body Leaderboard",
    "",
    `> The best published ground-state energies for ${summary.instances} lattice Hamiltonian instances (${summary.rows} energies, ${summary.records.held} with a record, ${summary.records.held_by_exact} of them solved exactly). Read-only, generated from the repository's data/ directory, Apache-2.0.`,
    "",
    "Every row is one published claim about one Hamiltonian instance and carries the energy, its",
    "error bar, the method, the primary reference, and a `bound_type`: strict variational bound,",
    "projected/fixed-node estimate, zero-variance extrapolation, or numerically exact. An exact",
    "energy is the record wherever one exists; otherwise only a strict variational bound can hold",
    "it. Energies are stored as totals in VarBench's convention",
    "and quoted per site; the conversion is in DATA.md. Individual energies must be cited to the",
    "primary paper named on the row, not to this site.",
    "",
    "## Pages",
    "- [Leaderboard](https://qmbl.org/): the accuracy and cost figures, and how to cite.",
    `- [All instances](https://qmbl.org/instances/): every one of the ${summary.instances} instances, with its record.`,
    `- [Rules](${RULES}): what counts as a record, ties, provenance, objections.`,
    `- [Data](${DATA}): row format, units and conventions, error metrics, defects.`,
    "- [Contribute](https://qmbl.org/contribute/): corrections, missing results, missing error bars.",
    "",
    "## Data",
    "- [Full dump](https://qmbl.org/api/qmbl.json): every instance and row in one JSON file.",
    "- [Instance index](https://qmbl.org/api/instances.json): id, label, URL and record per instance.",
    "- [Summary](https://qmbl.org/api/summary.json): the counts behind the headline numbers.",
    `- [Repository](${REPO}): source data, build scripts, rules.`,
    `- Citation: https://doi.org/${DOI} (concept DOI, always the latest release).`,
    "",
    "## Instances",
    ...instances.map(i => `- [${instanceLabel(i)}](https://qmbl.org${instUrl(i)}): ${i.instance_id}, ${i.rows.length} energies, JSON at https://qmbl.org${jsonUrl(i)}.`),
    "",
  ];
  return lines.join("\n");
}

// ------------------------------------------------------------------------------- css
const CSS = `:root {
  --bg: #fcfcfb; --surface: #ffffff; --ink: #0b0b0b; --ink2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --accent: #2a78d6; --flag: #eb6834; --exact: #1baf7a; --record: #104281;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a19; --surface: #211f1e; --ink: #ffffff; --ink2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --accent: #3987e5; --flag: #d95926; --exact: #199e70; --record: #9ec5f4;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--ink); font-family: var(--sans);
  font-size: 16px; line-height: 1.6; text-rendering: optimizeLegibility;
}
a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
a:hover { text-decoration-thickness: 2px; }
code { font-family: var(--mono); font-size: 0.9em; }
h1, h2, h3 { font-family: var(--serif); font-weight: 600; line-height: 1.2; letter-spacing: -0.01em; }
h1 { font-size: 2.1rem; margin: 0 0 0.6rem; }
h2 { font-size: 1.45rem; margin: 2.6rem 0 0.6rem; }
h3 { font-size: 1.1rem; margin: 2rem 0 0.4rem; }
h4, h5, h6 { font-family: var(--sans); font-size: 1rem; margin: 1.6rem 0 0.4rem; }
p { margin: 0.8rem 0; max-width: 46em; }
.muted { color: var(--muted); }
.lead { font-size: 1.15rem; color: var(--ink2); max-width: 42em; }
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; }

header.site {
  display: flex; flex-wrap: wrap; gap: 1rem 2rem; align-items: baseline;
  justify-content: space-between; padding: 1.4rem clamp(1rem, 4vw, 3rem);
  border-bottom: 1px solid var(--grid);
}
.wordmark {
  display: flex; align-items: center; gap: 0.7rem;
  font-family: var(--serif); font-size: 1.3rem; font-weight: 600; color: var(--ink);
  text-decoration: none; letter-spacing: 0.02em;
}
.wordmark b { font-weight: inherit; }
.wordmark .logo { width: 34px; height: 34px; flex: none; }
.wordmark span {
  display: block; font-family: var(--sans); font-size: 0.72rem; font-weight: 400;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
}
header.site nav { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: center; font-size: 0.95rem; }
header.site nav a { color: var(--ink2); text-decoration: none; }
header.site nav a:hover { color: var(--accent); }
header.site nav a[aria-current] { color: var(--ink); box-shadow: inset 0 -2px 0 var(--accent); }
header.site nav a.ext { color: var(--muted); display: inline-flex; }
header.site nav a.ext:hover { color: var(--ink); }
header.site nav a.ext svg { display: block; }
button.cite-btn {
  font: inherit; font-size: 0.85rem; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.7rem;
  color: var(--ink2); background: var(--surface); border: 1px solid var(--grid); border-radius: 999px;
}
button.cite-btn:hover { color: var(--accent); border-color: var(--accent); }
button.cite-btn.copied { color: var(--exact); border-color: var(--exact); }

main { padding: 2.4rem clamp(1rem, 4vw, 3rem) 4rem; max-width: 52rem; }
main.wide { max-width: 78rem; }

footer.site {
  border-top: 1px solid var(--grid); padding: 1.6rem clamp(1rem, 4vw, 3rem) 3rem;
  font-size: 0.9rem; color: var(--ink2);
}
footer.site p { margin: 0.3rem 0; }

figure { margin: 2.2rem 0 0; }
figure picture, figure img { display: block; width: 100%; max-width: 920px; height: auto; }
figure img { border: 1px solid var(--grid); border-radius: 3px; background: var(--surface); }
figcaption { font-size: 0.8rem; margin-top: 0.3rem; }
figcaption .anchor { margin: 0 0.4rem 0 0; opacity: 1; color: var(--grid); }
figcaption a:not(.anchor) { color: var(--muted); }

.scroll { overflow-x: auto; margin: 1.2rem 0; }
table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
th, td { text-align: left; vertical-align: top; padding: 0.55rem 0.8rem 0.55rem 0; border-bottom: 1px solid var(--grid); }
thead th {
  font-size: 0.78rem; letter-spacing: 0.04em; color: var(--muted);
  font-weight: 500; border-bottom: 1px solid var(--ink2); white-space: nowrap;
}
tbody tr:hover { background: var(--surface); }
tbody th { font-weight: 500; }
td.num, td .num { font-family: var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
td.record .num { font-weight: 600; color: var(--record); }
td.none { color: var(--muted); }
.leaderboard th[scope="row"] { min-width: 14rem; }
.rows tr.is-record td { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.rows tr.is-flagged td:first-child { box-shadow: inset 3px 0 0 var(--flag); }
.tag {
  margin-left: 0.5rem; font-family: var(--sans); font-size: 0.65rem; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--accent);
}
.badges { margin-top: 0.3rem; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.badge {
  font-size: 0.7rem; color: var(--ink2); border: 1px solid var(--grid);
  border-radius: 999px; padding: 0.05rem 0.5rem; white-space: nowrap;
}
.badge.flag { color: var(--flag); border-color: var(--flag); }
.legend { font-size: 0.9rem; color: var(--ink2); max-width: 46em; }
.citation { max-width: none; }

.quick { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin: 0.6rem 0 0; font-size: 0.85rem; }
.quick .muted { margin-right: 0.2rem; }
.quick .muted:not(:first-child) { margin-left: 0.8rem; }
.quick button {
  font: inherit; font-size: 0.8rem; line-height: 1.2; cursor: pointer; padding: 0.2rem 0.65rem;
  color: var(--ink2); background: var(--surface); border: 1px solid var(--grid); border-radius: 999px;
}
.quick button:hover { border-color: var(--accent); color: var(--accent); }
.quick button.on { color: #fff; background: var(--accent); border-color: var(--accent); }

tr.inst { cursor: pointer; }
tr.inst th button {
  font: inherit; color: var(--accent); background: none; border: 0; padding: 0; cursor: pointer;
  text-align: left; text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px;
}
tr.inst th button::before {
  content: ""; display: inline-block; width: 0.4em; height: 0.4em; margin-right: 0.5em;
  border-right: 1.5px solid var(--muted); border-bottom: 1.5px solid var(--muted);
  transform: rotate(-45deg) translateY(-0.1em); transition: transform 0.1s;
}
tr.inst.open th button::before { transform: rotate(45deg) translateY(-0.2em); }
tr.inst.open td, tr.inst.open th { background: var(--surface); border-bottom-color: transparent; }
tr.more > td { padding: 0.6rem 0 1.2rem 1.4rem; background: var(--surface); }
tr.more:hover { background: none; }
tr.more p { margin: 0.4rem 0; font-size: 0.88rem; }
tr.more p.links a { margin-right: 1rem; }
table.next { width: auto; min-width: 60%; font-size: 0.85rem; margin: 0.4rem 0 0.6rem; }
table.next th, table.next td { padding: 0.35rem 1.2rem 0.35rem 0; }
table.next tr.is-flagged td:first-child { box-shadow: inset 3px 0 0 var(--flag); }
table.next tr.is-record td { background: color-mix(in srgb, var(--accent) 7%, transparent); }

.record-box {
  background: var(--surface); border: 1px solid var(--grid); border-left: 3px solid var(--accent);
  border-radius: 3px; padding: 1rem 1.2rem; margin: 1.6rem 0;
}
.record-box.none { border-left-color: var(--muted); }
.record-box p { margin: 0.25rem 0; }
.eyebrow { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
.big { font-family: var(--mono); font-size: 1.8rem; font-weight: 600; }
.big .unit { font-family: var(--sans); font-size: 0.8rem; font-weight: 400; color: var(--muted); margin-left: 0.5rem; }

.crumbs { font-size: 0.85rem; color: var(--muted); margin: 0 0 0.6rem; }
.crumbs a { color: var(--muted); }
.id { margin-top: -0.3rem; }
.formula {
  font-family: var(--mono); font-size: 1.05rem; background: var(--surface);
  border: 1px solid var(--grid); border-radius: 3px; padding: 0.9rem 1rem; overflow-x: auto;
}
.ham { white-space: nowrap; }
dl.facts { display: flex; flex-wrap: wrap; gap: 0.4rem 2rem; margin: 1rem 0; }
dl.facts dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
dl.facts dd { margin: 0; }

section.bound { margin: 1.8rem 0; }
section.bound h3 { margin-bottom: 0.2rem; }
section.bound p.muted { font-size: 0.88rem; max-width: 46em; margin: 0.2rem 0 0.6rem; }

details { border-top: 1px solid var(--grid); padding: 0.6rem 0; }
details summary { cursor: pointer; }
details[open] summary { margin-bottom: 0.4rem; }
details p { max-width: 46em; font-size: 0.92rem; }
details.defect summary b { color: var(--flag); }

.cite { background: var(--surface); border: 1px solid var(--grid); border-radius: 3px; padding: 0.4rem 1.2rem 1.2rem; margin-top: 2.4rem; }
.cite h2 { margin-top: 1.2rem; }

#filter {
  font: inherit; font-size: 0.95rem; padding: 0.5rem 0.7rem; width: min(28rem, 100%);
  background: var(--surface); color: var(--ink); border: 1px solid var(--grid); border-radius: 3px;
}
#filter-count { margin-left: 0.6rem; font-size: 0.85rem; }
nav.jump { display: flex; flex-wrap: wrap; gap: 1rem; font-size: 0.9rem; margin: 1rem 0 0; }

.anchor {
  margin-left: 0.4rem; color: var(--grid); text-decoration: none; font-size: 0.8em;
  opacity: 0; transition: opacity 0.1s;
}
h1:hover .anchor, h2:hover .anchor, h3:hover .anchor, h4:hover .anchor { opacity: 1; color: var(--muted); }
hr { border: 0; border-top: 1px solid var(--grid); margin: 2rem 0; }
` + LOGO_CSS;

// ----------------------------------------------------------------------------- output
function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

fs.rmSync(OUT, { recursive: true, force: true });

write("index.html", homePage());
write("instances/index.html", instancesPage());
write("rules/index.html", redirectPage("/rules/", RULES, "Rules"));
write("data/index.html", redirectPage("/data/", DATA, "Data"));
write("contribute/index.html", contributePage());
write("404.html", notFoundPage());
write("style.css", CSS);
write("favicon.svg", faviconSvg());
// Rendered once from favicon.svg (scripts/assets/); Safari and share sheets do not take SVG icons.
for (const png of ["apple-touch-icon.png", "favicon-32.png"])
  fs.copyFileSync(path.join("scripts/assets", png), path.join(OUT, png));
fs.mkdirSync(path.join(OUT, "figures"), { recursive: true });
for (const [name] of FIGURES) for (const v of [name, `${name}-dark`])
  fs.copyFileSync(`figures/${v}.svg`, path.join(OUT, "figures", `${v}.svg`));
write("llms.txt", llmsTxt());
write(".nojekyll", "");
write("robots.txt", "User-agent: *\nAllow: /\nSitemap: https://qmbl.org/sitemap.xml\n");

for (const inst of instances) {
  write(`i/${inst.instance_id}/index.html`, instancePage(inst));
  write(`api/i/${inst.instance_id}.json`, JSON.stringify(apiInstance(inst), null, 2) + "\n");
}

write("api/summary.json", JSON.stringify(summary, null, 2) + "\n");
write("api/instances.json", JSON.stringify(instances.map(i => {
  const rec = recordOf(i);
  const f = perSiteDivisor(i);
  return {
    instance_id: i.instance_id, label: instanceLabel(i), model: i.model, lattice: i.lattice,
    n_sites: i.n_sites, boundary: i.boundary ?? null, params: i.params ?? {}, rows: i.rows.length,
    url: `https://qmbl.org${instUrl(i)}`, json: `https://qmbl.org${jsonUrl(i)}`,
    record_energy_per_site: rec && f != null ? rec.energy / f : null,
    record_method: rec?.method ?? null,
    record_bound_type: rec?.bound_type ?? null,
  };
}), null, 2) + "\n");
write("api/qmbl.json", JSON.stringify({
  name: "QMBL - the Quantum Many-Body Leaderboard",
  url: "https://qmbl.org/", repository: REPO, license: "Apache-2.0", doi: DOI,
  built: BUILT, note: "Individual energies must be cited to the primary paper named on the row.",
  summary, instances: instances.map(apiInstance),
}, null, 2) + "\n");

const urls = ["/", "/instances/", "/contribute/", ...instances.map(instUrl)];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>https://qmbl.org${u}</loc><lastmod>${BUILT}</lastmod></url>`).join("\n")}
</urlset>
`);

console.log(`${OUT}/: ${urls.length} pages (${instances.length} instances), ${summary.rows} energies, ${summary.records.held} records`);
