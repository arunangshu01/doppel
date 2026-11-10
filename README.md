# doppel

<img src="frontend/public/logo.svg" alt="doppel paired-d logo" width="64" height="64" />

**Your backend stand-in.**

A schema-driven mock REST API generator with realistic seeded data, resource relationships, and an interactive playground. Built with FastAPI, React, and Faker.

## About

doppel turns a JSON schema into a working mock REST API, so you can build and test applications before the real backend is ready. Define resources, field types, and relationships, then generate reproducible data using a fixed seed. Explore responses in the React workbench or connect an application directly to the generated endpoints.

Python 3.12 + FastAPI, React + Vite, and Faker. Local development needs no database, cloud account, or credentials. The deployment configuration targets Firebase Hosting and Cloud Run in a **new, dedicated doppel GCP project**.

## Who is it for?

| Audience | How doppel helps |
| --- | --- |
| Frontend developers | Build interfaces and integrate API calls without waiting for backend endpoints. |
| Full-stack developers | Prototype data models and application flows before implementing persistence and business logic. |
| QA and test engineers | Recreate datasets for testing pagination, filtering, sorting, and relationships. |
| Product designers and prototyping teams | Populate interactive prototypes with realistic data instead of static placeholders. |
| Students and educators | Practice REST integration and resource relationships without setting up a database. |
| Hackathon teams | Quickly create a usable API for demos and proofs of concept. |

## Features and access modes

- Seeded UUID, person, email, date, datetime, money, integer, float, boolean, enum, sentence, and word generators.
- Foreign-key references, pagination, exact-match filtering, sorting, and per-dataset OpenAPI docs.
- Retail starter template: 5 stores, 30 SKUs, and 100 linked transactions.
- Resource navigation, Table/JSON response views, JSON formatting, cURL copying, and schema downloads.
- Dark, Light, and System themes with a responsive layout.

| Mode | Access | Behavior |
| --- | --- | --- |
| Public demo | Anonymous reads | Retail data is available immediately on startup. Visitors cannot replace it through normal generation. |
| Personal playground | Anonymous, unlisted URL | Generating a schema creates an isolated dataset. Subsequent generation in the same page updates that playground without changing its URL. |
| Admin publishing | Bearer token | Explicitly replaces the shared demo for all visitors. Requires confirmation in the UI. |

All data is **in memory, not durable**. Playground URLs are unlisted access links, not authenticated private workspaces. Anyone with a URL can read its schema/data and replace its dataset. Do not enter sensitive data. Playgrounds expire after 30 minutes from creation; updates do not extend the deadline. They may disappear sooner on restart, scale-to-zero, deployment, or revision changes. Download your schema so you can recreate them. Admin-published demo changes also reset to retail on restart.

## GitHub repository details

Suggested About description:

> A schema-driven mock REST API generator with realistic seeded data, resource relationships, and an interactive playground. Built with FastAPI, React, and Faker.

Suggested topics: `mock-api`, `fake-data`, `rest-api`, `data-generator`, `faker`, `fastapi`, `react`, `prototyping`, `developer-tools`, `openapi`.

Local metadata does not update GitHub's About description or topics automatically.

## Run locally

Prerequisites: Python 3.12 and Node.js 22 with npm. From the repository root:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m app.main
```

In another terminal, from the repository root:

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Open <http://localhost:5173>. The local API is at <http://127.0.0.1:8000/doppel/api>, with docs at <http://127.0.0.1:8000/doppel/api/docs> and OpenAPI at <http://127.0.0.1:8000/doppel/api/openapi.json>. These replace the original unprefixed endpoints. Vite proxies `/doppel/api` to the local backend, matching the production same-origin architecture.

### Playground workflow

1. The UI opens the public demo and previews its resources without creating a playground.
2. Edit the JSON or use **Load retail template**. **Format JSON** only formats the editor.
3. Set the seed and counts, then select **Generate API**. This creates your own playground, not a replacement for the public demo.
4. Select a resource, inspect its first five rows in **Table** or **JSON**, use **Copy cURL**, or open **API docs** for the currently selected dataset.
5. Use **Public demo** and **My playground** to switch previews. Editor changes do not affect a published dataset until generation succeeds.
6. Use **Download schema** before leaving or sharing the endpoint. Reloading the page returns to the public demo; playground URLs are not automatically restored from browser storage.
7. For admin publishing, open **Admin publishing**, enter the token, select **Publish shared demo**, and confirm replacement. The token is never included in the frontend build or saved in browser storage. It is cleared on submission, panel close, or **Clear token**. Missing backend configuration disables admin publishing; it does not disable visitor generation.

An expired playground returns 404. The UI clears the expired session when it receives that response; select Generate API again to create a replacement. Clipboard access requires browser support in a secure context such as localhost or HTTPS.

### Connect an application

The startup retail API can be queried from JavaScript:

```javascript
const response = await fetch('/doppel/api/transactions?limit=10&sort=amount&order=desc');
if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
const { data, total } = await response.json();
console.log(data, total);
```

The relative URL works on doppel Hosting or through the Vite proxy. In another application, use the full backend/Hosting origin and the base path returned when creating a playground. Cross-origin browser clients must be on the backend `CORS_ORIGINS` allowlist. CORS is not authentication; non-browser clients can still access public endpoints.

### Appearance and logo

The logo uses two paired lowercase `d` forms to represent a stand-in for a real backend. The mint SVG is shared by the header, footer, favicon, and README: [`frontend/public/logo.svg`](frontend/public/logo.svg).

The **Color theme** selector supports Dark, Light, and System. System follows OS changes. Preferences are saved under `doppel-theme` in browser local storage when available and applied early during page loading. This is not a cross-device setting.

## Schema format

```json
{
  "seed": 42,
  "resources": {
    "users": {
      "count": 10,
      "fields": {
        "id": "uuid",
        "name": "person",
        "email": "email",
        "active": "bool",
        "role": { "type": "enum", "values": ["customer", "staff"] }
      }
    },
    "orders": {
      "count": 30,
      "fields": {
        "id": "uuid",
        "user_id": "ref(users.id)",
        "amount": "money",
        "created": "datetime"
      }
    }
  }
}
```

Every resource requires a UUID `id`. `count` defaults to 20 and `seed` to 42. Types support shorthand strings or objects such as `{"type":"person"}`. References also support `{"type":"ref","target":"users.id"}`.

| Type | Value |
| --- | --- |
| `uuid` | Seeded UUID string |
| `person` | Full name |
| `email` | Email address |
| `date` | ISO date between 2020-01-01 and 2025-01-01 |
| `datetime` | ISO datetime in the same fixed interval, without timezone |
| `money` | Non-negative number in hundredths, up to 10000 |
| `int` | Integer from 0 to 10000 |
| `float` | Positive number with up to 3 integer and 4 decimal digits |
| `bool` | JSON boolean |
| `enum` | One of the required, non-empty string values; each string is at most 128 characters |
| `sentence` | Short sentence |
| `word` | Word |
| `ref(resource.field)` | A value from the target field |

The same schema and seed reproduce data with the same dependency versions. Fixed date bounds avoid dependence on the current clock. Forward, self, and mutual resource references work when each reference chain ultimately resolves to a concrete field. Transaction amounts are independent synthetic values, not calculated SKU totals.

### Limits

- At most 20 resources, 1000 rows/resource, 50 fields/resource, and 100000 cells/schema.
- Visitor playgrounds are additionally limited to 20000 cells each.
- Each process holds at most 20 visitor playgrounds and 200000 visitor cells total, separate from the shared demo.
- Generation is serialized off the event loop and limited to 12 attempts/minute per process across visitor generation and authorized admin publishing. Capacity checks can reject work before consuming this budget.
- Generation rate overflow returns 429 with Retry-After. Full playground capacity returns 503; expired or unknown IDs return 404. Expired entries are pruned lazily on playground operations, without a background task keeping Cloud Run active.
- POST/PUT request bodies are capped at 128 KiB, including streamed bodies, before JSON parsing.
- Resource/field names start with a lowercase letter, use lowercase letters, digits, and underscores, and have at most 48 characters.
- Reserved resources: `api`, `docs`, `redoc`, `openapi`, `health`, `schema`, `templates`, `playgrounds`, `demo`. Reserved fields: `page`, `limit`, `sort`, `order`.

These per-process safeguards bound retained data and generation work. They are not durable distributed quotas, per-user authentication, comprehensive abuse protection, or a spending cap. An attacker can still exhaust public capacity or drive request costs. Review usage before promoting the public URL widely.

## REST API

All API routes use `/doppel/api`. Firebase forwards this prefix unchanged to Cloud Run.

| Endpoint | Behavior |
| --- | --- |
| `GET /doppel/api/health` | `{"status":"ok"}` |
| `GET /doppel/api/demo` | Shared demo manifest, base path, and schema |
| `GET /doppel/api/schema` | Current shared demo schema |
| `GET /doppel/api/templates/retail` | Built-in starter schema |
| `POST /doppel/api/playgrounds` | Create an isolated playground; returns 201 with `id`, `base_path`, `expires_at`, seed, and resource endpoints |
| `GET /doppel/api/playgrounds/{id}` | Playground manifest |
| `GET /doppel/api/playgrounds/{id}/schema` | Playground schema |
| `PUT /doppel/api/playgrounds/{id}` | Replace only this playground, retaining its URL and original expiry |
| `POST /doppel/api/schema` | Replace shared demo; requires `Authorization: Bearer <admin token>` |

At the shared base `/doppel/api` or a visitor base `/doppel/api/playgrounds/{id}`:

- `GET /{resource}` returns `{"data":[...],"total":100,"page":1,"limit":20}`.
- `GET /{resource}/{id}` returns a row or 404.
- `page` starts at 1; `limit` defaults to 20 and is capped at 1000.
- Exact-match filters combine with AND, for example `?status=completed&store_id=...`; boolean filters use `true`/`false`.
- `sort=field&order=asc|desc` sorts native values before pagination. Unknown filter/sort fields return 400; invalid pagination/order returns 422.
- `/docs`, `/redoc`, and `/openapi.json` describe that dataset's resource routes. The OpenAPI `servers` entry contains the dataset base path, and Swagger fetches its document under that prefix. These dataset documents do not list the control endpoints in the table above.

```bash
curl http://127.0.0.1:8000/doppel/api/stores
curl 'http://127.0.0.1:8000/doppel/api/transactions?page=2&limit=10&sort=amount&order=desc'
curl 'http://127.0.0.1:8000/doppel/api/transactions?status=completed'
```

API responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Uvicorn access logs are disabled to avoid adding another log of unlisted playground paths; Cloud Run and Hosting infrastructure may still record request URLs. Never treat capability URLs or synthetic schemas as secret storage.

## Configuration

`backend/utility/settings.py` calls `load_dotenv` at import time for `backend/.env`. Process environment variables take precedence.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Local Python entrypoint bind address |
| `PORT` | `8000` locally, `8080` in Docker | Listening port |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed cross-origin browser clients; same-origin Hosting needs no CORS grant |
| `ADMIN_TOKEN` | Empty, admin publishing disabled | Backend-only publishing credential; Secret Manager in production |
| `VITE_API_URL` | `/doppel/api` | Public frontend API base path, set at build time |
| `API_PROXY_TARGET` | `http://127.0.0.1:8000` | Vite development proxy destination |

Frontend variables belong in `frontend/.env` and must never contain secrets. Production builds explicitly set `VITE_API_URL=/doppel/api`. Do not configure it to localhost or a different Cloud Run origin in production. Local visitor generation needs no token; if testing admin publishing, enter a locally generated value in your ignored backend `.env` and type it into the admin panel, never into frontend variables.

## Tests, build, and Docker

From `backend/`:

```bash
.venv/bin/python -m pytest -q
```

From `frontend/`:

```bash
npm test -- --ci
npm run build
```

Backend tests cover deterministic types, references, schema validation, REST queries, session isolation/expiry/capacity, body limits, rate limits, admin authorization, no-cache headers, and prefixed docs. Jest/RTL tests cover the public demo, visitor generation/updates, mode switching, admin confirmation/token clearing, themes, JSON formatting, keyboard tabs, copying, and errors. Frontend tests mock HTTP and do not verify a real browser or cloud service.

From the repository root, with Docker Desktop running:

```bash
docker build --platform linux/amd64 -t doppel-api:local backend
docker run --rm -p 8080:8080 doppel-api:local
```

In another terminal:

```bash
curl --fail http://localhost:8080/doppel/api/health
```

The image uses `python:3.12-slim`, a non-root user, PORT-aware startup, and exactly one worker. It copies only backend application directories, not `.env` files or credentials.

## GCP deployment architecture

**Setup in progress; not deployed.** The user confirmed project `doppel-101126`, linked billing, the monthly budget alert, and Firebase setup. The chosen Hosting site is `doppel-app`, now configured in `firebase.json`; verify successful site creation in Firebase Console before continuing. Terminal authentication and project/repository identifiers are confirmed. With explicit approval, the required APIs were enabled and the Docker Artifact Registry repository `projects/doppel-101126/locations/asia-south1/repositories/doppel` was created and verified. With separate approval, `doppel-run` and `doppel-deployer` were created and the Step 5 project/repository/runtime-account IAM grants were applied and verified. The runtime has no project-level role grants. With approval, the empty `doppel-admin-token` secret container was created and its runtime-only Secret Accessor binding was verified. The user added the secret value privately in the console, and version 1 was verified as enabled using metadata only. The assistant has not accessed the token value. Step 7 is complete: the `github` WIF pool, active `doppel-repo` provider, and repository-scoped deployer impersonation binding were created with approval and verified. The provider checks repository ID `1452590745`, owner ID `22813216`, main, the exact deploy workflow, and the production environment subject. Its resource name is `projects/831646949881/locations/global/workloadIdentityPools/github/providers/doppel-repo`. Step 8 is complete: repository Actions Variables `GCP_PROJECT_ID`, `GCP_DEPLOY_SA`, and `GCP_WIF_PROVIDER` were set with approval and their values verified. They are Variables, not Secrets. Step 9 is complete: the `production` environment allows only branch `main`, with no tag deployment policy. After inspection found no existing branch protections, the active `Protect main` ruleset (ID `26948210`) was created with separate approval and verified; GitHub now reports `main` as protected. It requires pull requests, resolved review conversations, up-to-date branches, and the GitHub Actions checks `Backend tests` and `Frontend tests and build`; it blocks branch deletion and force pushes, has no bypass actors, and requires zero review approvals for solo-maintainer use. Step 10 PR preparation is approved on feature branch `feat/doppel-playground-gcp`; merge and deployment still require separate approval. Enabling APIs may provision Google-managed service identities automatically. Do not deploy before completing setup below.

This follows the portfolio pattern with a separate project:

- Firebase Hosting serves `frontend/dist`. Its `/doppel/api/**` rewrite precedes the SPA fallback and points to `doppel-api` in `asia-south1`.
- Cloud Run uses port 8080, 1 CPU, 512 MiB memory, concurrency 20, min-instances 0, max-instances 1, one Python worker, and a 60-second request timeout.
- Artifact Registry repository `doppel` stores SHA-tagged images.
- Secret Manager supplies `ADMIN_TOKEN` from `doppel-admin-token:latest`; only the runtime service account receives access to this secret.
- GitHub Actions uses OIDC Workload Identity Federation and service-account impersonation. No service-account JSON key is needed or allowed.
- Deploy runs only after successful **push CI on main**, for this repository. It checks out the exact tested SHA and rejects stale main commits before build and again before deployment.
- The job uses GitHub's `production` environment and repeats tests/build before cloud authentication. Configure the environment's main-only restriction manually.
- Deployment is sequential: API, API health, Hosting, then Hosting/API-rewrite/OpenAPI/docs smoke tests. An API success followed by Hosting failure leaves the previous frontend using the new API.
- There is deliberately no manual Deploy dispatch that bypasses the CI-success gate. To retry setup failures, rerun the CI run whose original event was the latest main push; a successful completion triggers Deploy again. A manually dispatched CI run does not qualify.

Scale-to-zero and a maximum instance setting reduce usage, **not guarantee a zero bill or hard cap**. Cold starts reset all state. Multiple revisions can briefly coexist during rollout, and in-memory state is not consistent between them; transient missing playgrounds require regeneration. Runtime instances, registry storage, Secret Manager, Hosting bandwidth, and logging can incur charges. Public API ingress matches the portfolio and also allows direct Cloud Run calls, not just Hosting calls.

## Manual GCP setup - do these in order

Work through one numbered step at a time and confirm completion before continuing. Console billing, Firebase setup/site creation, and secret value entry are manual. Commands below are references, **not an automatic or idempotent provisioning script**. Stop on errors, verify existing resources before retrying, and confirm before creating billable resources. Use an administrator account for provisioning; do not weaken organization security policies to get a deployment through.

### 1. Create a separate project, link billing, and set a budget

In Google Cloud Console:

1. Create a project named **doppel** with an available, unique project ID. Do **not** reuse `ap-portfolio-241026` or `mahakal-ai-230925`.
2. Verify the new project ID, then explicitly approve and link the intended billing account. Do not enable unrelated products or marketplaces.
3. In Billing > Budgets & alerts, create a budget scoped **only to the new doppel project**, not the entire billing account.
4. Suggested starting budget: **INR 500/month**, matching the portfolio reference, if the billing account uses INR. Otherwise choose an intentional amount in the account's currency. Enable actual-spend alerts at 50%, 90%, and 100%, plus a forecast alert if desired, and verify email recipients.
5. Budget alerts are delayed notifications, **not a spending cap or automatic service shutdown**. No automated billing-disable action is configured.

Stop here. Confirm the project ID, billing link, and budget before Step 2. No credentials or billing account numbers need to be shared in chat.

### 2. Add Firebase to the existing project and create Hosting

In Firebase Console, choose **Add Firebase to an existing Google Cloud project** and select the new doppel project. Verify its project ID before proceeding. Google Analytics is optional and not required. Billing-linked Firebase may use the Blaze plan; review the pricing indication.

In Hosting, check site-ID availability first. Suggested candidates are **`doppel-app`** or **`doppel-api`**, but neither is assumed available or reserved. Create an available site in this project, then report the actual site ID so `firebase.json` can be updated from its placeholder before merging. No Firebase web SDK registration, Firestore database, or service-account key is required.

Stop and confirm the project and Hosting site. Do not run `firebase init` over the checked-in configuration or switch to the portfolio project.

### 3. Authenticate the terminal and set identifiers

Install Google Cloud CLI and GitHub CLI if needed. Use one terminal from the repository root. These commands open interactive browser authentication; handle it locally, without pasting tokens into chat:

```bash
gcloud auth login
gh auth login
export PROJECT_ID='YOUR_NEW_DOPPEL_PROJECT_ID'
export SITE_ID='YOUR_CONFIRMED_SITE_ID'
export REGION='asia-south1'
export GITHUB_REPO='arunangshu01/doppel'
export RUN_SA="doppel-run@${PROJECT_ID}.iam.gserviceaccount.com"
export DEPLOY_SA="doppel-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
case "$PROJECT_ID" in
  ''|YOUR_*|ap-portfolio-241026|mahakal-ai-230925) echo 'STOP: select the new doppel project' ;;
  *) gcloud config set project "$PROJECT_ID" ;;
esac
gcloud projects describe "$PROJECT_ID" --format='table(projectId,name,projectNumber)'
export PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
export REPO_ID=$(gh api "repos/$GITHUB_REPO" --jq '.id')
export OWNER_ID=$(gh api "repos/$GITHUB_REPO" --jq '.owner.id')
```

Verify the project and account shown before continuing. The guard prints STOP for invalid identifiers; do not continue subsequent commands if it fires. Keep this terminal open to preserve exports. Local doppel development does not require Application Default Credentials.

### 4. Enable APIs and create Artifact Registry

**Confirm first:** the repository stores billable image data. Verify `$PROJECT_ID`, then run:

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  secretmanager.googleapis.com firebase.googleapis.com \
  firebasehosting.googleapis.com cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com --project="$PROJECT_ID"

gcloud artifacts repositories create doppel --project="$PROJECT_ID" \
  --repository-format=docker --location="$REGION" \
  --description='Doppel API images'
```

Confirm the repository is in `asia-south1`. Review registry storage and decide image rollback retention. This repo does not apply a destructive image cleanup policy.

### 5. Create runtime/deployer service accounts and IAM bindings

Confirm these IAM changes, then run:

```bash
gcloud iam service-accounts create doppel-run --project="$PROJECT_ID" \
  --display-name='Doppel Cloud Run runtime'
gcloud iam service-accounts create doppel-deployer --project="$PROJECT_ID" \
  --display-name='Doppel GitHub deployer'

for role in roles/run.admin roles/firebasehosting.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$DEPLOY_SA" --role="$role"
done

gcloud artifacts repositories add-iam-policy-binding doppel \
  --project="$PROJECT_ID" --location="$REGION" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/artifactregistry.writer

gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" \
  --project="$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" \
  --role=roles/iam.serviceAccountUser
```

The deployer has deployment permissions in this dedicated project, not Owner/Editor. Registry write is scoped to the repository. The runtime initially needs no project-wide roles. The deployer cannot directly read secret values, but can deploy code running as the runtime identity, so protect workflow changes and repository access. The same-project Cloud Run service agent normally handles image pulls; do not grant broad storage/registry permissions to the application runtime to work around service-agent problems. Organization policies must permit public Cloud Run invocation; ask the administrator if they do not.

### 6. Create the admin secret; enter its value only in the console

**Confirm first:** Secret Manager versions/access can be billable. Create the secret container and its scoped runtime binding:

```bash
gcloud secrets create doppel-admin-token --project="$PROJECT_ID" \
  --replication-policy=automatic
gcloud secrets add-iam-policy-binding doppel-admin-token --project="$PROJECT_ID" \
  --member="serviceAccount:$RUN_SA" --role=roles/secretmanager.secretAccessor
```

Generate a strong random token in a password manager, for example 64 random characters. In **Secret Manager > doppel-admin-token > New version**, enter it directly and ensure the version is enabled. Keep it out of chat, terminal history, Git, GitHub Variables, frontend builds, and screenshots. The UI accepts it only at runtime. Do not create a service-account JSON key.

The workflow injects `ADMIN_TOKEN=doppel-admin-token:latest`. An enabled version and runtime access are required before deployment. Rotate by adding a new version in the console and triggering a fresh deployment; existing revisions may retain the old injected value. No Secret Manager SDK is needed by the application.

### 7. Configure keyless WIF restricted to this workflow and main

Confirm the identity/trust changes and verify `$REPO_ID`, `$OWNER_ID`, and `$GITHUB_REPO`. Then:

```bash
gcloud iam workload-identity-pools create github --project="$PROJECT_ID" \
  --location=global --display-name='Doppel GitHub Actions'

gcloud iam workload-identity-pools providers create-oidc doppel-repo \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github \
  --display-name='Doppel production workflow' \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id' \
  --attribute-condition="assertion.repository_id=='${REPO_ID}' && assertion.repository_owner_id=='${OWNER_ID}' && assertion.ref=='refs/heads/main' && assertion.workflow_ref=='${GITHUB_REPO}/.github/workflows/deploy.yml@refs/heads/main' && assertion.sub=='repo:${GITHUB_REPO}:environment:production'"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --project="$PROJECT_ID" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository_id/${REPO_ID}"

export WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/doppel-repo"
printf 'GCP_PROJECT_ID=%s\nGCP_DEPLOY_SA=%s\nGCP_WIF_PROVIDER=%s\n' \
  "$PROJECT_ID" "$DEPLOY_SA" "$WIF_PROVIDER"
```

The provider checks immutable repository/owner IDs, main, the exact deploy workflow file, and the production environment subject. No JSON key, uploaded key, or long-lived GitHub cloud credential is involved. Allow propagation before diagnosing initial IAM failures; do not loosen conditions as a workaround.

### 8. Configure GitHub Actions Variables, not Secrets

In repository Settings > Secrets and variables > Actions > **Variables**, set:

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | New doppel project ID |
| `GCP_DEPLOY_SA` | `doppel-deployer@YOUR_NEW_DOPPEL_PROJECT_ID.iam.gserviceaccount.com` |
| `GCP_WIF_PROVIDER` | Full provider resource name printed in Step 7 |

Alternatively, run after confirming the identifiers:

```bash
gh variable set GCP_PROJECT_ID --repo "$GITHUB_REPO" --body "$PROJECT_ID"
gh variable set GCP_DEPLOY_SA --repo "$GITHUB_REPO" --body "$DEPLOY_SA"
gh variable set GCP_WIF_PROVIDER --repo "$GITHUB_REPO" --body "$WIF_PROVIDER"
```

These identifiers are not secrets. The admin token belongs only in Secret Manager. Verify `firebase.json` contains the actual site ID and the site belongs to this project.

### 9. Restrict production to main and confirm existing rulesets

In Settings > Environments, create/select **production**, choose selected deployment branches/tags, and add a **branch rule for main only**, with no tag rule. Add a required reviewer if supported and desired; avoid blocking a solo maintainer with an impossible self-approval requirement.

Confirm Actions permits the checked-in Google authentication/setup actions, default token permissions remain read-only, and only the Deploy job requests `id-token: write`.

Inspect, do not replace or relax, the existing branch rulesets. Confirm they actively target main and still require PRs and the checks **Backend tests** and **Frontend tests and build**, with force pushes/deletion blocked and bypass access intentional. Confirm any existing conversation resolution, up-to-date branch, approval, and CODEOWNERS requirements remain enforced. GitHub plan/visibility determines whether protections actually apply; verify enforcement, not just a saved form. If settings differ or are unavailable, stop and resolve them before merging.

An optional read-only inspection command is:

```bash
gh api "repos/$GITHUB_REPO/rulesets?includes_parents=true"
```

Enable secret scanning, push protection, and dependency alerts where supported. No security policy or branch ruleset is modified by the repository implementation.

### 10. PR, CI, merge, Deploy, and live smoke tests

Before proceeding, explicitly approve the first deployment's potential Cloud Run, registry, Hosting, Secret Manager, and logging costs.

1. Run local tests/build and the Docker check above. Confirm the actual Hosting site ID is checked in, not the placeholder, and API rewrites precede the SPA fallback.
2. With explicit approval, commit/push a feature branch and open a PR into main. Obtain separate approval before merging and triggering deployment.
3. Confirm both required CI checks pass, then merge through the existing ruleset.
4. Watch **CI** for the main push. Its successful completion triggers **Deploy**, which uses the exact SHA, checks it is still current, and requests the protected production environment.
5. Approve the environment gate if configured. Watch WIF auth, image build/push, Cloud Run deployment, API health, Firebase deployment, and Hosting rewrite/OpenAPI smoke tests. A stale-SHA rejection means a newer main run should deploy instead.
6. For setup-only failures, fix configuration, then rerun the CI run originally triggered by the latest main push. Do not bypass WIF, branch, or CI protections to retry.

From the authenticated terminal:

```bash
gh run list --repo "$GITHUB_REPO" --workflow deploy.yml --limit 5
API_ORIGIN=$(gcloud run services describe doppel-api --project="$PROJECT_ID" \
  --region="$REGION" --format='value(status.url)')
curl --fail "$API_ORIGIN/doppel/api/health"
curl --fail "https://${SITE_ID}.web.app/"
curl --fail "https://${SITE_ID}.web.app/doppel/api/health"
curl --fail "https://${SITE_ID}.web.app/doppel/api/openapi.json"
```

In a browser, inspect the public demo, create two distinct visitor playgrounds, verify neither replaces the demo or the other, open visitor docs, download a schema, and verify theme persistence. Test admin publishing only when ready to intentionally replace the shared demo; enter its token in the UI, not curl/history/chat. Automated smoke tests do not publish a schema or verify all browser interactions.

### Operations and rollback

- Review Cloud Run request/error logs, budget emails, registry storage, and Secret Manager usage. Logging and monitoring can also incur charges. Enable additional uptime checks/alerts only after reviewing cost.
- Do not log admin tokens, authorization headers, or sensitive schemas. Platform request logs may contain playground IDs; access links are not confidential storage.
- Keep one worker and all Cloud Run traffic on the current revision. Sessions are ephemeral even with max-instances 1; rollout overlap and instance replacement can cause missing sessions. Do not introduce traffic splits without persistent shared storage and a revised session design.
- Normal rollback: revert through a PR, pass CI, and merge. Emergency rollback: an administrator can restore a known-good Cloud Run revision and Firebase Hosting release in their consoles, coordinating both sides. A later deployment supersedes manual rollback. All in-memory data may be lost.
- Do not enable automatic billing shutdown or destructive image cleanup without a separate decision. Budgets and autoscaling settings are not financial guarantees.

## Layout

```text
backend/
  app/          Application factory, middleware, and ASGI dataset mounts
  model/        Schema validation and limits
  routers/      Control API and resource routes
  source/       Faker engine, bounded playground store, retail template
  utility/      Environment settings and HTTP guards
  tests/        pytest regression suite
frontend/
  public/       SVG logo and favicon
  src/          React workbench, themes, previews, and Jest/RTL tests
deploy/
  cloud-run.env.yaml   Non-secret runtime environment
firebase.json          Hosting, caching, and Cloud Run rewrite
.github/
  workflows/    CI and CI-gated keyless deployment
  CODEOWNERS
```

## Scope

Resource endpoints are read-only. The anonymous playground model is ephemeral, capacity-bounded, and unlisted, not account-based tenant isolation or durable hosting. Persistent APIs, user accounts, database storage, write endpoints, distributed rate limits, and stronger abuse controls are not implemented. The GCP configuration is ready for guided provisioning; a checked-in workflow does not mean a live service exists.

## License

Apache-2.0. See [LICENSE](LICENSE).
