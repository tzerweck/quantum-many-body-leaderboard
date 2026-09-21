#!/usr/bin/env bash
# One ssh: the qmbl-cost jobs in the queue, and the FINAL / RUNG / error lines of their logs.
set -euo pipefail
timeout 60 ssh -o ConnectTimeout=25 -o ControlMaster=no -o ControlPath=none euler '
squeue -u $USER -o "%.10i %.26j %.12P %.8T %.9M %R" | grep -E "JOBID|qmbl-cost" || echo "no qmbl-cost jobs queued"
cd ~/agent-runs/qmbl-cost/euler/logs 2>/dev/null || exit 0
for f in $(ls -t qmbl-cost-*-*.out 2>/dev/null | grep -v smoke | head -12); do
  n=$(grep -c "^step" "$f" 2>/dev/null || true)
  last=$(grep "^step" "$f" | tail -1 | cut -c1-90)
  fin=$(grep -E "^FINAL|^RUNG|^DONE|wrong GPU|Error|CANCELLED|TIME LIMIT" "$f" | tail -2 | cut -c1-160)
  echo "--- $f: $n step lines; $last"; [ -n "$fin" ] && echo "$fin"
done
ls ~/agent-runs/qmbl-cost/results/ 2>/dev/null | grep -c json | sed "s/^/results files: /"'
