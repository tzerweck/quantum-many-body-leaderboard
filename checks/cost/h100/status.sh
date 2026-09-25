#!/usr/bin/env bash
# One ssh: the ladder unit, its log tail, finished and failed jobs, and the card it runs on.
set -euo pipefail
timeout 60 ssh -o ConnectTimeout=25 "${1:-99problems}" 'R=/scratch/tzerweck/qmbl-cost
echo "unit: $(systemctl --user is-active qmbl-ladder) keepalive: $(systemctl --user is-active qmbl-ladder-keepalive.timer)"
tail -4 $R/ladder.log
echo "done: $(ls $R/ladder/*/h100-*.json 2>/dev/null | wc -l) of 28; failed: $(ls $R/ladder/*/FAILED 2>/dev/null | xargs -r -n1 dirname | xargs -r -n1 basename | tr "\n" " ")"
cur=$(grep START $R/ladder.log | tail -1 | awk "{print \$3}"); [ -n "$cur" ] && grep -E "^step" $R/ladder/$cur/$cur.log 2>/dev/null | tail -1 | cut -c1-100
nvidia-smi --query-gpu=index,utilization.gpu,memory.used --format=csv,noheader | tr "\n" ";"; echo'
