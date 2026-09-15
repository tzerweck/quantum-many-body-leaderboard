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
node scripts/apply_defects.mjs
node scripts/validate.mjs
# Last, and in this order: the summary counts the final tree, and the README table is
# generated from it. Neither is ever hand-edited.
node scripts/summary.mjs > /dev/null
node scripts/readme_table.mjs
node scripts/stats.mjs
node scripts/figures.mjs
