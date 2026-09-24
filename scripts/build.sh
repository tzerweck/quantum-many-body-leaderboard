#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/emit.mjs | tail -n +2
node scripts/add_literature.mjs
node scripts/add_sweep_rows.mjs
node scripts/add_sweep2_rows.mjs
node scripts/add_sweep3_rows.mjs
node scripts/add_pdf_rows.mjs
node scripts/add_kagome_rows.mjs
node scripts/add_triangular_rows.mjs
node scripts/add_worklist_rows.mjs
node scripts/add_exact_rows.mjs
node scripts/add_allresults_rows.mjs
node scripts/add_repo_data_rows.mjs
node scripts/add_cost_runs.mjs
node scripts/add_error_metrics.mjs
node scripts/add_compute.mjs
node scripts/add_coverage.mjs
# After every script that attaches by VarBench's instance names; everything below uses the new ones.
node scripts/apply_relabels.mjs
node scripts/apply_defects.mjs
node scripts/apply_removals.mjs
node scripts/apply_corrections.mjs
# After every script that matches rows by their published method string.
node scripts/apply_method_names.mjs
# Instance-level, after the names are final: the exact row a QMBL ED run reproduced is matched by its published string.
node scripts/add_ed_cost.mjs
node scripts/validate.mjs
# Last, and in this order: the summary counts the final tree, and the README table is
# generated from it. Neither is ever hand-edited.
node scripts/summary.mjs > /dev/null
node scripts/readme_table.mjs
node scripts/figures.mjs
node scripts/size_accuracy.mjs
node scripts/size_energy.mjs
node scripts/pareto.mjs
node scripts/logo.mjs
# Generated output, gitignored. Built here too so a site that no longer renders the data
# fails locally rather than in the Pages workflow.
node scripts/site.mjs
