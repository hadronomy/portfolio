# Deploy and recover

## Architecture

1. GitHub holds the public repository and runs read-only CI on pull requests and `main`.
2. Vercel builds Astro and Start with Node 24, then serves them from Frankfurt (`fra1`).
3. Neon Free in Frankfurt stores invoices, PDFs, evidence, auth records, and both migration ledgers.
4. The Cloudflare payments Worker receives Stripe webhooks, consumes Queues, and reconciles through Hyperdrive.
5. GitHub encrypts nightly database snapshots with age and stores them in private R2 Standard storage.

## Cost and hosting limits

The remote is `github.com/hadronomy/portfolio`. Its visibility was public on 2026-10-12.
Standard GitHub runners are free for public repositories. Keep the Actions cache limit at 10 GB.
No workflow uploads database data as an Actions artifact.
[GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

**Hosting gap:** Vercel Hobby permits personal, non-commercial use only.
Business invoicing does not meet that rule.
This runbook implements the requested Vercel path, but it does not establish permission to use Hobby for invoices.
Resolve that gap before production.
A free Node host such as Render Free is a possible alternative, with sleep and memory limits.
A host change needs separate runtime and origin checks.
[Vercel Hobby](https://vercel.com/docs/plans/hobby), [Render Free](https://render.com/docs/free).

Stripe charges fees for real payments. No change here enables a paid hosting plan or purchases a service.
Keep Stripe in sandbox mode until the owner accepts the payment fees and completes provider checks.

Neon Free includes 1 GB storage, 100 CU-hours, 5 GB monthly egress, and about six hours of restore history.
The application uses the pooled URL. Migrations, Hyperdrive, and dumps use the direct URL.
[Neon plans](https://neon.com/docs/introduction/plans), [pooling](https://neon.com/docs/connect/connection-pooling).

## Environment variables

Use production-only secrets for production. Preview builds must never receive the production database URLs or signing keys.
Use a separate Neon Free project and separate keys for preview invoice tests.
A preview without these variables can build, but its invoice pages cannot serve production records.

### Vercel

Create variables in Project → Settings → Environment Variables.
Select **Production** for production values.

| Variable                                                     | Value and creation                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                   | `production`. Vercel normally sets this for the production build.                                                            |
| `DATABASE_URL`                                               | Neon Connect dialog → connection pooling enabled. Copy the URL with TLS.                                                     |
| `DATABASE_URL_UNPOOLED`                                      | Same Neon branch and database, with connection pooling disabled. Use `sslmode=require`. Only the build script uses this URL. |
| `INVOICE_SECRET`                                             | Run `openssl rand -base64 32`. Store the result in 1Password and Vercel. All instances need the same value.                  |
| `INVOICE_ATPROTO_KEYS`                                       | Run `bun run --cwd apps/start atproto-key`. Store the JSON array of private ES256 JWKs. Newest key comes first.              |
| `INVOICE_ORIGIN`                                             | `https://hadronomy.com`. This origin controls auth callbacks, MCP, and customer links.                                       |
| `RESEND_API_KEY`                                             | Resend → API Keys → sending access for the verified transactional domain. Required for customer codes and quote mail.        |
| `INVOICE_MAIL_FROM`                                          | An address on the verified Resend domain, such as `invoices@notifications.hadronomy.com`.                                    |
| `STRIPE_SECRET_KEY`                                          | Stripe sandbox secret key first. Use the same account and mode as the Worker. Required for cards.                            |
| `STRIPE_PUBLISHABLE_KEY`                                     | Matching Stripe `pk_test_…` or `pk_live_…` key. It is public.                                                                |
| `INVOICE_GEOCODER_URL`                                       | Optional Photon origin. Default: `https://photon.komoot.io`.                                                                 |
| `CERTIFICATE_P12`                                            | Optional CV signing certificate and private key, exported as PKCS#12 and base64-encoded. This does not sign invoice PDFs.    |
| `CERTIFICATE_PASSWORD`                                       | Password for that PKCS#12 export. Omit with an unencrypted export.                                                           |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_DEPLOYMENT_ID` | Vercel system variables. Enable **Automatically expose System Environment Variables**. Do not enter these manually.          |
| `VERCEL_SKEW_PROTECTION_ENABLED`                             | Let Vercel supply it if applicable. It changes adapter output.                                                               |

`GITHUB_TOKEN` has no application consumer. Its current empty declaration needs no issued token.
`INVOICE_DATA_DIRECTORY` is a development path. It cannot provide durable Vercel storage.
Leave `BETTER_AUTH_TRUSTED_ORIGINS` and `BETTER_AUTH_SECRETS` unset unless a separate change requires them.
Do not set unrelated better-auth URL or secret overrides. `INVOICE_ORIGIN` and `INVOICE_SECRET` configure this application.
Node listener variables (`HOST`, `PORT`, `SERVER_CERT_PATH`, `SERVER_KEY_PATH`, `ASTRO_NODE_*`) do not configure Vercel functions.

### Payments Worker and Alchemy

Supply deployment variables through a private environment file or `op run`.
Do not commit that file.
The deploy script runs Alchemy on Node and fixes the stage to `production`.
The installed `alchemy@2.0.0-beta.80` CLI supports `--stage production`.
The production `plan`, `deploy`, and `destroy` scripts all use this stage.

| Variable or binding           | Value and creation                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`       | Cloudflare dashboard → account ID.                                                                                                                 |
| `CLOUDFLARE_API_TOKEN`        | Create an account-scoped token for Workers Scripts, Queues, Hyperdrive, Durable Objects, and Secrets Store. Alchemy also creates its state Worker. |
| `DATABASE_URL`                | Direct Neon URL for the same production database. Hyperdrive provides its own pooling.                                                             |
| `STRIPE_SECRET_KEY`           | Same Stripe runtime key as Vercel. Alchemy binds it as a Worker secret.                                                                            |
| `STRIPE_API_KEY`              | Stripe key with webhook endpoint write access. Use the same account and mode as the runtime key.                                                   |
| `STRIPE_WEBHOOK_SECRET`       | Alchemy creates the endpoint and binds its secret. Local `stripe listen` produces a different secret.                                              |
| Queue and Hyperdrive bindings | Alchemy creates and binds them. Do not copy IDs into application variables.                                                                        |
| `ALCHEMY_STAGE`               | No manual value is necessary. `--stage production` takes precedence.                                                                               |
| `ALCHEMY_PROFILE`             | Optional stored credential profile. Omit when environment credentials provide access.                                                              |

The mail retry workstream can add `RESEND_API_KEY` and `INVOICE_MAIL_FROM` to the Worker.
Supply the same sender and sending key as Vercel when that schedule ships.
The final Worker declaration decides which secrets it reads.

Leave Cloudflare global API key variables and `STRIPE_API_BASE_URL` unset.
Let Alchemy set `ALCHEMY_DEV` and `ALCHEMY_PHASE`.
The hosted Alchemy state includes secrets. Preserve its state Worker, Durable Object, and encryption secret.

### GitHub Actions

Create the `backups` and `restore-drill` environments in Repository → Settings → Environments.
Restrict both environments to `main`.
Require the owner’s review for `restore-drill`, but leave nightly `backups` unattended.
Create secrets in each environment. The CI workflow receives none of them.

| Secret                  | Environment          | Creation                                                                                                                                    |
| ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL_UNPOOLED` | `backups`            | Direct Neon connection URL with TLS. The role needs read access to invoices, auth, and Drizzle ledgers.                                     |
| `R2_ENDPOINT`           | Both                 | R2 S3 endpoint from Cloudflare. Usually `https://<account-id>.r2.cloudflarestorage.com`. Use the EU endpoint for an EU jurisdiction bucket. |
| `R2_BUCKET`             | Both                 | Name of a private R2 Standard bucket reserved for these backups.                                                                            |
| `R2_ACCESS_KEY_ID`      | Both                 | Create an R2 token scoped to this bucket. Use Object Read & Write for backups and Object Read Only for drills.                              |
| `R2_SECRET_ACCESS_KEY`  | Both                 | Matching R2 S3 secret. GitHub maps it to `AWS_SECRET_ACCESS_KEY`.                                                                           |
| `BACKUP_AGE_IDENTITY`   | `restore-drill` only | Temporary private identity from the 1Password Code item **Portfolio database backup age**. Delete this GitHub secret after each drill.      |

Set repository variable `POSTGRES_MAJOR` to Neon’s server major.
Run `SHOW server_version` in the Neon SQL editor to obtain it.
The default is `17`. Change it if Neon uses another major.
The workflows install that major from PostgreSQL’s signed repository.
The scripts also compare `pg_dump` with the actual server before any dump or restore.
[PostgreSQL repository](https://wiki.postgresql.org/wiki/Apt), [R2 credentials](https://developers.cloudflare.com/r2/api/tokens/).

No `VERCEL_TOKEN`, Vercel project ID, or deploy token is needed in GitHub.
Vercel’s git integration remains the single production deploy path.

## Schema ordering

Set Vercel’s build command to `cd ../.. && bun run build:vercel` when its Root Directory is `apps/astro`.
Enable access to source files outside the Root Directory.
Set the install command to `cd ../.. && bun install --frozen-lockfile`.
Use Node 24 and Bun 1.3.2. Set the production branch to `main`.
Configure the function region as Frankfurt (`fra1`).
Do not use an ordinary `bun run build` as the production command.

The wrapper refuses missing system variables and mismatched pooled and direct database URLs.
It builds first. Then, only when `VERCEL_ENV=production`, it runs root `bun run db:migrate` against the direct URL.
That command applies both invoice and auth migrations.
The wrapper holds a PostgreSQL advisory lock until both commands finish.
A failed build or migration prevents the new deployment from becoming ready.
Migrations run outside Turbo, so a cache hit cannot skip them.
An application process never migrates hosted Postgres.
[Vercel build commands](https://vercel.com/docs/builds/configure-a-build), [system variables](https://vercel.com/docs/environment-variables/system-environment-variables).

GitHub’s alternative is migration followed by `vercel deploy --prebuilt --prod`.
That path requires a deploy token, pulled production configuration, and disabled production git deploys.
The build wrapper provides the required ordering with fewer operations and keeps one production deploy per push.
[Vercel prebuilt deploys](https://vercel.com/docs/cli/deploy), [git controls](https://vercel.com/docs/project-configuration/git-configuration).

**Every production migration must be additive-safe.** Old code and the Worker must keep working against the new schema during the switch.
Do not delete or rename used tables or columns, or tighten constraints that old code cannot satisfy.
Do not reverse migrations for a code rollback.
Generate migrations from `tables.ts`. Never edit a migration that ran.
Require CI before merging. Vercel does not wait for this workflow by default.
Avoid manual promotion of an old preview artifact. It did not run the production migration gate.

## First deploy

1. Resolve the Vercel Hobby commercial-use gap.
2. Create a Neon Free project in Frankfurt.
3. Create the pooled and direct connection URLs for the same database.
4. Store the invoice secret, AT Protocol keys, and provider keys in 1Password.
5. Verify the Resend transactional domain with its current SPF and DKIM records.
6. Add DMARC and select Ireland for sending.
7. Create the private R2 Standard backup bucket and scoped S3 tokens.
8. Preserve an offline copy of the age identity from 1Password.
9. Create GitHub environments, secrets, and `POSTGRES_MAJOR`.
10. Enable Actions and require the CI check before merging.
11. Configure Vercel’s production variables, build wrapper, Node version, and Frankfurt region.
12. Connect the Git repository with `main` as the production branch.
13. Complete the first Vercel build and inspect the migration completion message.
14. Run the nightly backup workflow manually.
15. Run the restore drill with the temporary private identity.
16. Delete `BACKUP_AGE_IDENTITY` from GitHub after the drill.
17. Run `bun run --cwd apps/payments plan` with the production deployment variables.
18. Run `bun run --cwd apps/payments deploy` with those same variables.
19. Inspect the Worker URL and the Stripe endpoint in Alchemy’s output.
20. Exercise owner OAuth, customer codes, quote mail, and MCP through the public HTTPS origin.
21. Exercise a Stripe sandbox payment, refund, duplicate webhook, retry, and reconciliation.
22. Inspect the failed-settlement queue and provider limits before enabling real invoices or cards.

## Routine deploy and rollback

Run `bun install --frozen-lockfile` and `bun run ci` before merging.
Review generated migrations for additive safety.
Merge to `main` only after CI passes.
Vercel builds, migrates, and releases once for that push.
After a Worker change, run its production `plan` and `deploy` scripts.
Deploy additive database changes through Vercel before a Worker that needs them.
Inspect invoice routes, sign-in, PDF output, and payment reconciliation after the switch.

For a code rollback, select Vercel’s previous production deployment.
Keep the current database schema.
For a Worker rollback, deploy the previous known-good source with `--stage production`.
Do not run `destroy` for rollback. It deletes managed resources.
If a migration fails, keep the previous code active and investigate the failed migration locally.
A successful invoice migration can remain even if the auth migration fails.
Additive safety also covers this partial state.

## Backups and retention

The nightly workflow runs at 02:23 UTC.
GitHub schedules can run late. GitHub also disables schedules in inactive public repositories after 60 days.
Inspect the last successful run every week and enable it again if necessary.
The recovery point can be about 24 hours old, plus scheduling delay.
Neon’s short history covers some recent failures, but it cannot replace these archives.

Each encrypted archive contains a custom-format dump and a manifest.
The dump includes `invoices`, `auth`, and `drizzle`, including PDFs and acceptance evidence.
The manifest contains table counts, column definitions, and both migration ledgers from the same exported PostgreSQL snapshot.
Compression runs before age encryption. Plaintext temporary files use owner-only permissions and are deleted at exit.
Subprocess errors stay private because PostgreSQL can include row data in errors.

The script keeps 30 daily copies and the first successful snapshot of each month.
Monthly copies never expire automatically.
Keep at least seven years, and keep longer when a legal hold or tax rule applies.
Six years runs from the last accounting entry. Four years is not a universal deletion date.
[Commercial Code, article 30](https://www.boe.es/buscar/act.php?id=BOE-A-1885-6627), [LGT, articles 66–68](https://www.boe.es/buscar/act.php?id=BOE-A-2003-23186).

The upload guard reserves 1 GB from R2’s 10 GB allowance.
Keep all other R2 storage under the reserved 1 GB.
The guard measures this bucket, not every bucket in the account.
It counts every object in the bucket and projects 30 daily plus 85 monthly copies.
A full encrypted snapshot must stay under about 78 MB for that projection.
It also reserves Neon egress by refusing daily dumps when database size exceeds about 125 MB.
These are conservative limits. Other application traffic also uses Neon egress.
Keep this R2 bucket private and use Standard storage. Infrequent Access has no free allowance.
[R2 pricing](https://developers.cloudflare.com/r2/pricing/).

When a guard fails, the workflow fails before upload. Existing backups remain intact.
Copy monthly archives to two owner-controlled offline storage devices before freeing bucket space.
Check decryption and a restore from both copies before deleting any R2 monthly archive.
Keep the original creation dates and a record of the offline copies.
Retained records also remain in the database and newer snapshots.
A 1 GB Neon database cannot support seven years of full snapshots inside 10 GB of R2.
Free storage needs a limited dataset and offline archives as it grows.
Do not enable paid overages to bypass the guard.

## Restore

CI also runs `node scripts/deploy/restore.integration.mjs` against a local PostgreSQL service.
That test uses temporary age keys and a local S3 fixture. It never uses provider secrets.

The manual workflow restores the latest archive into a fresh PostgreSQL service container.
It compares every table count, column definition, and migration ledger with the encrypted manifest.
Then it runs root `bun run db:check` against the repository’s migration histories.
That command checks source migration consistency. It does not inspect the hosted database.
The manifest comparison checks the restored database.
Logs contain table names and row counts, never record values.
No production database URL is supplied to the restore workflow.

For a local drill, install Node 24, Bun 1.3.2, age, AWS CLI, and matching PostgreSQL client tools.
Create an empty local database named `portfolio_restore`.
A Docker example follows. Match the image major to the backup.

```sh
docker run --rm --name portfolio-restore -d \
  -e POSTGRES_USER=restore -e POSTGRES_PASSWORD=scratch-only \
  -e POSTGRES_DB=portfolio_restore -p 127.0.0.1:55432:5432 postgres:17
export RESTORE_DATABASE_URL='postgres://restore:scratch-only@127.0.0.1:55432/portfolio_restore?sslmode=disable'
export AGE_IDENTITY_FILE='/absolute/private/path/age-identity'
node scripts/deploy/restore-drill.mjs
docker stop portfolio-restore
```

Supply R2 variables from the table. Alternatively, set `BACKUP_FILE` to a downloaded encrypted archive.
Retrieve the identity from `op://Code/Portfolio database backup age/private identity` into a file with mode `0600`.
Delete the temporary identity after the drill.
Run a drill monthly and after a PostgreSQL major upgrade or key rotation.

For disaster recovery, stop new writes and take a final backup if possible.
Restore into the scratch database first.
Compare the manifest and inspect the recovery point.
Create a new Neon Free database, then restore the checked dump with the matching `pg_restore` client.
Apply newer additive migrations before any application uses that database.
Update both Vercel URLs and the Worker’s direct URL together.
Deploy the Worker and web app, then repeat the provider checks.
Retain the old database until the owner approves the restored records.

## Key rotation

### `INVOICE_SECRET`

Preserve the current secret in 1Password with its dates.
Take a backup before rotation.
Generate 32 new bytes and replace the Vercel production value.
Redeploy all instances. Existing sessions and pending OAuth state can become invalid.
Sign in again and reconnect agents.
Keep the old secret with historical backups because it seals OAuth data and protects signed requests.
Do not set `BETTER_AUTH_SECRETS` as an untested workaround.

### `INVOICE_ATPROTO_KEYS`

Generate a new key with `bun run --cwd apps/start atproto-key`.
Prepend it to the private JWK array and retain the previous keys during the transition.
Redeploy, then inspect `/invoices/auth/atproto/jwks.json` for the public keys.
Complete owner sign-in before removing a previous key.
Keep previous keys until all pending sign-in flows expire.
For a compromised key, remove it immediately and repeat sign-in.

### Stripe

Create a replacement key in the same account and mode.
Update the Vercel runtime key, Worker runtime key, and Alchemy endpoint key as applicable.
Deploy both services, then exercise a sandbox settlement and refund.
Revoke the previous key after the checks pass.
Rotate the webhook secret through Stripe and update the Alchemy-managed endpoint and binding together.
The current verifier accepts one secret, so an overlap period needs a separate reviewed change.
Rely on Stripe retries and reconciliation during a short controlled switch.
Never use the local `stripe listen` secret for production.

### Resend and backup keys

Create a replacement Resend sending key for the same verified domain.
Update Vercel and any Worker mail retry binding, then redeploy.
Exercise a customer code and a quote email before revoking the previous key.
Keep the sender domain and authentication records unchanged during API key rotation.

For age rotation, create a new private identity in 1Password and preserve an offline copy.
Commit its public recipient in `backup-recipients.txt`.
Keep every old identity until all archives encrypted for it expire or are re-encrypted and checked.
Run a backup and restore drill before retiring a key.

## Workers Free checks

| Resource      | Free support and limit                                                           | Stack use                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Worker        | 100,000 requests/day, 10 ms CPU/event, 128 MB memory, five account cron triggers | Webhook, queue consumer, and one reconciliation trigger. Reserve capacity for the mail retry trigger.                                |
| Two Queues    | 10,000 operations/day, 24-hour retention                                         | Settlement and failed-settlement queues. A delivery normally uses three operations. Retries use more.                                |
| Hyperdrive    | 100,000 database queries/day                                                     | One connection configuration with query caching disabled.                                                                            |
| Alchemy state | SQLite Durable Objects are available on Free                                     | Alchemy stores shared encrypted state in its state Worker and Durable Object. Secrets Store holds its bearer and encryption secrets. |

No listed resource requires Workers Paid.
Published resource support does not prove this workload fits the CPU or memory limits.
Measure real webhook, queue, and cron events before enabling cards.
With 96 reconciliation ticks daily, 30 constantly unsettled collections alone consume about 8,640 queue operations daily.
Inspect the failed-settlement queue daily. Free Queues deletes messages after 24 hours, including dead letters.
The durable invoice state and recurring reconciliation remain the recovery source.

If this Worker exceeds CPU limits, the smallest free operational alternative is a scheduled Node job on GitHub’s standard runner.
Moving settlement there requires a separate reviewed worker change and less predictable scheduling.
Do not upgrade the account to Workers Paid to hide a failing free-plan check.
[Worker limits](https://developers.cloudflare.com/workers/platform/limits/), [Queue pricing](https://developers.cloudflare.com/queues/platform/pricing/), [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Secrets Store](https://developers.cloudflare.com/secrets-store/).
