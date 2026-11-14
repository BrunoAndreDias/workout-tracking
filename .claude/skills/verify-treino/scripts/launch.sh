#!/usr/bin/env bash
# Starts a private Vite dev server for one verification run.
# Usage: launch.sh [port]   (default 5190; never 5180, which belongs to the user's own `npm run dev`)
# Prints RUN_DIR=... and APP_URL=... on success.
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
(cd "$ROOT" && scripts/link-node-modules.sh)
PORT="${1:-5190}"
if [ "$PORT" = 5180 ]; then echo "refusing port 5180: it is the user's dev server" >&2; exit 1; fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then echo "port $PORT is busy; pass another port" >&2; exit 1; fi
RUN_DIR="$ROOT/e2e/shots/verify/$(date +%Y%m%d-%H%M%S)-$PORT"
mkdir -p "$RUN_DIR"
cd "$ROOT"
# Its own database in the run dir, never the user's; WORKOUT_TEST=1 lets openApp empty it.
WORKOUT_TEST=1 WORKOUT_DB="$RUN_DIR/workout.sqlite" nohup node_modules/.bin/vite --port "$PORT" --strictPort --host 127.0.0.1 >"$RUN_DIR/vite.log" 2>&1 &
echo $! >"$RUN_DIR/server.pid"
echo "$PORT" >"$RUN_DIR/server.port"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$PORT/" 2>/dev/null | grep -q '<title>Treino</title>'; then
    echo "RUN_DIR=$RUN_DIR"
    echo "APP_URL=http://127.0.0.1:$PORT/"
    exit 0
  fi
  if ! kill -0 "$(cat "$RUN_DIR/server.pid")" 2>/dev/null; then
    echo "vite exited during startup; log follows" >&2
    cat "$RUN_DIR/vite.log" >&2
    exit 1
  fi
  sleep 0.5
done
echo "not ready after 30 s; see $RUN_DIR/vite.log (run cleanup.sh $RUN_DIR)" >&2
exit 1
