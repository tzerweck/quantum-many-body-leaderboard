#!/usr/bin/env bash
# Count the forward pass of every cost-run network (../forward_flops.py) on the H100 host.
# One ssh per call (the group hosts block bursts of connections).
#     bash checks/cost/h100/forward-flops.sh start [host]   copy the scripts, start the count as a user unit
#     bash checks/cost/h100/forward-flops.sh fetch [host]   status; once done, writes checks/cost/forward-flops.json
# The count runs on the CPU (it is a property of the program, not of the device); XLA's own counts
# are then repeated on one card the host's GPU policy lists as eligible, if there is one
# (forward-flops-run.sh). Logs land in qmbl-runs/forward-flops/ beside the repository.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${2:-99problems}"
R=/scratch/tzerweck/qmbl-cost/flops
LOCAL="$(git rev-parse --show-toplevel)/../qmbl-runs/forward-flops"
case "${1:-}" in
  start)
    tar -c run_nqs.py vit.py monitor.py forward_flops.py -C h100 forward-flops-run.sh |
      timeout 120 ssh -o ConnectTimeout=25 "$HOST" "set -euo pipefail
mkdir -p $R; rm -f $R/status $R/cpu.json $R/forward-flops.json $R/cpu.log $R/gpu.log; tar -x -C $R
systemd-run --user --unit=qmbl-forward-flops-\$(date +%s) --collect -p MemoryMax=48G -p CPUQuota=1600% bash $R/forward-flops-run.sh
echo started on \$(hostname)"
    ;;
  fetch)
    mkdir -p "$LOCAL"
    timeout 120 ssh -o ConnectTimeout=25 "$HOST" "tar -c --ignore-failed-read -C $R status cpu.log gpu.log forward-flops.json 2>/dev/null" | tar -x -C "$LOCAL"
    cat "$LOCAL/status" 2>/dev/null || echo "no status yet"
    if grep -q DONE "$LOCAL/status" 2>/dev/null && [ -s "$LOCAL/forward-flops.json" ]; then
      cp "$LOCAL/forward-flops.json" forward-flops.json
      echo "wrote checks/cost/forward-flops.json"
    fi
    ;;
  *) echo "usage: $0 start|fetch [host]" >&2; exit 2 ;;
esac
