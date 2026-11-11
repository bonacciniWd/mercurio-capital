#!/usr/bin/env bash
set -euo pipefail

# The Vercel project Root Directory is `app`, relative to the repository root.
# Always launch the CLI from the repository root so it does not resolve `app/app`.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

exec vercel deploy --prod --yes
