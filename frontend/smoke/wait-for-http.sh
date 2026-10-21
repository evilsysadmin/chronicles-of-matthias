#!/usr/bin/env bash
# Sourced by Chromium E2E steps. Fail quickly with server logs instead of
# hanging until the full GitHub Actions job timeout if Vite never starts.
wait_for_http() {
  local url="$1" server_pid="$2" log_file="$3" label="$4"
  local attempt

  for attempt in {1..40}; do
    if curl --silent --fail --output /dev/null --connect-timeout 1 --max-time 1 "$url"; then
      echo "SMOKE_SERVER_READY label=$label attempts=$attempt"
      return 0
    fi
    if ! kill -0 "$server_pid" 2>/dev/null; then
      echo "::error title=Chronicles smoke server exited::$label exited before becoming ready ($url)"
      if [[ -f "$log_file" ]]; then tail -n 80 "$log_file"; fi
      return 1
    fi
    sleep 0.5
  done

  echo "::error title=Chronicles smoke server timeout::$label did not answer $url within the bounded startup window"
  if [[ -f "$log_file" ]]; then tail -n 80 "$log_file"; fi
  return 1
}
