#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/emit.mjs | tail -n +2
node scripts/add_literature.mjs
node scripts/validate.mjs
