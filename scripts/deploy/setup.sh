#!/usr/bin/env bash
# First-deploy setup for the invoices app, driven from 1Password.
#
#   scripts/deploy/setup.sh neon     Creates the Neon Free project in Frankfurt
#                                    and stores both database URLs in 1Password.
#   scripts/deploy/setup.sh vercel   Copies every production variable from
#                                    1Password into the linked Vercel project.
#   scripts/deploy/setup.sh check    Lists which 1Password fields are still empty.
#
# Every value lives in one 1Password item, so the password manager stays the
# record and each step can run again. Secrets travel through stdin, never
# command arguments, so they do not show in the process list.
set -euo pipefail

vault="${OP_VAULT:-Code}"
item="${OP_ITEM:-Hadronomy invoices production}"
root="$(cd "$(dirname "$0")/../.." && pwd)"

# Required for the app to start in production; the rest are optional.
required=(INVOICE_SECRET INVOICE_ATPROTO_KEYS INVOICE_ORIGIN DATABASE_URL DATABASE_URL_UNPOOLED)
mail=(RESEND_API_KEY INVOICE_MAIL_FROM)
cards=(STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY)
# Values that are not secret go to Vercel as plain config.
public=(INVOICE_ORIGIN INVOICE_MAIL_FROM STRIPE_PUBLISHABLE_KEY)

field() { op read "op://$vault/$item/$1" 2>/dev/null || true; }
is_public() { local name=$1; for p in "${public[@]}"; do [[ $p == "$name" ]] && return 0; done; return 1; }

check() {
  local missing=0
  for name in "${required[@]}" "${mail[@]}" "${cards[@]}"; do
    if [[ -n "$(field "$name")" ]]; then printf '  set    %s\n' "$name"
    else printf '  empty  %s\n' "$name"; missing=1; fi
  done
  return $missing
}

neon() {
  if [[ -n "$(field DATABASE_URL)" ]]; then
    echo "1Password already has DATABASE_URL; nothing to create." >&2
    return 0
  fi
  local neonctl=(bunx neonctl@latest)
  "${neonctl[@]}" me >/dev/null 2>&1 || "${neonctl[@]}" auth
  local project
  project=$("${neonctl[@]}" projects create --name hadronomy-invoices \
    --region-id aws-eu-central-1 --output json |
    python3 -c 'import json,sys; print(json.load(sys.stdin)["project"]["id"])')
  local direct pooled
  direct=$("${neonctl[@]}" connection-string --project-id "$project" --ssl require)
  pooled=$("${neonctl[@]}" connection-string --project-id "$project" --ssl require --pooled)
  op item edit "$item" --vault "$vault" \
    "DATABASE_URL[concealed]=$pooled" \
    "DATABASE_URL_UNPOOLED[concealed]=$direct" >/dev/null
  echo "Neon project $project created in Frankfurt; both URLs are in 1Password."
}

vercel() {
  local cli=(bunx vercel@latest --cwd "$root/apps/astro")
  "${cli[@]}" whoami >/dev/null 2>&1 || "${cli[@]}" login
  [[ -f "$root/apps/astro/.vercel/project.json" ]] || "${cli[@]}" link
  local missing=()
  for name in "${required[@]}"; do [[ -n "$(field "$name")" ]] || missing+=("$name"); done
  if ((${#missing[@]})); then
    echo "Fill these in 1Password first: ${missing[*]}" >&2
    return 1
  fi
  for name in "${required[@]}" "${mail[@]}" "${cards[@]}"; do
    local value
    value="$(field "$name")"
    if [[ -z "$value" ]]; then echo "skip   $name (empty)"; continue; fi
    local kind=--sensitive
    is_public "$name" && kind=--no-sensitive
    printf '%s' "$value" | "${cli[@]}" env add "$name" production --force "$kind" >/dev/null
    echo "set    $name"
  done
}

case "${1:-}" in
  neon) neon ;;
  vercel) vercel ;;
  check) check ;;
  *) sed -n '2,10p' "$0" >&2; exit 2 ;;
esac
