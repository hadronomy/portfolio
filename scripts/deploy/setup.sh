#!/usr/bin/env bash
# First-deploy setup for the invoices app, driven from 1Password.
#
#   scripts/deploy/setup.sh neon     Creates the Neon Free project in Frankfurt
#                                    and stores both database URLs in 1Password.
#   scripts/deploy/setup.sh vercel   Copies every production variable from
#                                    1Password into the linked Vercel project.
#   scripts/deploy/setup.sh payments plan|deploy [alchemy flags]
#                                    Plans or deploys the payments Worker with
#                                    its variables from 1Password.
#   scripts/deploy/setup.sh check    Lists which 1Password fields are still empty.
#
# STRIPE_MODE=test sends the sandbox keys, the STRIPE_TEST_* fields, to the
# web app and the Worker alike; the default is the live keys.
#
# Every value lives in one 1Password item, so the password manager stays the
# record and each step can run again. Secrets travel through stdin or the
# environment, never command arguments, so they stay out of the process list.
set -euo pipefail

vault="${OP_VAULT:-Code}"
item="${OP_ITEM:-Hadronomy invoices production}"
root="$(cd "$(dirname "$0")/../.." && pwd)"

# Required for the app to start in production; the rest are optional.
required=(INVOICE_SECRET INVOICE_ATPROTO_KEYS INVOICE_ORIGIN DATABASE_URL DATABASE_URL_UNPOOLED)
mail=(RESEND_API_KEY INVOICE_MAIL_FROM INVOICE_MAIL_RETRY_SECRET)
cards=(STRIPE_SECRET_KEY STRIPE_PUBLISHABLE_KEY)
# Values that are not secret go to Vercel as plain config.
public=(INVOICE_ORIGIN INVOICE_MAIL_FROM STRIPE_PUBLISHABLE_KEY)

field() { op read "op://$vault/$item/$1" 2>/dev/null || true; }
# The 1Password field that holds a Stripe variable in the chosen mode.
stripe_field() {
  if [[ ${STRIPE_MODE:-live} == test ]]; then echo "STRIPE_TEST_${1#STRIPE_}"; else echo "$1"; fi
}
value_of() { [[ $1 == STRIPE_* ]] && field "$(stripe_field "$1")" || field "$1"; }

# The web app and the Worker sign mail retries with one shared key. Made
# here when missing, and written through stdin like every other secret.
# A read that fails must not pass for an empty field, or this would add a
# second secret, so it decides from the whole item and stops if that fails.
retry_secret() {
  local json
  json="$(op item get "$item" --vault "$vault" --format json)"
  printf '%s' "$json" | python3 -c 'import json,sys
d=json.load(sys.stdin)
sys.exit(0 if any(f.get("label")=="INVOICE_MAIL_RETRY_SECRET" for f in d["fields"]) else 1)' &&
    return 0
  printf '%s' "$json" | python3 -c 'import json,secrets,sys
d=json.load(sys.stdin)
d["fields"].append({"label":"INVOICE_MAIL_RETRY_SECRET","type":"CONCEALED","value":secrets.token_urlsafe(48)})
json.dump(d,sys.stdout)' |
    op item edit "$item" --vault "$vault" >/dev/null
  echo "made   INVOICE_MAIL_RETRY_SECRET"
}
is_public() { local name=$1; for p in "${public[@]}"; do [[ $p == "$name" ]] && return 0; done; return 1; }

check() {
  local missing=0
  for name in "${required[@]}" "${mail[@]}" "${cards[@]}"; do
    local shown=$name
    [[ $name == STRIPE_* ]] && shown=$(stripe_field "$name")
    if [[ -n "$(value_of "$name")" ]]; then printf '  set    %s\n' "$shown"
    else printf '  empty  %s\n' "$shown"; missing=1; fi
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
  retry_secret
  for name in "${required[@]}" "${mail[@]}" "${cards[@]}"; do
    local value
    value="$(value_of "$name")"
    if [[ -z "$value" ]]; then echo "skip   $name (empty)"; continue; fi
    local kind=--sensitive
    is_public "$name" && kind=--no-sensitive
    printf '%s' "$value" | "${cli[@]}" env add "$name" production --force "$kind" >/dev/null
    echo "set    $name"
  done
}

payments() {
  local action=${1:-plan}
  shift || true
  [[ $action == plan || $action == deploy ]] || { echo "payments takes plan or deploy" >&2; return 2; }
  retry_secret
  local key
  key="$(value_of STRIPE_SECRET_KEY)"
  [[ -n $key ]] || { echo "Fill $(stripe_field STRIPE_SECRET_KEY) in 1Password first." >&2; return 1; }
  # Hyperdrive pools connections itself, so the Worker gets the direct URL.
  # One Stripe key both runs the Worker and creates its webhook endpoint.
  DATABASE_URL="$(field DATABASE_URL_UNPOOLED)" \
    INVOICE_ORIGIN="$(field INVOICE_ORIGIN)" \
    INVOICE_MAIL_RETRY_SECRET="$(field INVOICE_MAIL_RETRY_SECRET)" \
    STRIPE_SECRET_KEY="$key" STRIPE_API_KEY="$key" \
    bun run --cwd "$root/apps/payments" "$action" "$@"
}

# 1Password may ask to be unlocked; stop here rather than read empty values.
op vault get "$vault" >/dev/null || { echo "Unlock 1Password, then run this again." >&2; exit 1; }

case "${1:-}" in
  neon) neon ;;
  vercel) vercel ;;
  payments) shift; payments "$@" ;;
  check) check ;;
  *) sed -n '2,16p' "$0" >&2; exit 2 ;;
esac
