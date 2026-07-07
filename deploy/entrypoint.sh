#!/bin/sh
set -eu

su-exec app:app node /app/backend/server.js &
backend_pid=$!

nginx -g 'daemon off;' &
nginx_pid=$!

stop() {
  kill "$backend_pid" "$nginx_pid" 2>/dev/null || true
}

trap stop INT TERM

while true; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    wait "$backend_pid"
    status=$?
    stop
    exit "$status"
  fi

  if ! kill -0 "$nginx_pid" 2>/dev/null; then
    wait "$nginx_pid"
    status=$?
    stop
    exit "$status"
  fi

  sleep 1
done
