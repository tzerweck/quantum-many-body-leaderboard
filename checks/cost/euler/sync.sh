#!/usr/bin/env bash
# From the laptop: copy checks/cost/ to Euler (~/agent-runs/qmbl-cost) in one ssh session,
# recording the commit the scripts came from; or fetch results back with `--fetch`.
set -euo pipefail
cd "$(dirname "$0")/.."
SSH="ssh -o ConnectTimeout=25 -o ControlMaster=no -o ControlPath=none euler"
if [ "${1:-}" = "--fetch" ]; then
  $SSH 'cd ~/agent-runs/qmbl-cost && tar czf - results euler/logs $(ls -d calibration 2>/dev/null)' | tar xzf - -C .
  ls -la results; exit 0
fi
git rev-parse --short HEAD > COMMIT
tar czf - --exclude=results --exclude=calibration --exclude=euler/logs . | $SSH 'mkdir -p ~/agent-runs/qmbl-cost && cd ~/agent-runs/qmbl-cost && tar xzf - && echo synced && ls'
