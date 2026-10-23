#!/usr/bin/env bash
# Working directory: frontend/ (npm ci already ran; Playwright version is locked).
set -euo pipefail
npx playwright install chromium

# Hosted runners often already have the libraries installed. Running
# 'playwright install --with-deps' blindly invokes APT on every SHA, even
# when the exact browser version was just restored from GitHub cache.
set +e
node smoke/chromium-host-probe.mjs
probe_status=$?
set -e

case "$probe_status" in
  0)
    echo "Chromium ready; no APT changes needed."
    ;;
  42)
    echo "Chromium reports missing host libraries; installing official Playwright dependencies."
    npx playwright install-deps chromium
    node smoke/chromium-host-probe.mjs
    ;;
  *)
    echo "::error::Chromium failed for a reason other than missing host dependencies (exit $probe_status)"
    exit "$probe_status"
    ;;
esac
