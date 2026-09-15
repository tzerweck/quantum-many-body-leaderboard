# Handoff — literature sweep pipeline

Operational notes for whoever picks up the sweep next. Not part of the dataset; the
scientific record is [`SWEEP.md`](SWEEP.md), the adjudication rules are [`RULES.md`](RULES.md).

Written 2026-09-15, at commit `5151e3a`.

## State

| | |
|---|---|
| instances / rows | 205 / 675 |
| candidate pool | **7940** (`sweep-candidates.tsv`), 1927 peer reviewed |
| cached sources | 214 PDF-text + 165 HTML |
| harvested table cells | 4547 (2368 HTML + 2179 PDF) |
| matcher worklist | 260 candidates over 56 instances, 88 cells below a current record |
| `scripts/validate.mjs` | 6 known issues, all pre-existing and explained — see below |

The working tree was clean and `main` was at my commit as of 2026-09-15 09:48.

## The one number that matters

**7748 of the 7940 candidates have never been fetched, let alone read.** Only 192 have a
cached source. Of the 1927 peer-reviewed candidates, 1874 are unfetched.

The pipeline is no longer the bottleneck — it works end to end. The bottleneck is that
almost nothing has been through it. That is the job.

## What changed on 2026-09-14 (why the pool jumped 161 → 7940)

Four defects made the old harvester report its own coverage incorrectly. Full account in
`SWEEP.md`; in one line each:

- `max_results=40`, no paging — every query silently truncated at 40 hits.
- A network failure returned `""`, logging as `0 since 2025` — identical to a query that
  genuinely matched nothing.
- The date floor was hard-coded at 2025-01-01, so the pre-2024 backlog was never searched.
- The table harvester read only HTML, and arXiv has no HTML before ~Dec 2023.

Then, found by pointing the fixed pipeline at the empty families:

- A systematic **off-by-one in PDF column assignment** (headers centred, values
  right-aligned) that filed a J2 = 0.4 energy under J2 = 0.7 and called it a record.
- **No coupling check** — one 4×4 energy matched both `tV/..._0.01` and `tV/..._0.1`.
- **No boundary-condition check** — an open-chain value matched a periodic instance.
- **TFIsing was unmatchable by construction**: wrong divisor by 4×, no size tokens, no BC
  check. Fixed; its first-ever candidate turned out to be a defect in the source paper.

## Do this next, in this order

### 1. Finish what TFIsing started — two families are still unmatchable by construction

This is cheap and high value. TFIsing showed 0/7 not because nobody published but because
a match was arithmetically impossible. **Two more families are in that state right now**,
both verified 2026-09-15:

**Impurity — every instance is skipped before any cell is considered.**
`perSiteDivisor()` returns `null` for Impurity (there is no meaningful per-site energy for
a bath-discretised impurity model), and `match_tables.mjs:150` does `if (div == null)
continue;`. All 12 instances are invisible to the matcher. 0/12 is guaranteed, and 84
candidates (45 peer reviewed) are sitting in the pool with nothing to match against.

The fix is *not* to invent a per-site divisor. The matcher compares in per-site units
because that is what papers quote; for Impurity it needs to compare **total** energies at
equal bath size instead. That is a design decision, not a patch — treat it as one.

**Shuriken — the instances carry only an `N=` token.**
The shuriken lattice has 6 sites per unit cell, so 24 = 6·2², 96 = 6·4², 216 = 6·6²,
384 = 6·8². `instanceTokens()` has special cases for kagome (3 sites/cell) and pyrochlore
(4 sites/cell) but none for shuriken, so a paper writing "4×4" or "L = 4" for the 96-site
cluster can never match. Add the 6-sites-per-cell case alongside the other two.

**Pyrochlore is a different story** — 174 candidates (110 peer reviewed), tokens look
correct, and 0 matches simply because almost none of those papers are fetched yet. It
should fall out of step 2 rather than needing a code change.

### 2. Fetch and harvest the untriaged pool

Prioritised worklist, peer-reviewed and unfetched, in the zero-coverage families:

| family | candidates | peer reviewed | unfetched peer reviewed |
|---|---|---|---|
| pyrochlore | 174 | 110 | 100 |
| Impurity | 84 | 45 | 45 |
| TFIsing | 32 | 19 | 18 |
| shuriken | 25 | 16 | 15 |
| tV | 23 | 18 | 18 |

196 papers. At ~9 s each that is about half an hour of fetching.

```bash
cd ~/research/qmbl
# build a worklist: peer-reviewed, in a zero-coverage family, no cached source
node --input-type=module -e '
import fs from "node:fs";
const [h,...r]=fs.readFileSync("sweep-candidates.tsv","utf8").split("\n").filter(Boolean);
const have=new Set(fs.readdirSync("sources").filter(f=>/\.(txt|html)$/.test(f)).map(f=>f.replace(/\.(txt|html)$/,"")));
const ZC=["tV","Impurity","TFIsing","pyrochlore","shuriken"];
const ids=r.map(l=>l.split("\t")).filter(c=>c[3]==="yes"&&!have.has(c[2])&&(c[7]||"").split("+").some(f=>ZC.includes(f))).map(c=>c[2]);
fs.writeFileSync("/tmp/todo.tsv","arxiv\n"+[...new Set(ids)].join("\n")+"\n");
console.error(ids.length+" to fetch");'

node scripts/fetch_pdfs.mjs --from /tmp/todo.tsv    # ~9 s/paper, resumable, skips cached
node scripts/harvest_tables.mjs                      # rebuilds sweep-tables.tsv
node scripts/match_tables.mjs | less                 # the worklist
```

`fetch_pdfs.mjs` is resumable — it skips anything already extracted, so re-running after an
interruption costs nothing. **Commit `sources/*.txt` as you go**; see the `/tmp` warning.

### 3. Then work outward

1874 unfetched peer-reviewed candidates remain after the above. Sort by `score`, work down,
and re-run the harvest/match pair periodically rather than at the end.

Three queries hit the page cap and are still truncated — `vscore`, `minsr-opt`, `nqs-any`
(see `sweep-queries.tsv`). Re-run those with a higher cap when the pool is otherwise dry:

```bash
node scripts/sweep_search.mjs --via search --since 2019-01-01 --max-pages 40 \
     --only vscore,minsr-opt,nqs-any
```

Results merge into the existing file; a partial run can only ever add.

### 4. Open items not yet resolved

- **`arXiv:2605.13807`** — its variational column sits below its own exact column at
  N = 10, 24, 32. Verified against an independent ED (`checks/tfim_obc_ed.mjs`), so it is
  real. Not yet written as a row. It is a preprint; decide whether it becomes a flagged row
  on `TFIsing/chain_10_O_1` or stays a watch item. Note that instance would then carry
  *two* sub-exact variational rows from unrelated groups.
- **`arXiv:2507.10705`** — the only tV candidate, 4×4 spinless fermions, `-0.74177(5)`.
  Both filling and V are UNSTATED in the harvested context, so the instance cannot be
  assigned without reading the paper. It matched two sibling instances at once.
- **`arXiv:2211.16932`** — rejected, infinite-lattice iPEPS on the shuriken lattice, would
  have produced three false records. Recorded in `SWEEP.md`. Kept here because the next
  shuriken paper will look exactly like it.
- **2 DOF errors from upstream VarBench**: `Heisenberg/square_196_P[1]` and
  `Heisenberg/triangular_144_P[1]` both store `dof = 100` for 196- and 144-site instances.
  Both rows are `varbench@2024-10-22`, so this is imported, not ours. Decide whether to
  correct locally and record the divergence.

## `validate.mjs`: the 6 issues are known

Do not treat a non-empty validator as a regression. All six predate this work:

- 2 × `DOF` — upstream VarBench, above.
- 3 × `BOUND` on TFIsing `RBM (alpha = 1)` — fully investigated in
  `checks/tfising_rbm_check.py`: the published values are minima of the optimisation trace,
  not converged measurements. Resolved, not open.
- 1 × `BOUND` on `Hubbard/square_16_P_5_2.1544` DMRG, 1.7e-6 below exact — not investigated.

What *would* be a regression: any `TFCONV` line. That assertion derives the stored TFIsing
exact rows from the free-fermion solution and catches a convention drift immediately.

## Environment — the parts that cost time

**`export.arxiv.org/api` has been returning 429 to every request since 2026-09-14 ~14:45.**
Still 429 eighteen hours later. `arxiv.org` itself (PDFs, HTML, `/search`) is fine — they
are rate limited separately. Use `--via search`, which is the default under `--via auto`.
Do not conclude the sweep found nothing; it now fails loudly instead, which is the point.

**Never keep state in `/tmp`.** It was wiped mid-session on 2026-09-14, destroying a
chained job and every log. The PDF fetch survived only because its output went to
`sources/`. Put logs in `~/agent-runs/qmbl/`.

**Backgrounded shells do not survive.** `nohup ... &` from a tool call died with the
session. Use the harness's own background mechanism, or a `systemd --user` timer for
anything that must outlive a turn. If you must wait on a process, wait on its **PID**
(`while kill -0 $PID`) — `pgrep -f <pattern>` matches the waiting shell itself.

**Another agent session works in this repo concurrently.** On 2026-09-14 its commit
`4f1811e` swept up my in-progress `sweep_search.mjs` and `fetch_pdfs.mjs` under an
unrelated message. Nothing was lost, but the history is misleading there. Commit early,
stage explicit paths, and never `git add -A`. It owns `STATS.md`, `README.md`,
`scripts/stats.mjs`, `scripts/enrich_sources.mjs` and the affiliations files.

**No system python.** PDF extraction goes through `uv run --quiet --with pypdf`.

**Node quirks.** Use `node --input-type=module -e` for anything with top-level `await`;
mixing `require()` and top-level await is a hard error. Beware `String.replace(a, b)` on
vault or source text — a literal `$'` in the replacement pastes the rest of the string back
in.

## Method reminders that are easy to lose

- **Mine tables, not claim sentences.** The 09-13 sweep read prose and found nothing for
  the frustrated magnets, because those papers print a table and never write the sentence.
- **A rejected lead is a result.** Record it. The thermodynamic-limit rejections are the
  clearest argument the project has, and each one would otherwise be rediscovered.
- **Internal consistency beats plausibility.** The column shift was not caught by the size
  of the claim — it was caught by an *exact* value landing below another exact value on the
  same instance. Cross-check every new table against a quantity you already know.
- **Nothing is imported without reading the paper.** The matcher says which paper to open
  (`RULES.md` §8). It does not decide units, sectors or boundary conditions.
