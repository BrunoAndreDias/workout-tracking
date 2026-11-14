#!/usr/bin/env bash
# Stops the server launch.sh started for RUN_DIR. Keeps every evidence file.
# Usage: cleanup.sh RUN_DIR
set -uo pipefail
RUN_DIR="${1:?usage: cleanup.sh RUN_DIR}"
[ -f "$RUN_DIR/server.pid" ] || { echo "cleanup: nothing to stop in $RUN_DIR"; exit 0; }
PID="$(cat "$RUN_DIR/server.pid")"
PORT="$(cat "$RUN_DIR/server.port")"
if kill -0 "$PID" 2>/dev/null; then
  CHILDREN="$(pgrep -P "$PID" || true)"
  kill "$PID" $CHILDREN 2>/dev/null
  for _ in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.25; done
  kill -0 "$PID" 2>/dev/null && kill -9 "$PID" $CHILDREN 2>/dev/null
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "cleanup: WARNING port $PORT still has a listener; it is not ours, left alone"
fi
rm -f "$RUN_DIR/server.pid" "$RUN_DIR/server.port"
echo "cleanup: stopped pid $PID; evidence kept in $RUN_DIR:"
ls -1 "$RUN_DIR"
