#!/usr/bin/env bash
# From the laptop: copy checks/cost/ to the cluster (~/agent-runs/qmbl-cost) in one ssh session,
# recording the commit the scripts came from; or fetch results back with `--fetch`. The cluster's
# ssh alias and paths are in slurm/site.env (gitignored; slurm/site.env.example lists them), which
# travels with the scripts.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f slurm/site.env ] || { echo "slurm/site.env is missing: copy slurm/site.env.example and fill it in" >&2; exit 2; }
set -a; source slurm/site.env; set +a
SSH="ssh -o ConnectTimeout=25 -o ControlMaster=no -o ControlPath=none $SSH_HOST"
if [ "${1:-}" = "--fetch" ]; then
  $SSH 'cd ~/agent-runs/qmbl-cost && tar czf - --exclude=results/failed results slurm/logs $(ls -d calibration ed/results 2>/dev/null)' | tar xzf - -C .
  # Results name the hardware, never the node or the partition (scrub.mjs); a configuration run
  # more than once keeps every run under results/runs/ and its best as the row.
  (cd ../.. && node checks/cost/scrub.mjs && node checks/cost/best_run.mjs)
  exit 0
fi
git rev-parse --short HEAD > COMMIT
tar czf - --exclude=results --exclude=calibration --exclude=ed/results --exclude=slurm/logs --exclude=__pycache__ . | $SSH 'mkdir -p ~/agent-runs/qmbl-cost && cd ~/agent-runs/qmbl-cost && tar xzf - && echo synced && ls'
