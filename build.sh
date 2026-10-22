#!/usr/bin/env bash
# Assemble the deployable site: app files plus data/ (falls back to template/ when data/ is absent).
set -euo pipefail
cd "$(dirname "$0")"
trash -s dist 2>/dev/null || true
mkdir -p dist
cp index.html style.css orbit.js dist/
cp -R template dist/template
[ -d data ] && cp -R data dist/data
echo "dist ready"
