// Build the read-only site at qmbl.org into _site/.
//
// Generated from data/ by the same modules the README is generated from: units.mjs for
// every conversion, summary.mjs for what a record is, readme_table.mjs for how an
// instance is named and how a number is quoted. The site and the README therefore cannot
// disagree about a number - if they ever do, one of those modules is wrong and both
// surfaces are wrong together, which is the only kind of disagreement worth having.
//
// The figures on the front page are the committed figures/*.svg, drawn by size_accuracy.mjs
// and pareto.mjs from the same data/; this script inlines them, so that a mark standing for
// a row can link to that row in the table and show a card for it on hover. A figure carries
// its own title and subtitle, so the page puts nothing above it; the title and caption
// listed here are its accessible label.
// RULES.md and DATA.md are not rendered here - they live on GitHub, and /rules/ and
// /data/ redirect there so links that predate the change keep resolving.
//
// No dependencies and no build step: plain strings, written once. `_site/` is generated
// output and is never committed.
import fs from "node:fs";
import path from "node:path";
import { perSiteDivisor, perSiteLabel, isSampled, recordEligible, boundLabel, stochasticExact } from "./units.mjs";
import { collect, recordOf, summarize, rowId } from "./summary.mjs";
import { THEMES } from "./chart.mjs";
import { citeRef, paperYear } from "./cite.mjs";
import { sources } from "./enrich_sources.mjs";
import { quote, shorten, MODELS, BOUNDARY, instanceLabel, byGeometry, noRecordReason, gapAbove } from "./readme_table.mjs";
import { logoSvg, faviconSvg, LOGO_CSS } from "./logo.mjs";
import { hoursOf, costFigureName } from "./cost.mjs";
import { FRONTIER } from "./views.mjs";
import { ladderFigures } from "./ladders.mjs";

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
const CITE_HEAD = "T. Zerweck";
const CITE_TITLE = "QMBL - the Quantum Many-Body Leaderboard";
const CITE_TAIL = `v${VERSION}, Zenodo (${RELEASED.slice(0, 4)}).`;
const CITATION = `${CITE_HEAD}, ${CITE_TITLE}, ${CITE_TAIL} https://doi.org/${DOI}`;

const cache = sources();
const instances = collect();
const summary = summarize(instances);

// ------------------------------------------------------------------------------ html
const esc = s => String(s)
  // Entities written in the source markdown (&#9675;, &dagger;) must survive escaping;
  // a bare ampersand must not.
  .replace(/&(?![#A-Za-z0-9]+;)/g, "&amp;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The front page is the leaderboard (the figures), /instances/ the table. The URLs stay -
// they are what is linked and cited.
const NAV = [
  ["/", "Leaderboard"],
  ["/instances/", "Table"],
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
  <nav><span class="badge beta" title="QMBL is in beta: the data and the site are still being checked and re-cut">beta</span>${NAV.map(([href, label]) =>
    `<a href="${href}"${href === url ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
    <a class="ext" href="${REPO}" aria-label="QMBL on GitHub" title="Source and data on GitHub">${GITHUB_MARK}</a>
    <button class="cite-btn" type="button" data-cite="${esc(CITATION)}" title="Copy the citation">&#10077;<span>Cite</span></button></nav>
</header>
<main class="${wide ? "wide" : ""}">
${body}
</main>
<footer class="site">
  <p><a href="/contribute/">Contribute</a> &middot; <a href="${REPO}">Source and data on GitHub</a> &middot;
     Apache-2.0 &middot; <a href="/llms.txt">llms.txt</a></p>
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
const yearOf = r => paperYear(r, cache);

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
  exact: "Exact diagonalization, an exact solution, or sign-problem-free QMC where that is established: the answer, not a claim about it, and therefore the record wherever one exists. QMC is exact only within its statistical error bar, which it must state, and its rows read exact (stochastic); an exact diagonalization outranks it. Sector-resolved diagonalizations state the lowest energy in one symmetry sector and do not hold it.",
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
  return `<span class="num">${q.text}</span>`;
}

// The site prints none of the README's markers for a missing error bar (the circle, the
// dagger): the sigma column says n/a. A method loses the source's own "(this work)" or
// "(Ours)", since the source column names the paper (Tristan, 2026-09-17).
const methodText = method => method.replace(/\s*\((?:this work|ours)\)/gi, "");

// A flagged row's badge names its flag, and hovering it says what that kind of flag means in
// one sentence; the row's own finding is under Flagged rows on the instance page.
const FLAGS = {
  "below-exact": ["below exact energy", "The energy lies below the exact ground-state energy, which no variational result can."],
  "below-exact-suspected": ["likely below exact", "The energy appears to lie below the exact ground-state energy, but the evidence is not conclusive."],
  "energy-variance-inconsistent": ["energy and variance disagree", "The energy is lower than its own reported variance or error bar supports."],
  "dof-mismatch": ["wrong site count (dof)", "The stored degrees of freedom do not match the instance's site count, so a V-score computed from them would be wrong."],
  "wrong-instance": ["wrong instance", "The numbers were uploaded to the wrong instance and belong to another one."],
  "sampling-nonergodic": ["non-ergodic sampling", "The Monte Carlo chains did not sample ergodically, so the low energy is a sampling artifact."],
};
const flagLabel = r => FLAGS[r.defect.flag]?.[0] ?? r.defect.flag;
const flagBadge = r => {
  const why = FLAGS[r.defect.flag]?.[1];
  return `<span class="badge flag"${why ? ` title="${esc(why)}"` : ""}>${esc(flagLabel(r))}</span>`;
};

function citeHtml(row) {
  const r = citeRef(row, cache);
  const link = r.url ? `<a href="${esc(r.url)}">${esc(r.text)}</a>` : esc(r.text);
  return r.note ? `${link}<span class="muted">, ${esc(r.note)}</span>` : link;
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
// pareto.mjs) and committed, in a light and a dark variant for GitHub; the page inlines the
// light one and the stylesheet recolours it in dark mode (FIG_DARK). One entry per figure.
const FIGURES = [
  ["size-vs-accuracy", "The best published energies, by system size",
    "Every energy on an instance with an exact ground-state energy, placed by its relative gap to it so that different Hamiltonians share one axis; a better energy is higher. Colour is the kind of number; filled marks can hold a record, hollow ones cannot."],
  ["size-vs-accuracy-by-family", "The best energies by system size, one panel per method family",
    "Each panel colours one family's energies over all the others in grey and joins the family's best energy at each size."],
];

// A row of badges switching between panels, CSS-only: a radio input per badge, the checked
// one showing its panel, so the switch works without the script and the inputs stay in the
// keyboard order. The first badge is checked. The stylesheet is written before any page, so
// the rules for each switch come from tabRules() at module level, into TAB_CSS.
function tabs(id, items) {
  return `${items.map((_, k) => `<input type="radio" name="${id}" id="${id}-${k}"${k ? "" : " checked"}>`).join("")}
  <div class="tab-labels">${items.map(([label], k) => `<label for="${id}-${k}">${label}</label>`).join("")}</div>
  <div class="tab-panels">${items.map(([, html]) => html).join("\n")}</div>`;
}
const tabRules = (id, count) => Array.from({ length: count }, (_, k) =>
  `#${id}-${k}:checked ~ .tab-panels > :nth-child(${k + 1}) { display: block; }
#${id}-${k}:checked ~ .tab-labels > label[for="${id}-${k}"] { color: #fff; background: var(--accent); border-color: var(--accent); }
#${id}-${k}:focus-visible ~ .tab-labels > label[for="${id}-${k}"] { outline: 2px solid var(--accent); outline-offset: 2px; }`).join("\n");

// The per-Hamiltonian size figures: one per model and lattice, a panel per ladder of sizes,
// drawn by size_accuracy.mjs into figures/size/, which it empties first; which exist is
// read off the directory, as for the cost figures. Two rows of badges, the model and then
// its lattices, rather than one badge per ladder.
const SIZE_FIGS = [...Map.groupBy(ladderFigures(instances).filter(f => fs.existsSync(`figures/${f.name}.svg`)), f => f.model)];
const sizeEntry = f => [f.name, `${f.title}: the best energies at each size`,
  "One panel per Hamiltonian published at two or more sizes; each size is placed against its exact energy where it has one, otherwise against the standing record, whose holder then sits in the band above the plot."];
function sizeSwitcher() {
  if (!SIZE_FIGS.length) return "";
  return `<section class="tabs" id="size-vs-accuracy-ladders">
  <h2>The best energies as each Hamiltonian grows<a class="anchor" href="#size-vs-accuracy-ladders" aria-label="Link to this section">#</a></h2>
  <p class="muted">Every Hamiltonian with published results at two or more sizes, including the ones nobody can solve exactly at scale: a size is
  placed against its exact energy where it has one and against the standing record otherwise.</p>
  ${tabs("size-model", SIZE_FIGS.map(([model, figs], j) =>
    [esc(modelName(model)), `<div class="tabs">${tabs(`size-${j}`, figs.map(f => [esc(f.label), figure(sizeEntry(f))]))}</div>`]))}
</section>`;
}

// The cost figures: one per instance with enough energies costed in hours, drawn by
// pareto.mjs into figures/cost/. Which instances have one is read off the directory, which
// pareto.mjs empties before writing, so the site never shows a figure for an instance that
// has lost its costs. Frontier instances first, in their order, then the rest by id.
const COST_FIGS = instances
  .filter(inst => fs.existsSync(`figures/${costFigureName(inst)}.svg`))
  .sort((a, b) => {
    const rank = i => { const k = FRONTIER.findIndex(([id]) => id === i.instance_id); return k < 0 ? FRONTIER.length : k; };
    return rank(a) - rank(b) || a.instance_id.localeCompare(b.instance_id);
  });
const costEntry = inst => [costFigureName(inst), `${modelName(inst.model)} ${instanceLabel(inst)}: the best energies at each cost`,
  "Every energy on this instance whose paper states its compute cost in hours, against that cost; the line is the frontier of results nothing beats for less."];

// Front page: one badge per instance.
function costSwitcher() {
  if (!COST_FIGS.length) return "";
  return `<section class="tabs" id="energy-vs-compute">
  <h2>The best energies at each cost<a class="anchor" href="#energy-vs-compute" aria-label="Link to this section">#</a></h2>
  <p class="muted">What the published results on one instance cost in compute, and which of them nothing beats for less. Drawn for the
  ${COST_FIGS.length} instances where at least two energies state their cost; GPU-hours and CPU core-hours are never converted into each other.</p>
  ${tabs("cost-tab", COST_FIGS.map(inst => [`${esc(modelName(inst.model))} ${esc(instanceLabel(inst))}`, figure(costEntry(inst))]))}
</section>`;
}
const TAB_CSS = [tabRules("cost-tab", COST_FIGS.length), tabRules("size-model", SIZE_FIGS.length),
  ...SIZE_FIGS.map(([, figs], j) => tabRules(`size-${j}`, figs.length))].join("\n");

// Leaderboard: the instance's cost figure above its rows, or how many of its energies state
// a cost when that is too few to draw; nothing when none does.
function costSlot(inst) {
  if (COST_FIGS.includes(inst)) return figure(costEntry(inst));
  const k = inst.rows.filter(r => hoursOf(r.compute)).length;
  return k ? `<p class="muted cost-none">${k} of ${inst.rows.length} energies here state a compute cost; a cost figure is drawn from two.</p>` : "";
}

// Dark mode for an inlined figure: an attribute selector per light colour, which beats the
// presentation attribute in the cascade. The two themes list their colours in the same
// slots, so slot k in light becomes slot k in dark; a light colour sitting in two slots
// must darken the same way in both, and a figure using a colour outside the light theme
// fails the build rather than staying light on a dark page.
const FIG_COLOURS = new Map();
{
  const light = Object.values(THEMES.light).flat(), dark = Object.values(THEMES.dark).flat();
  light.forEach((hex, k) => {
    if (FIG_COLOURS.has(hex) && FIG_COLOURS.get(hex) !== dark[k]) throw new Error(`chart.mjs: ${hex} darkens to two colours`);
    FIG_COLOURS.set(hex, dark[k]);
  });
}
const FIG_DARK = [...FIG_COLOURS].filter(([l, d]) => l !== d)
  .map(([l, d]) => `  figure.chart [fill="${l}"] { fill: ${d}; }\n  figure.chart [stroke="${l}"] { stroke: ${d}; }`).join("\n");

// The figure's own <title> would show as the browser's tooltip over the whole chart and
// fight the row cards, and four inlined figures would repeat its id, so it and <desc> are
// dropped here and the entry's title and caption label the figure instead. Marks are
// links but not tab stops: four hundred of them per figure would bury the page's keyboard
// order, and the table they point to is the accessible form of the same rows.
function figure([name, title, caption]) {
  const file = `figures/${name}.svg`;
  for (const v of [name, `${name}-dark`])
    if (!fs.existsSync(`figures/${v}.svg`)) throw new Error(`figures/${v}.svg is missing; run the build first`);
  const svg = fs.readFileSync(file, "utf8").trim()
    .replace(/<title id="title">[^<]*<\/title>\n<desc id="desc">[^<]*<\/desc>\n/, "")
    .replace(' aria-labelledby="title desc"', () => ` aria-label="${esc(title)}. ${esc(caption)}"`)
    .replaceAll('<a class="pt" href=', () => '<a class="pt" tabindex="-1" href=');
  if (/<title|<desc|aria-labelledby/.test(svg)) throw new Error(`${file}: header not in the shape figure() expects`);
  for (const [, hex] of svg.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g))
    if (!FIG_COLOURS.has(hex)) throw new Error(`${file}: ${hex} is not a chart.mjs theme colour, so dark mode cannot recolour it`);
  const id = name.replace(/[^\w-]/g, "-");
  return `<figure id="${id}" class="chart">
${svg}
</figure>`;
}

// The card a figure's mark shows on hover: the instance, the method, the energy as the
// table quotes it, and the paper. The figure file carries only the link; the words are
// written here, from the same helpers as the table the link lands on.
function rowCard(r, inst) {
  return `<b>${esc(modelName(inst.model))} ${esc(instanceLabel(inst))}</b>
<span>${esc(shorten(methodText(r.method), 90))}</span>
<span class="e">${energyCell(r, inst)} <span class="muted">${perSiteLabel(inst)} &middot; ${boundLabel(r)}</span>${recordOf(inst) === r ? '<span class="tag">record</span>' : ""}</span>
<span class="muted">${cardSource(r)}</span>`;
}
const cardSource = r => { const c = citeRef(r, cache); return esc(c.note ? `${c.text}, ${c.note}` : c.text); };

// One card per row a figure links to, in a <template> so it is neither rendered nor read
// out; the script below moves a card into the floating box while its mark is hovered.
const FIG_SCRIPT = `<script>
(() => {
  const cards = new Map([...document.getElementById("fig-cards").content.children].map(c => [c.dataset.row, c.innerHTML]));
  const tip = document.createElement("div");
  tip.id = "fig-tip"; tip.hidden = true; tip.setAttribute("role", "tooltip");
  document.body.append(tip);
  let on = null;
  const place = e => {
    const gap = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    const x = e.clientX + gap + w > innerWidth - 8 ? e.clientX - gap - w : e.clientX + gap;
    const y = e.clientY + gap + h > innerHeight - 8 ? e.clientY - gap - h : e.clientY + gap;
    tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
  };
  for (const fig of document.querySelectorAll("figure.chart")) {
    fig.addEventListener("pointerover", e => {
      const a = e.target.closest("a.pt");
      // An SVG <a> has no .hash, unlike an HTML one: read the attribute.
      const row = a && a.getAttribute("href").split("#")[1];
      if (!a || a === on || !cards.has(row)) return;
      on = a;
      tip.innerHTML = cards.get(row) + '<span class="go">Click to open this row in the table</span>';
      tip.hidden = false;
      place(e);
    });
    fig.addEventListener("pointermove", e => { if (on) place(e); });
    fig.addEventListener("pointerout", e => {
      if (on && !on.contains(e.relatedTarget)) { on = null; tip.hidden = true; }
    });
  }
})();
</script>`;

// The per-family panels sit folded under the overview figure, behind a link-styled summary.
function homePage() {
  const [overview, byFamily] = FIGURES;
  const figures = [figure(overview), `<details class="fig-more">
  <summary>Look at the dissection per method family</summary>
${figure(byFamily)}
</details>`, sizeSwitcher(), costSwitcher()].join("\n");
  const linked = new Set([...figures.matchAll(/href="\/instances\/#(r-[\w-]+)"/g)].map(m => m[1]));
  const cards = instances.flatMap(inst => inst.rows.filter(r => linked.has(rowId(inst, r)))
    .map(r => `<div data-row="${rowId(inst, r)}">${rowCard(r, inst)}</div>`));
  if (cards.length !== linked.size) throw new Error(`figures link ${linked.size} rows, ${cards.length} found in data/: a figure is older than the data`);
  const body = `
<h1>The best published ground-state energies</h1>
<p class="lead">QMBL is a record book of the state of the art in quantum many-body simulation. Browse
through the leaderboard figures below interactively or look at the pure data in the
<a href="/instances/">table</a>.</p>

${figures}
<template id="fig-cards">${cards.join("\n")}</template>
${FIG_SCRIPT}

<section class="cite" id="cite">
  <h2>Citing QMBL</h2>
  <p>Cite the dataset by its concept DOI, which always resolves to the latest release:</p>
  <blockquote class="citation">${esc(CITE_HEAD)}, <em>${esc(CITE_TITLE)}</em>, ${esc(CITE_TAIL)}
  <a href="https://doi.org/${DOI}">${DOI}</a></blockquote>
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

// The Table's text box matches words, in any order, against what an instance is (Hamiltonian,
// lattice, size, boundary, couplings, filling) and against the methods of its rows: "hubbard
// 16x16 U=8 afqmc" finds the 16x16 U = 8 Hubbard instances carrying an AFQMC energy. The
// method words have to come from one row, so "variational monte carlo" does not match an
// instance where one row says variational and another Monte Carlo. A word with a digit has to
// match whole, so 0.5 does not find J2 = 0.55; any other word matches as a prefix, so "heis"
// finds Heisenberg. The aliases are the other names a reader types for the same thing, each a
// fact about the instance or the row (vendor/varbench for the impurity codes).
//
// searchWords is the one tokeniser for both sides - the page embeds its source - so a query is
// cut into words exactly as the index was: "U = 8", "U=8" and "u=8.0" are all the word u=8.
function searchWords(text) {
  const s = String(text).toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/&asymp;|≈|~/g, "=").replace(/[×*]/g, "x")
    .replace(/(\d)\s*x\s*(?=\d)/g, "$1x").replace(/(\d)\s+by\s+(?=\d)/g, "$1x")
    .replace(/\s*([=\/])\s*/g, "$1")
    .replace(/(\d\.\d*?)0+(?!\d)/g, "$1").replace(/(\d)\.(?!\d)/g, "$1")
    .replace(/(?<![=\d.])(\d+)[\s-]+sites?\b/g, "n=$1")
    .replace(/neural[\s-]+quantum[\s-]+states?/g, "nqs").replace(/quantum[\s-]+monte[\s-]+carlo/g, "qmc")
    .replace(/tensor[\s-]+networks?/g, "tensornetwork");
  const out = [];
  for (const raw of s.split(/[\s,;:()[\]{}"'`+&!?]+/)) {
    const word = raw.replace(/^[^\p{L}\p{N}-]+|[^\p{L}\p{N}]+$/gu, "").replace(/^-(?!\d)/, "");
    if (!word) continue;
    const parts = word.split(/[_\/=]+|(?<=\p{L})-|-(?!\d)|(?<=\d)x(?=\d)/u).filter(p => p && p !== word);
    out.push([word, parts]);
  }
  return out;
}

// Whether an instance matches a query: every query word is among the instance's own words plus
// one row's method words, the same row for all of them. A word that is not in the index whole
// may still match by its parts ("open-boundary", "half-filled"), unless it is a coupling or a
// size, where the parts alone would find the wrong instance ("u=8" is not an 8x8 at U = 4), or
// a part is one letter, which as a prefix matches nearly anything.
function searchMatch(sets, query) {
  const has = (words, w) => /\d/.test(w) && !w.includes("_") ? words.includes(w) : words.some(t => t.startsWith(w));
  const found = (words, [w, parts]) => has(words, w)
    || (!/[=\/]|\dx\d/.test(w) && parts.length > 1 && parts.every(p => p.length > 1 && has(words, p)));
  return sets.some(words => query.every(q => found(words, q)));
}

// Words a query may carry that name nothing: "square lattice", "at half filling".
const SEARCH_STOP = ["a", "an", "and", "at", "by", "for", "in", "of", "on", "the", "with", "model", "models", "lattice",
  "lattices", "hamiltonian", "hamiltonians", "boundary", "boundaries", "condition", "conditions", "system", "size",
  "instance", "instances"];

const MODEL_WORDS = {
  Heisenberg: "heisenberg",
  J1J2: "j1j2 heisenberg",
  Hubbard: "fermi-hubbard",
  tV: "spinless-fermions tv",
  TFIsing: "tfim tfi",
  Impurity: "anderson dmft bath",
};
const SHAPE_WORDS = { chain: "1d one-dimensional", square: "2d", rectangular: "2d rectangle", triangular: "2d triangle",
  kagome: "2d", shuriken: "2d", pyrochlore: "3d" };
const BOUNDARY_WORDS = { O: "open obc", P: "periodic pbc", PO: "periodic/open cylinder",
  PA: "periodic/antiperiodic antiperiodic apbc" };
// vendor/varbench/Impurity/README.md: SB single-band, TB the three-band Kanamori model of
// Sr2RuO4, SOC with spin-orbit coupling, MT a metal and MI a Mott insulator on the Bethe
// lattice, HF at half filling and AHF doped.
const IMPURITY_WORDS = [
  [/^SB-/, "single-band"], [/^SB-DMFT/, "bethe"], [/^TB-/, "three-band kanamori sr2ruo4 hund t2g"],
  [/SOC/, "spin-orbit-coupling"], [/-MT-/, "metal metallic"], [/-MI-/, "mott-insulator insulating"],
  [/-HF$/, "half-filling half-filled"], [/-AHF$/, "doped doping"],
];
// Method families by what the method string says; a row gets every alias whose pattern it matches.
const NEURAL = /RBM|CNN|ViT|TQS|HQT|CTWF|RNN|GRU|LSTM|\bLRU\b|NQS|\bNN\b|NNB|FNN|FFN|\bMLP\b|GNN|ResNet|ConvNext|\bACE\b|\bSCALE\b|HFDS|HFPS|NAQS|[Tt]ransformer|[Aa]ttention|[Nn]eural|[Cc]onvolution|\bconv\b|[Hh]idden.[Ff]ermion|[Aa]utoregressive/;
const METHOD_WORDS = [
  [/[Ee]xact [Dd]iagonali[sz]ation|\bED\b/, "ed exact-diagonalization exact-diagonalisation"],
  [/QMC|stochastic series|GFMC/i, "qmc monte-carlo"],
  [/AFQMC/i, "afqmc auxiliary-field"],
  [/\bSSE\b|stochastic series/, "sse stochastic-series-expansion"],
  [/VMC|variational monte carlo/i, "vmc variational-monte-carlo"],
  [/RBM/, "rbm restricted-boltzmann-machine"],
  [/CNN|[Cc]onvolution|\bconv\b|ConvNext/, "cnn convolutional"],
  [/ViT/, "vit vision-transformer"],
  [/ViT|[Tt]ransformer|[Aa]ttention|TQS|HQT|CTWF/, "transformer"],
  [/RNN|GRU|LSTM|[Rr]ecurrent|\bLRU\b/, "rnn recurrent"],
  [/GNN|[Gg]raph neural/, "gnn graph-neural-network"],
  [/DMRG/, "dmrg mps tensor-network"],
  [/PEPS/, "peps tensor-network"],
  [/tensor product states|\bT-MPS\b/, "tensor-network"],
  [/VQE/, "vqe"],
  [/Hartree|\bHF\b/, "hf hartree-fock"],
  [NEURAL, "nqs neural-network"],
];

// The index of one instance: its own words, and one word list per distinct row method, each
// holding only words that start with a letter so a method's "bond dimension = 100" is not a
// size of 100. "16 sites" is the word n=16, so it does not find a 16x32 cylinder.
function searchIndex(inst, name) {
  const own = new Set();
  const add = text => { for (const [w, parts] of searchWords(text)) for (const x of [w, ...parts]) own.add(x); };
  const whole = word => own.add(word.toLowerCase());
  add(`${name} ${MODEL_WORDS[inst.model] ?? ""} ${instanceLabel(inst)} ${inst.lattice} ${latticeOf(inst)} ${SHAPE_WORDS[latticeOf(inst)] ?? ""}`);
  whole(inst.instance_id);
  if (inst.boundary) add(BOUNDARY_WORDS[inst.boundary] ?? "");
  if (inst.boundary === "P" && /2d/.test(SHAPE_WORDS[latticeOf(inst)] ?? "")) add("torus");
  const n = inst.n_sites, side = Math.sqrt(n);
  add(`${n} n=${n} sites`);
  const dims = inst.lattice.match(/^[a-z]+-(\d+(?:x\d+)+)$/)?.[1].split("x")
    ?? (/^(square|triangular)$/.test(inst.lattice) && Number.isInteger(side) ? [side, side] : null);
  if (dims) add(`${dims.join("x")} ${[...dims].reverse().join("x")}`);
  if (/^(square|triangular)$/.test(inst.lattice) && Number.isInteger(side)) add(`l=${side}`);
  if (inst.lattice === "chain") add(`l=${n}`);
  const p = inst.params ?? {};
  if (p.J2 != null) add(`j2=${p.J2} j2/j1=${p.J2}`);
  if (p.h != null) add(`h=${p.h} h/j=${p.h} γ=${p.h} gamma=${p.h}`);
  if (p.U != null) add(`u=${p.U} u/t=${p.U} ${p.U < 0 ? "attractive" : p.U > 0 ? "repulsive" : ""}`);
  if (p.V != null) add(`v=${p.V} v/t=${p.V}`);
  if (p.Nf != null) {
    const fill = Number(((inst.model === "Hubbard" ? 2 * p.Nf : p.Nf) / n).toFixed(4));
    add(`n=${fill}`);
    if (fill === (inst.model === "Hubbard" ? 1 : 0.5)) add("half-filling half-filled");
    else if (inst.model === "Hubbard") {
      const doping = Number((1 - fill).toFixed(4)), k = Math.round(1 / Math.abs(doping));
      add(`doped doping=${doping}`);
      if (Math.abs(1 / Math.abs(doping) - k) < 1e-9) whole(`1/${k}`);
    }
  }
  if (inst.model === "Impurity") for (const [re, words] of IMPURITY_WORDS) if (re.test(inst.lattice)) add(words);
  if (!recordOf(inst)) add("no record");
  const methods = new Set(inst.rows.map(r => {
    const aliases = METHOD_WORDS.filter(([re]) => re.test(r.method)).map(([, words]) => words);
    if (r.bound_type === "exact" || r.bound_type === "extrapolated") aliases.push(r.bound_type);
    const words = new Set();
    for (const [w, parts] of searchWords(`${methodText(r.method)} ${aliases.join(" ")}`))
      for (const x of [w, ...parts]) if (/^\p{L}/u.test(x)) words.add(x);
    return [...words].join(" ");
  }));
  return { own: [...own].join(" "), methods: [...methods].join("|") };
}


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
    return `<tr id="${rowId(inst, r)}" class="${isRec ? "is-record" : ""}${r.defect ? " is-flagged" : ""}">
      <td class="record">${energyCell(r, inst, isRec ? null : decimals)}${isRec ? '<span class="tag">record</span>' : gap ? ` <span class="muted num">(${esc(gap)})</span>` : ""}</td>
      <td class="num">${sigma == null ? '<span class="muted">n/a</span>' : sigma.toExponential(1)}</td>
      <td><span class="badge">${boundLabel(r)}</span>${r.defect ? ` ${flagBadge(r)}` : ""}</td>
      <td>${esc(shorten(methodText(r.method), 60))}</td>
      <td>${citeHtml(r)}</td>
      <td class="num">${yearOf(r) ?? '<span class="muted">n/a</span>'}</td>
    </tr>`;
  }).join("");
  return `${costSlot(inst)}
    <table class="next"><thead><tr><th>${perSiteLabel(inst)}</th><th>&sigma;</th><th>kind</th><th>method</th><th>source</th><th>year</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="links"><a href="${jsonUrl(inst)}">JSON</a></p>`;
}

function instancesPage() {
  const sections = MODELS.map(([model, name]) => {
    const group = instances.filter(i => i.model === model).sort(byGeometry);
    if (!group.length) return "";
    const rows = group.map(inst => {
      const rec = recordOf(inst);
      const label = instanceLabel(inst);
      const search = searchIndex(inst, name);
      const cells = rec
        ? `<td class="record">${energyCell(rec, inst)}</td><td>${esc(shorten(methodText(rec.method), 52))} ${citeHtml(rec)}</td>`
        : `<td class="none">no record</td><td>${esc(noRecordReason(inst))}</td>`;
      const id = `x-${inst.instance_id.replace(/[^\w-]/g, "_")}`;
      return `<tr class="inst" data-search="${esc(search.own)}" data-methods="${esc(search.methods)}" data-lattice="${esc(latticeOf(inst))}" data-size="${sizeBand(inst)}">
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
      <p class="muted"><span class="count">${group.length} instances</span>, energies as <code>${perSiteLabel(group[0])}</code></p>
      ${badges}
      <div class="scroll"><table class="leaderboard">
        <thead><tr><th>instance</th><th>record</th><th>method</th><th>rows</th></tr></thead>
        <tbody>${rows.join("")}</tbody></table></div>
    </section>`;
  }).join("\n");

  const body = `
<p class="search"><input id="filter" type="search" placeholder="Filter by Hamiltonian, lattice, size, coupling or method…" autocomplete="off" spellcheck="false">
<span id="filter-count" class="muted"></span></p>
<div class="quick models"><span class="muted">Hamiltonian</span>${MODELS.filter(([m]) => instances.some(i => i.model === m))
    .map(([m, n]) => `<button type="button" data-model="${m}">${esc(n)}</button>`).join("")}</div>
${sections}
<script>
const box = document.getElementById("filter");
const count = document.getElementById("filter-count");
const sections = [...document.querySelectorAll("section[data-model]")];
const total = document.querySelectorAll("tr.inst").length;

// The words of the text box against each instance's index; see searchIndex in scripts/site.mjs.
const searchWords = ${searchWords};
const searchMatch = ${searchMatch};
const STOP = new Set(${JSON.stringify(SEARCH_STOP)});
const index = new Map([...document.querySelectorAll("tr.inst")].map(row => {
  const own = row.dataset.search.split(" ");
  return [row, row.dataset.methods ? row.dataset.methods.split("|").map(m => own.concat(m.split(" "))) : [own]];
}));

// One selection per badge row (the Hamiltonian row on top, lattice and size per section); a badge
// toggles, and the text box applies on top.
function apply() {
  const q = box.value.trim();
  const words = searchWords(q).filter(([w]) => !STOP.has(w));
  const model = document.querySelector(".models button.on")?.dataset.model;
  let shown = 0;
  for (const section of sections) {
    const outside = model && section.dataset.model !== model;
    const lattice = section.querySelector(".quick button[data-lattice].on")?.dataset.lattice;
    const size = section.querySelector(".quick button[data-size].on")?.dataset.size;
    const rows = [...section.querySelectorAll("tr.inst")];
    let n = 0;
    for (const row of rows) {
      const hit = !outside && (!words.length || searchMatch(index.get(row), words))
        && (!lattice || row.dataset.lattice === lattice)
        && (!size || row.dataset.size === size);
      row.hidden = !hit;
      const more = row.nextElementSibling;
      if (!hit) { more.hidden = true; row.querySelector("button").setAttribute("aria-expanded", "false"); }
      if (hit) n++;
    }
    shown += n;
    section.hidden = outside || (!n && !lattice && !size);
    section.querySelector(".count").textContent = (n === rows.length ? "" : n + " of ") + rows.length + " instances";
  }
  count.textContent = q || model ? shown + " of " + total + " instances" : "";
}
box.addEventListener("input", apply);
for (const b of document.querySelectorAll(".quick button")) b.addEventListener("click", () => {
  const on = b.classList.contains("on");
  const key = ["model", "lattice", "size"].find(k => k in b.dataset);
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

// A figure's mark links here as #r-<instance>-<row>: open the instance holding that row,
// clear any filter hiding it, and bring the row into view, marked.
function reveal() {
  const row = location.hash.startsWith("#r-") && document.getElementById(location.hash.slice(1));
  if (!row) return;
  const more = row.closest("tr.more"), inst = more.previousElementSibling;
  if (inst.hidden) {
    box.value = "";
    for (const on of document.querySelectorAll(".quick button.on")) on.classList.remove("on");
    apply();
  }
  for (const old of document.querySelectorAll("tr.target")) old.classList.remove("target");
  more.hidden = false;
  inst.classList.add("open");
  inst.querySelector("button").setAttribute("aria-expanded", "true");
  row.classList.add("target");
  row.scrollIntoView({ block: "center" });
}
// Once now so the row is open at first paint, and again on load, because the browser's own
// scroll to the fragment comes after this script and would pin the row to the top edge.
addEventListener("hashchange", reveal);
addEventListener("load", reveal);
reveal();
</script>`;
  return page({ url: "/instances/", title: "Table", body, wide: true,
    description: `Every Hamiltonian instance in QMBL: ${summary.instances} instances across ${MODELS.length} models, with the record energy and method for each.` });
}

// ---------------------------------------------------------------------- instance page
function rowTable(rows, inst) {
  const head = `<thead><tr><th>${perSiteLabel(inst)}</th><th>&sigma;</th><th>Var(E)</th><th>V-score</th>
    <th>method</th><th>source</th><th>year</th></tr></thead>`;
  const body = rows.map(r => {
    const rec = recordOf(inst) === r;
    const badges = [
      r.defect ? flagBadge(r) : "",
      r.baseline ? '<span class="badge">VarBench reference run</span>' : "",
      r.provenance === "secondary" ? '<span class="badge">quoted from another paper</span>' : "",
      r.peer_reviewed === true ? '<span class="badge">peer reviewed</span>' : "",
      r.peer_reviewed === false ? '<span class="badge">preprint</span>' : "",
      !r.defect && r.bound_type === "variational" && !recordEligible(r) && isSampled(r.method) && r.sigma == null
        ? '<span class="badge">ineligible: sampled, no error bar</span>' : "",
    ].filter(Boolean).join(" ");
    const { sigma } = perSite(r, inst);
    return `<tr id="${rowId(inst, r)}" class="${rec ? "is-record" : ""}${r.defect ? " is-flagged" : ""}">
      <td class="record">${energyCell(r, inst)}${rec ? '<span class="tag">record</span>' : ""}</td>
      <td class="num">${sigma == null ? '<span class="muted">n/a</span>' : sigma.toExponential(1)}</td>
      <td class="num">${r.energy_variance == null ? '<span class="muted">n/a</span>' : r.energy_variance.toExponential(2)}</td>
      <td class="num">${r.v_score == null ? '<span class="muted">n/a</span>' : r.v_score.toExponential(1)}</td>
      <td>${esc(methodText(r.method))}${badges ? `<div class="badges">${badges}</div>` : ""}</td>
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
      <summary><b>${esc(flagLabel(r))}</b> &mdash; ${esc(shorten(methodText(r.method), 60))}, ${energyCell(r, inst)}</summary>
      <p><b>Finding.</b> ${esc(r.defect.finding)}</p>
      ${r.defect.diagnosis ? `<p><b>Diagnosis.</b> ${esc(r.defect.diagnosis)}</p>` : ""}
      ${r.defect.ruled_out ? `<p><b>Ruled out.</b> ${esc(r.defect.ruled_out)}</p>` : ""}
      ${r.defect.evidence ? `<p><b>Evidence.</b> ${esc(r.defect.evidence)}</p>` : ""}
    </details>`).join("");

  const verified = sorted.filter(r => r.verified).map(r => `
    <details class="verified">
      <summary>${energyCell(r, inst)} &mdash; ${esc(shorten(methodText(r.method), 60))}</summary>
      <p class="muted">Checked ${esc(r.verified.checked_on)} &middot; ${esc(r.verified.method)}</p>
      ${r.verified.reported_as ? `<p><b>Reported as.</b> ${esc(r.verified.reported_as)}</p>` : ""}
      ${r.verified.note ? `<p>${esc(r.verified.note)}</p>` : ""}
    </details>`).join("");

  const recordBox = rec
    ? `<div class="record-box">
        <p class="eyebrow">Record</p>
        <p class="big"><span class="num">${quoteRow(rec, inst).text}</span>
          <span class="unit">${perSiteLabel(inst)}</span></p>
        <p>${esc(methodText(rec.method))}</p>
        <p class="muted">${citeHtml(rec)} &middot; ${rec.bound_type === "exact"
          ? stochasticExact(rec)
            ? "exact (stochastic) energy: sign-problem-free QMC, exact within its error bar, and the state of the art on this instance"
            : "exact energy: the instance is solved, and this is the state of the art on it"
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

  const recText = rec ? `Record ${quoteRow(rec, inst).text} ${perSiteLabel(inst)} by ${shorten(methodText(rec.method), 40)}.` : "No row currently holds the record.";
  return page({ url: instUrl(inst), title: label, body, wide: true,
    description: `${label}: ${inst.rows.length} published ground-state energies. ${recText}` });
}

// --------------------------------------------------------------------- contribute page
function contributePage() {
  const b = summary.blocked_on_sigma;
  const costed = instances.flatMap(i => i.rows).filter(r => r.compute?.gpu_hours != null || r.compute?.cpu_core_hours != null || r.compute?.parameters != null).length;
  const body = `
<h2>Open an issue</h2>
<p>All of it goes through <a href="${REPO}/issues">GitHub issues</a>.</p>
<ul>
  <li><b>A missing result.</b> The instance, the energy, its error bar, the method, and the paper
  it was published in. Anything missing renders as <code>n/a</code> rather than blocking the row
  (<a href="${RULES}#3-required-fields">rules &sect;3</a>).</li>
  <li><b>A number is wrong, or attributed to the wrong paper.</b> Name the instance and what it
  should be. Rows are corrected in place and the history stays in git.</li>
  <li><b>An error bar we could not find.</b> ${b.rows} sampled energies across ${b.instances}
  instances are listed but rank for nothing because no error bar was found in the source we read,
  and ${b.would_take_record} of them sit below their instance's current record. One message closes
  that (<a href="${RULES}#6-records-and-ties">rules &sect;6</a>).</li>
  <li><b>An objection to a row.</b> Wrong symmetry sector, a mis-declared <code>bound_type</code>,
  an error bar with no autocorrelation correction: these are technical disputes with a process,
  <a href="${RULES}#10-pending-confirmed-objections">rules &sect;10</a>.</li>
  <li><b>What a number cost.</b> GPU-hours &times; device, parameter count, wall-clock. ${costed}
  rows state at least one of these, which is what the <a href="/#energy-vs-compute">energy-versus-cost
  figure</a> is drawn from; yours can join them
  (<a href="${DATA}#what-a-number-cost-the-compute-block">the format is specified</a>).</li>
</ul>`;
  return page({ url: "/contribute/", title: "Contribute", body,
    description: "How to correct a row, add a published result, supply a missing error bar, or object to a record in QMBL." });
}

function notFoundPage() {
  // QMBL in the Ticks Slant figlet font, generated by scripts/ascii.mjs. The stripes the letters sit on
  // run out EXT columns each side (keeping the slant) so the banner fills the column at the largest font size.
  const EXT = 16;
  const ticks = esc(fs.readFileSync("figures/qmbl-ticks-slant.txt", "utf8").replace(/\s+$/, "").split("\n").map(l => {
    const sp = l.match(/^ */)[0].length;
    return l.slice(0, sp) + "_".repeat(EXT) + l.slice(sp) + "_".repeat(EXT);
  }).join("\n"));
  return page({ url: "/404.html", title: "Not found", description: "Page not found.", body: `
<pre class="ticks" aria-hidden="true">${ticks}</pre>
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
    "projected/fixed-node estimate, zero-variance extrapolation, or numerically exact (exact (stochastic)",
    "for sign-problem-free QMC, which is exact within its stated error bar). An exact",
    "energy is the record wherever one exists; otherwise only a strict variational bound can hold",
    "it. Energies are stored as totals in VarBench's convention",
    "and quoted per site; the conversion is in DATA.md. Individual energies must be cited to the",
    "primary paper named on the row, not to this site.",
    "",
    "## Pages",
    "- [Leaderboard](https://qmbl.org/): the accuracy and cost figures, and how to cite.",
    `- [Table](https://qmbl.org/instances/): every one of the ${summary.instances} instances, with its record and every energy.`,
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

main { padding: 2.4rem clamp(1rem, 4vw, 3rem) 4rem; max-width: 52rem; margin: 0 auto; }
main.wide { max-width: 78rem; }

footer.site {
  border-top: 1px solid var(--grid); padding: 1.6rem clamp(1rem, 4vw, 3rem) 3rem;
  font-size: 0.9rem; color: var(--ink2); text-align: center;
}
footer.site p { margin: 0.3rem auto; }

figure { margin: 2.2rem 0 0; }
figure picture, figure img, figure.chart svg { display: block; width: 100%; max-width: 920px; height: auto; }
figure img, figure.chart svg { border: 1px solid var(--grid); border-radius: 3px; background: var(--surface); }
figure.chart a.pt { cursor: pointer; }
figure.chart a.pt > :nth-child(2) { transform-box: fill-box; transform-origin: center; transition: transform 80ms; }
figure.chart a.pt:hover > :nth-child(2) { transform: scale(1.45); }
#fig-tip {
  position: fixed; z-index: 10; pointer-events: none; max-width: 24rem; padding: 0.55rem 0.75rem;
  font-size: 0.82rem; line-height: 1.45; color: var(--ink); background: var(--surface);
  border: 1px solid var(--grid); border-radius: 3px; box-shadow: 0 6px 20px rgb(0 0 0 / 0.14);
}
#fig-tip > b, #fig-tip > span { display: block; }
#fig-tip > b { font-weight: 600; }
#fig-tip .e { margin: 0.2rem 0; }
#fig-tip .e .num { font-weight: 600; color: var(--record); }
#fig-tip .go { margin-top: 0.3rem; font-size: 0.75rem; color: var(--accent); }

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
.badge.flag[title] { cursor: help; }
header.site nav .badge.beta { font-size: 0.75rem; padding: 0.15rem 0.6rem; color: var(--flag); border-color: var(--flag); letter-spacing: 0.06em; text-transform: uppercase; }
.legend { font-size: 0.9rem; color: var(--ink2); max-width: 46em; }
.citation { max-width: none; }

section[data-model] h2 { font-size: 2.1rem; margin-top: 3rem; }
main > p.lead:first-child { margin-top: 0; }

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
table.next tr.target > td, .rows tr:target > td {
  background: color-mix(in srgb, var(--accent) 18%, transparent); animation: row-in 1.6s ease-out;
}
table.next tr.target > td:first-child, .rows tr:target > td:first-child { box-shadow: inset 3px 0 0 var(--accent); }
@keyframes row-in { from { background: color-mix(in srgb, var(--accent) 45%, transparent); } }

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
details.fig-more { border-top: 0; padding: 0; margin-top: 0.6rem; }
details.fig-more summary { display: inline; list-style: none; color: var(--accent); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }
details.fig-more summary::-webkit-details-marker { display: none; }
details.fig-more summary:hover { text-decoration-thickness: 2px; }
details.fig-more summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
details.fig-more figure { margin-top: 1rem; }

.cite { background: var(--surface); border: 1px solid var(--grid); border-radius: 3px; padding: 0.4rem 1.2rem 1.2rem; margin-top: 2.4rem; }
.cite h2 { margin-top: 1.2rem; }
blockquote.citation { margin: 1rem 0; padding: 0 1em; border-left: 0.25em solid var(--muted); color: var(--ink2); max-width: 46em; }

p.search { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1rem; max-width: none; }
#filter {
  font: inherit; font-size: 1.25rem; padding: 0.85rem 1.1rem; flex: 1 1 20rem; min-width: 0;
  background: var(--surface); color: var(--ink); border: 1px solid var(--grid); border-radius: 3px;
}
#filter-count { font-size: 0.95rem; min-width: 11em; }
.quick.models { margin-top: 1rem; }

.anchor {
  margin-left: 0.4rem; color: var(--grid); text-decoration: none; font-size: 0.8em;
  opacity: 0; transition: opacity 0.1s;
}
h1:hover .anchor, h2:hover .anchor, h3:hover .anchor, h4:hover .anchor { opacity: 1; color: var(--muted); }
hr { border: 0; border-top: 1px solid var(--grid); margin: 2rem 0; }
pre.ticks { font-family: var(--mono); font-size: clamp(7px, 1.6vw, 13px); line-height: 1.2; color: var(--muted);
  margin: 0 0 2rem; overflow: hidden; white-space: pre; }
.tabs > input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.tab-labels { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.6rem 0 0.8rem; font-size: 0.8rem; }
.tab-labels label {
  line-height: 1.2; cursor: pointer; padding: 0.2rem 0.65rem;
  color: var(--ink2); background: var(--surface); border: 1px solid var(--grid); border-radius: 999px;
}
.tab-labels label:hover { border-color: var(--accent); color: var(--accent); }
.tab-panels > * { display: none; }
.tab-panels > .tabs > .tab-labels { margin-top: 0; }
${TAB_CSS}
tr.more figure.chart { margin: 0.4rem 0 0.8rem; }
.cost-none { font-size: 0.8rem; margin: 0.2rem 0 0.5rem; }
@media (prefers-color-scheme: dark) {
${FIG_DARK}
}
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
