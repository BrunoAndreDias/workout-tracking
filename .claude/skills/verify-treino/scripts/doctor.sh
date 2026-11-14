#!/usr/bin/env bash
# Read-only health check for an instance started by launch.sh.
# Usage: doctor.sh RUN_DIR   Exit 0 = worth driving.
set -uo pipefail
RUN_DIR="${1:?usage: doctor.sh RUN_DIR}"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
fail() { echo "doctor: FAIL $*"; exit 1; }
(cd "$ROOT" && scripts/link-node-modules.sh) || fail "node_modules is missing and cannot be linked"
[ -f "$RUN_DIR/server.pid" ] || fail "no server.pid in $RUN_DIR (not launched, or already cleaned up)"
PID="$(cat "$RUN_DIR/server.pid")"
PORT="$(cat "$RUN_DIR/server.port")"
URL="http://127.0.0.1:$PORT/"
kill -0 "$PID" 2>/dev/null || fail "server pid $PID is not running"
LISTENER="$(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)"
[ "$LISTENER" = "$PID" ] || fail "port $PORT is owned by pid '${LISTENER:-none}', not our pid $PID"
curl -fsS "$URL" | grep -q '<title>Treino</title>' || fail "$URL does not serve the app shell"
curl -fsS -o /dev/null "${URL}src/main.tsx" || fail "${URL}src/main.tsx does not transform (check $RUN_DIR/vite.log)"
echo "doctor: ok pid=$PID url=$URL head=$(git -C "$ROOT" rev-parse --short HEAD) dirty_files=$(git -C "$ROOT" status --porcelain | wc -l | tr -d ' ')"
