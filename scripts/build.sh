#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/emit.mjs | tail -n +2
node scripts/add_literature.mjs
node scripts/add_sweep_rows.mjs
node scripts/add_sweep2_rows.mjs
node scripts/add_sweep3_rows.mjs
node scripts/apply_defects.mjs
node scripts/validate.mjs
