#!/usr/bin/env bash
set -euo pipefail
major="${POSTGRES_MAJOR:?Set POSTGRES_MAJOR to the Neon server major.}"
[[ "$major" =~ ^(1[6-9]|[2-9][0-9])$ ]] || { echo 'Unsupported PostgreSQL major.' >&2; exit 1; }
sudo install -d /usr/share/postgresql-common/pgdg
curl --fail --silent --show-error https://www.postgresql.org/media/keys/ACCC4CF8.asc |
  sudo tee /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc >/dev/null
fingerprint="$(gpg --show-keys --with-colons /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc | awk -F: '$1 == "fpr" { print $10; exit }')"
[[ "$fingerprint" == B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8 ]] || { echo 'Unexpected PostgreSQL repository key.' >&2; exit 1; }
. /etc/os-release
printf 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt %s-pgdg main\n' "$VERSION_CODENAME" |
  sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
sudo apt-get update -qq
sudo apt-get install --no-install-recommends -y "postgresql-client-$major" age
if ! command -v aws >/dev/null; then
  sudo apt-get install --no-install-recommends -y awscli
fi
printf '/usr/lib/postgresql/%s/bin\n' "$major" >> "$GITHUB_PATH"
