#!/usr/bin/env bash
# Deploy Edge Functions, pinned to this project's ref.
#
# Exists because `supabase functions deploy` falls back to an interactive
# project picker when the CLI link is missing — which once put this project's
# function into a different Supabase project entirely. Passing --project-ref
# explicitly means that can never happen again, linked or not.

set -euo pipefail

PROJECT_REF="slvmgcrwastqnlgqtevm"  # 2026 Koda Iron Games Team Finder

cd "$(dirname "$0")/.."

echo "Deploying to $PROJECT_REF …"
for fn in supabase/functions/*/; do
  name="$(basename "$fn")"
  [[ "$name" == _* ]] && continue   # _shared etc. are libraries, not functions
  echo "  → $name"
  supabase functions deploy "$name" --project-ref "$PROJECT_REF" --no-verify-jwt
done

echo
echo "Deployed. Functions now live on $PROJECT_REF:"
supabase functions list --project-ref "$PROJECT_REF"
