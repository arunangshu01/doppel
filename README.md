# doppel

<img src="frontend/public/logo.svg" alt="doppel paired-d logo" width="64" height="64" />

**Your backend stand-in.**

**Live app:** https://doppel-app.web.app

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
- Retail, SaaS users/projects/tasks, blog authors/posts/comments, and e-commerce customers/products/orders starter templates.
- Resource navigation, Table/JSON views, pagination/filter/sort controls, and cURL copying with the applied request parameters.
- JSON formatting, schema downloads, and local JSON import (up to 128 KiB); imports and template/locale changes stay drafts until generation succeeds.
- Numeric and date constraints with five supported Faker locales, retaining deterministic generation.
- Bounded request-only delay, HTTP error, and empty-list simulation, without changing stored data.
- Responsive creator attribution with accessible GitHub and email icon links.
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

Open <http://localhost:5173>. The local API is at <http://127.0.0.1:8000/doppel/api/v1>, with docs at <http://127.0.0.1:8000/doppel/api/v1/docs> and OpenAPI at <http://127.0.0.1:8000/doppel/api/v1/openapi.json>. These replace the original unprefixed endpoints. Vite proxies `/doppel/api` (including `/doppel/api/v1`) to the local backend, matching the production same-origin architecture.

### Playground workflow

1. The UI opens the public demo and previews its resources without creating a playground.
2. Edit the JSON, use **Import schema** to restore a downloaded file, or choose a **Starter template** and load it. **Format JSON** only formats the editor.
3. Set the seed, locale, counts, and optional field constraints, then select **Generate API**. The editor shows draft rows and cells; visitor playgrounds are limited to 20000 cells. Generation creates your own playground, not a replacement for the public demo.
4. Select a resource and inspect **Table** or **JSON** responses. Use **Request query** to set page/size, sorting, and an exact-match filter, then **Apply query**. The default preview shows five rows. **Copy cURL** and the endpoint link use the applied query; **API docs** describes the selected dataset. Expand **Simulate a response** for request-only delay, empty-list, and HTTP error controls.
5. Use **Public demo** and **My playground** to switch previews. Editor changes do not affect a published dataset until generation succeeds.
6. Use **Download schema** before leaving or sharing the endpoint. Reloading the page returns to the public demo; playground URLs are not automatically restored from browser storage.
7. For admin publishing, open **Admin publishing**, enter the token, select **Publish shared demo**, and confirm replacement. The token is never included in the frontend build or saved in browser storage. It is cleared on submission, panel close, or **Clear token**. Missing backend configuration disables admin publishing; it does not disable visitor generation.

An expired playground returns 404. The UI clears the expired session when it receives that response; select Generate API again to create a replacement. Clipboard access requires browser support in a secure context such as localhost or HTTPS.

### Connect an application

The startup retail API can be queried from JavaScript:

```javascript
const response = await fetch('/doppel/api/v1/transactions?limit=10&sort=amount&order=desc');
if (!response.ok) throw new Error(`Mock API returned ${response.status}`);
const { data, total } = await response.json();
console.log(data, total);
```

The relative URL works on doppel Hosting or through the Vite proxy. In another application, use the full backend/Hosting origin and the base path returned when creating a playground. Cross-origin browser clients must be on the backend `CORS_ORIGINS` allowlist. CORS is not authentication; non-browser clients can still access public endpoints.

### Appearance and logo

The logo uses two paired lowercase `d` forms to represent a stand-in for a real backend. The mint SVG is shared by the header, footer, favicon, and README: [`frontend/public/logo.svg`](frontend/public/logo.svg).

The **Color theme** selector supports Dark, Light, and System. System follows OS changes. Preferences are saved under `doppel-theme` in browser local storage when available and applied early during page loading. This is not a cross-device setting.

### Responsive layout

The workbench uses two panels on larger desktops and stacks them at 1280px and below. Phones and tablets up to 1024px use horizontally scrollable resource navigation. Smaller screens get quick links between the schema editor and response explorer, wrapping toolbars, and single-column controls at the narrowest widths. Wide tables and JSON scroll within keyboard-focusable response regions rather than widening the page.

Interactive controls have 44px minimum heights, with 44px icon and response-tab targets. Text-entry controls use 16px text on touch/narrow layouts to avoid iOS focus zoom. The viewport permits pinch zoom, supports display cutout safe areas, and uses stable viewport units so browser chrome changes do not constantly resize the editor.

For responsive QA, check 280, 320, 390, 768, 1024, 1280, 1440, 1920, and 2560 CSS-pixel widths, phone landscape, long resource/field names, wide responses, and zoomed reflow. Jest verifies behavior and accessible structure, not CSS geometry; use a real browser for overflow, scrolling, and touch-target checks. Chrome device emulation does not replace physical iOS/Android checks for keyboards, native pickers, safe areas, and touch gestures.

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

### Constraints and locales

The optional top-level `locale` defaults to `en_US`; supported values are `en_US`, `en_IN`, `en_GB`, `fr_FR`, and `de_DE`. Select it in the editor toolbar or set it in JSON. Locales affect the Faker providers available for that locale; some providers fall back to Faker defaults. Changing locale changes generated data, not UI language, currency, or numeric formatting.

Fields can use these object forms:

```json
{
  "age": {"type": "int", "min": 18, "max": 65},
  "price": {"type": "money", "min": 1.25, "max": 250},
  "score": {"type": "float", "min": -1, "max": 1},
  "joined": {"type": "date", "start": "2024-01-01", "end": "2024-12-31"},
  "created": {"type": "datetime", "start": "2024-01-01T00:00:00", "end": "2024-12-31T23:59:59"}
}
```

These are entries inside a resource's `fields`, alongside its required UUID `id`. Bounds are inclusive. Numeric constraints must be finite and within +/-1 billion; integer bounds must be whole numbers, and money ranges must include a non-negative whole-cent value. When one numeric bound is omitted, it defaults to 0 or 10000; if that default would reverse the range, the missing bound is instead placed 10000 away from the given one (for example, `"min": 20000` generates 20000 through 30000). Bounded floats are rounded to four decimal places within the bounds. Without numeric constraints, the original type defaults in the table apply.

Date bounds use fixed ISO values between 1900 and 2100. Missing date bounds default to 2020-01-01 or 2025-01-01; if that default would reverse the range, the missing bound is instead placed five years away from the given one, clamped to 1900 through 2100. Datetimes are timezone-free with whole-second precision. Reversed ranges, fractional integer bounds, unsupported locales, and constraints on incompatible field types are rejected before replacing a dataset. Enum fields continue to use `values`; `values` is only accepted on `enum` fields and `target` only on `ref` fields. Schemas returned by the API use the same compact shorthand (`"uuid"`, `"ref(users.id)"`) wherever a field has no options.

### Limits

- At most 20 resources, 1000 rows/resource, 50 fields/resource, and 100000 cells/schema.
- Visitor playgrounds are additionally limited to 20000 cells each.
- Each process holds at most 20 visitor playgrounds and 200000 visitor cells total, separate from the shared demo.
- Generation runs off the event loop with at most one active operation and no waiting generation queue. Busy generation returns 429 with `Retry-After: 1`. The existing generation budget remains 12 attempts/minute per process across visitor generation and authorized admin publishing; capacity checks can reject work before consuming it.
- Shared request budgets allow 600 ordinary API requests/minute and 60 POST/PUT attempts/minute per process. `/health` has a separate 60-request/minute reserve so ordinary read saturation does not consume the health budget.
- Each fairness identifier allows 120 reads and 3 POST/PUT attempts per minute. Each visitor playground additionally allows 240 reads and 3 writes per minute, shared across callers. Invalid schema/auth attempts consume the request budget too.
- Limiter state is capped at 2048 active budget entries, with idle entries pruned after 60 seconds. New entries fail closed with 429 when full. Quotas use rolling 60-second windows and real 429s include a positive `Retry-After`; the UI displays this delay without automatic retries.
- Full playground capacity returns 503; expired or unknown IDs return 404. Expired entries are pruned lazily on playground operations, without a background task keeping Cloud Run active.
- POST/PUT request bodies are capped at 128 KiB, including streamed bodies, with a 5-second upload deadline before JSON parsing. Oversized bodies return 413; slow uploads return 408. URLs are limited to 8 KiB and request headers to 16 KiB, returning 414 and 431 respectively.
- Resource/field names start with a lowercase letter, use lowercase letters, digits, and underscores, and have at most 48 characters.
- Reserved resources: `api`, `docs`, `redoc`, `openapi`, `health`, `schema`, `templates`, `playgrounds`, `demo`. Reserved fields: `page`, `limit`, `sort`, `order`.

The API issues an opaque, signed, 30-minute `X-Doppel-Client` fairness identifier on admitted requests that do not have a valid one. The workbench holds it only in memory and sends it on subsequent API calls. It uses no cookie, contains only randomness and an issuance time rather than an IP address, is never included in schemas/cURL downloads, and grants no authentication or playground ownership. API consumers may echo this response header. A request without an identifier, or with an expired but validly signed one, is charged to the new identifier issued with its response, so new visitors cannot be locked out by each other. Malformed or tamper-signed identifiers share one restricted anonymous budget. Allowed cross-origin browser clients can read this header and `Retry-After` through CORS. Identifiers and all quotas reset on process restart.

The server does not trust forwarded IP headers for rate limiting: Firebase Hosting proxies requests, and the direct Cloud Run endpoint is public. Signed identifiers provide best-effort fairness, not durable user identity; callers can obtain new identifiers. Global and per-playground limits still apply, but attackers can exhaust public capacity or drive request costs. These safeguards are not distributed quotas, an edge firewall, DDoS protection, authentication, or a spending cap. Edge controls, stronger identity/challenges, and monitoring require a separate infrastructure review before wide promotion.

## REST API

All API routes use the versioned prefix `/doppel/api/v1`; the earlier unversioned `/doppel/api/...` routes are deprecated but still served by an internal rewrite to `/doppel/api/v1/...` (same handlers, rate limits, and headers, plus `Deprecation: true` and a `Link: rel="successor-version"` header) so existing links, open browser tabs, and the uptime check keep working during the transition. The alias will be removed in a later release. Firebase forwards the whole `/doppel/api/**` namespace unchanged to Cloud Run, so future versions need no Hosting change.

| Endpoint | Behavior |
| --- | --- |
| `GET /doppel/api/v1/health` | `{"status":"ok"}` |
| `GET /doppel/api/v1/demo` | Shared demo manifest, base path, and schema |
| `GET /doppel/api/v1/schema` | Current shared demo schema |
| `GET /doppel/api/v1/templates` | Starter catalog with IDs and resource names |
| `GET /doppel/api/v1/templates/{name}` | Starter schema: `retail`, `saas`, `blog`, or `ecommerce`; unknown names return 404 |
| `POST /doppel/api/v1/playgrounds` | Create an isolated playground; returns 201 with `id`, `base_path`, `expires_at`, seed, and resource endpoints |
| `GET /doppel/api/v1/playgrounds/{id}` | Playground manifest |
| `GET /doppel/api/v1/playgrounds/{id}/schema` | Playground schema |
| `PUT /doppel/api/v1/playgrounds/{id}` | Replace only this playground, retaining its URL and original expiry |
| `POST /doppel/api/v1/schema` | Replace shared demo; requires `Authorization: Bearer <admin token>` |

At the shared base `/doppel/api/v1` or a visitor base `/doppel/api/v1/playgrounds/{id}`:

- `GET /{resource}` returns `{"data":[...],"total":100,"page":1,"limit":20}`.
- `GET /{resource}/{id}` returns a row or 404.
- `page` starts at 1; `limit` defaults to 20 and is capped at 1000.
- Exact-match filters combine with AND, for example `?status=completed&store_id=...`; boolean filters use `true`/`false`.
- `sort=field&order=asc|desc` sorts native values before pagination. Unknown filter/sort fields return 400; invalid pagination/order returns 422.
- `/docs`, `/redoc`, and `/openapi.json` describe that dataset's resource routes. The OpenAPI `servers` entry contains the dataset base path, and Swagger fetches its document under that prefix. These dataset documents do not list the control endpoints in the table above.

```bash
curl http://127.0.0.1:8000/doppel/api/v1/stores
curl 'http://127.0.0.1:8000/doppel/api/v1/transactions?page=2&limit=10&sort=amount&order=desc'
curl 'http://127.0.0.1:8000/doppel/api/v1/transactions?status=completed'
```

### Response simulation

In the response explorer, expand **Simulate a response**, choose controls, and select **Apply query**. The endpoint link and copied cURL include the applied options. **Reset query** restores the default request. A simulated error is displayed with its HTTP status and JSON body; simulated 404s do not discard the current visitor playground.

- `_delay_ms=0..3000` delays a resource list or item response asynchronously. At most four delayed requests run concurrently per process, shared across demo and visitor datasets. Overflow returns 429 with `Retry-After: 1`; ordinary undelayed reads remain available.
- `_status=200|400|401|403|404|429|500|503` selects the response status. Non-200 simulation returns a JSON body with `simulated: true` and an `X-Doppel-Simulated` header. Other statuses are rejected.
- `_empty=true` makes a list return an empty `data` array and total 0. It does not delete rows. This option applies only to resource lists, not item lookups.
- Delay precedes a simulated error; a selected error takes precedence over an empty list. Normal queries without these options retain their original behavior.

For example, append `?_delay_ms=500&_status=503` to a resource URL to test a delayed service failure, or `?_empty=true` to test an empty list. These options appear in dataset OpenAPI documentation. They do not simulate network disconnection, bypass resource/session existence checks, or provide comprehensive rate limiting. Delays keep requests in flight and can incur runtime costs even though bounded.

API responses use `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Uvicorn access logs are disabled to avoid adding another log of unlisted playground paths; Cloud Run and Hosting infrastructure may still record request URLs. Never treat capability URLs or synthetic schemas as secret storage.

## Configuration

`backend/utility/settings.py` calls `load_dotenv` at import time for `backend/.env`. Process environment variables take precedence.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Local Python entrypoint bind address |
| `PORT` | `8000` locally, `8080` in Docker | Listening port |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed cross-origin browser clients; same-origin Hosting needs no CORS grant |
| `ADMIN_TOKEN` | Empty, admin publishing disabled | Backend-only publishing credential; Secret Manager in production |
| `VITE_API_URL` | `/doppel/api/v1` | Public frontend API base path, set at build time |
| `API_PROXY_TARGET` | `http://127.0.0.1:8000` | Vite development proxy destination |

Frontend variables belong in `frontend/.env` and must never contain secrets. Production builds explicitly set `VITE_API_URL=/doppel/api/v1`. Do not configure it to localhost or a different Cloud Run origin in production. Local visitor generation needs no token; if testing admin publishing, enter a locally generated value in your ignored backend `.env` and type it into the admin panel, never into frontend variables.

## Tests, build, and Docker

From `backend/`:

```bash
.venv/bin/python -m pytest -q
```

From `frontend/`:

```bash
npm test -- --ci
npm run build
npm run test:browser
npm audit --omit=dev --audit-level=low
```

Backend tests cover deterministic types, references, schema validation, REST queries, session isolation/expiry/capacity, upload limits/deadlines, fair-use limits, identifier tampering, bounded limiter state, generation admission, admin authorization, no-cache headers, CORS, prefixed docs, and CI/deployment configuration. Jest/RTL tests mock HTTP and cover workbench behavior, signed-identifier forwarding, retry feedback, and structural accessibility. JSDOM cannot measure CSS contrast, so that rule is checked in real Chrome instead.

`test:browser` serves the production build on an isolated local port, starts a fresh temporary Chrome profile, and uses mocked API fixtures with long names/wide rows. It checks both themes across phone, tablet, desktop, landscape, and zoom-equivalent layouts; automated axe accessibility checks including color contrast; touch-target sizes; internal table/JSON scrolling; and keyboard skip navigation. It makes no production API calls. Chrome must be installed (`CHROME_BIN` can override its executable); Node.js 22 or newer is required. CI runs this check inside the existing required frontend job. Physical iOS/Android keyboards, pickers, clipboard behavior, notches, and touch gestures still need manual checks.

The production dependency audit is a CI gate. A full `npm audit` currently reports six low-severity test-toolchain findings stemming from the unpatched `deepmerge` advisory [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). These packages are not shipped in the browser bundle; Jest configuration is trusted repository code. Track an upstream fix rather than forcing the breaking Jest downgrade suggested by npm. No dependency security settings or audit policies are weakened.

From the repository root, with Docker Desktop running:

```bash
docker build --platform linux/amd64 -t doppel-api:local backend
docker run --rm -p 8080:8080 doppel-api:local
```

In another terminal:

```bash
curl --fail http://localhost:8080/doppel/api/v1/health
```

The image uses `python:3.12-slim`, a non-root user, PORT-aware startup, and exactly one worker. It copies only backend application directories, not `.env` files or credentials.

## GCP deployment architecture

**Live deployment:** [doppel playground](https://doppel-app.web.app), first deployed through [GitHub Actions](https://github.com/arunangshu01/doppel/actions/runs/42836375202) after main CI passed. Live smoke checks verified Hosting, same-origin API health, retail data, no-store responses, and prefixed OpenAPI/docs. Browser interaction checks remain manual.

| Setting | Configured value |
| --- | --- |
| Dedicated GCP project | `doppel-101126` (project number `831646949881`) |
| Firebase Hosting site | `doppel-app` |
| Cloud Run service / region | `doppel-api` / `asia-south1` |
| Runtime / deployer identities | `doppel-run` / `doppel-deployer` in the doppel project |
| Artifact Registry | `doppel` Docker repository in `asia-south1` |
| WIF provider | `projects/831646949881/locations/global/workloadIdentityPools/github/providers/doppel-repo` |
| Immutable OIDC subject | `repo:arunangshu01@22813216/doppel@1452590745:environment:production` |
| Scaling | Minimum 0; maximum 1 at both service and revision levels |

Billing and a project-scoped monthly INR 500 alert budget are configured. The admin token was entered privately in Secret Manager; its value is not in the repository. GitHub Actions uses three repository Variables, not Secrets, for the cloud identifiers. The `production` environment allows only branch `main`, with no tag policy, and requires deployment approval from `arunangshu01`. Admin bypass is disabled. Self-review of deployments is allowed so the solo maintainer can approve runs they triggered. The active `Protect main` ruleset requires PRs, resolved review conversations, up-to-date branches, and both CI checks, blocks deletion/force pushes, and has no bypass actors. Zero review approvals are required for solo-maintainer use.

Provisioning and the first deployment were explicitly approved. The service-level cap was subsequently corrected from the platform default of 3 to 1 without creating a new revision. The workflow retains both `--max 1` (whole service) and `--max-instances 1` (each revision). Future merges that pass main CI queue Deploy, but its production job waits for a separate GitHub environment approval before any job steps, cloud authentication, or deployment occur. Merging a PR does not grant that approval. The numbered guide below is a provisioning reference, not a list of resources to recreate.

This follows the portfolio pattern with a separate project:

- Firebase Hosting serves `frontend/dist`. Its `/doppel/api/**` rewrite (covering `/doppel/api/v1`) precedes the SPA fallback and points to `doppel-api` in `asia-south1`.
- Cloud Run uses port 8080, 1 CPU, 512 MiB memory, concurrency 20, min-instances 0, both service-level and revision-level maximums of 1, one Python worker, and a 60-second request timeout.
- Artifact Registry repository `doppel` stores SHA-tagged images.
- Secret Manager supplies `ADMIN_TOKEN` from `doppel-admin-token:latest`; only the runtime service account receives access to this secret.
- GitHub Actions uses OIDC Workload Identity Federation and service-account impersonation. No service-account JSON key is needed or allowed.
- Deploy runs only after successful **push CI on main**, for this repository. It checks out the exact tested SHA and rejects stale main commits before build and again before deployment.
- The job uses GitHub's `production` environment and waits for its required reviewer before starting. Once approved, it repeats tests/build before cloud authentication. Required reviewers, main-only restrictions, and disabled admin bypass are GitHub repository settings, not controls enforced by YAML alone.
- Deployment is sequential: API, API health, Hosting, then Hosting/API-rewrite/OpenAPI/docs smoke tests. An API success followed by Hosting failure leaves the previous frontend using the new API.
- There is deliberately no manual Deploy dispatch that bypasses the CI-success gate. To retry setup failures, rerun the CI run whose original event was the latest main push; a successful completion triggers Deploy again. A manually dispatched CI run does not qualify.

Scale-to-zero and a maximum instance setting reduce usage, **not guarantee a zero bill or hard cap**. Cold starts reset all state. Multiple revisions can briefly coexist during rollout, and in-memory state is not consistent between them; transient missing playgrounds require regeneration. Runtime instances, registry storage, Secret Manager, Hosting bandwidth, and logging can incur charges. Public API ingress matches the portfolio and also allows direct Cloud Run calls, not just Hosting calls.

### Monitoring and operational safeguards

The minimal monitoring setup was created in `doppel-101126` after explicit approval of potential usage charges and notification emails:

| Resource | Configuration |
| --- | --- |
| `doppel API health` uptime check | HTTPS `doppel-app.web.app/doppel/api/v1/health`, every 5 minutes from Asia Pacific, Europe, and Iowa; 30-second timeout; certificate validation, HTTP 200, and JSON `status` equal to `ok` required |
| `doppel API health failure` alert | At least two regions report failure for 10 minutes; enabled email notifications on incident opening and closing |
| `doppel health alerts` channel | Enabled email delivery to `arunangshu01@gmail.com`; Google reports no pending verification requirement |
| `doppel operations` dashboard | Health probe pass fraction, Cloud Run request rate by response class, per-revision p95 latency, and instance count; existing Google Cloud metrics only |

The alert uses Google's uptime-check pattern: a 20-minute next-older alignment window, cross-region count of failed probes, and a 10-minute sustained threshold. Missing data alone is not configured as a separate outage condition; this is not a guarantee that telemetry loss will be detected. No outage was induced to test email delivery, so actual mailbox delivery remains unproven until an incident or separately approved delivery test.

The health check exercises both Hosting routing and the backend. Intentional mock API error/latency simulation does not affect this endpoint or drive the email alert, although simulated errors and delays remain visible in the request/latency charts. Periodic probes generate requests and logs, affect warm/scale-to-zero behavior, and can incur usage; free allowances and budget alerts are not spending caps. No synthetic functions or custom metric collectors were created.

Both instance maximums remain 1 and the default log bucket retains logs for 30 days. Monitoring setup did not change ingress/IAM, retention, deployed code, or production approval settings, and did not delete images. Artifact Registry cleanup and edge protection remain unconfigured. Review cleanup in dry-run mode before separately approving any deletions, preserving deployed and rollback images. An edge firewall may require a load balancer and ingress redesign because the direct Cloud Run URL is public.

Further monitoring expansion, infrastructure changes, or image deletions require separate approval. Physical iPhone Safari and Android Chrome checks remain a release checklist item: portrait/landscape, keyboard entry, native selectors, JSON import, clipboard, scroll regions, and safe areas. Automated CI does not certify those device behaviors.

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

Confirm the identity/trust changes and verify `$REPO_ID`, `$OWNER_ID`, and `$GITHUB_REPO`. First inspect the repository's non-secret OIDC subject settings:

```bash
gh api "repos/$GITHUB_REPO/actions/oidc/customization/sub" \
  --jq '{use_default, use_immutable_subject, sub_claim_prefix}'
export OIDC_SUB_PREFIX=$(gh api "repos/$GITHUB_REPO/actions/oidc/customization/sub" \
  --jq '.sub_claim_prefix // empty')
test -n "$OIDC_SUB_PREFIX"
```

For this repository, immutable subjects are enabled and the prefix is `repo:arunangshu01@22813216/doppel@1452590745`. The production subject appends `:environment:production`. Do not use the legacy `repo:OWNER/REPO` prefix here: it caused the first authentication attempt to fail. Keep immutable subjects enabled. If the prefix is empty or a custom subject template is configured, stop and inspect the template before proceeding; do not guess, disable protections, or remove the exact subject check.

Then create the trust configuration:

```bash
gcloud iam workload-identity-pools create github --project="$PROJECT_ID" \
  --location=global --display-name='Doppel GitHub Actions'

gcloud iam workload-identity-pools providers create-oidc doppel-repo \
  --project="$PROJECT_ID" --location=global --workload-identity-pool=github \
  --display-name='Doppel production workflow' \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id' \
  --attribute-condition="assertion.repository_id=='${REPO_ID}' && assertion.repository_owner_id=='${OWNER_ID}' && assertion.ref=='refs/heads/main' && assertion.workflow_ref=='${GITHUB_REPO}/.github/workflows/deploy.yml@refs/heads/main' && assertion.sub=='${OIDC_SUB_PREFIX:?Check the OIDC subject prefix first}:environment:production'"

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

In Settings > Environments, create/select **production**, choose selected deployment branches/tags, and add a **branch rule for main only**, with no tag rule. Enable **Required reviewers** and select **arunangshu01**. Leave **Prevent self-review** unchecked so the solo maintainer can approve deployments they triggered. Disable **Allow administrators to bypass configured protection rules**. Save and verify all settings. If the repository's plan or visibility does not support required reviewers, stop before deployment rather than treating an unprotected environment as approval-gated.

The intended flow is **PR -> required CI -> explicit merge -> main CI -> waiting production job -> GitHub reviewer approval -> Cloud Run and Hosting deployment**. In Actions, open the waiting Deploy run, choose **Review deployments**, select **production**, and choose **Approve and deploy**. Chat approval, a PR merge, and a PR review do not substitute for this environment approval. The assistant must leave deployment approval to the user.

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
5. Deploy must pause for the required `production` reviewer. The user opens **Actions > Deploy > Review deployments**, selects **production**, and chooses **Approve and deploy**. Do not bypass the gate or have the assistant approve on the user's behalf. After approval, watch WIF auth, image build/push, Cloud Run deployment, API health, Firebase deployment, and Hosting rewrite/OpenAPI smoke tests. A stale-SHA rejection means a newer main run should deploy instead.
6. For setup-only failures, fix configuration, then rerun the CI run originally triggered by the latest main push. Do not bypass WIF, branch, or CI protections to retry.

From the authenticated terminal:

```bash
gh run list --repo "$GITHUB_REPO" --workflow deploy.yml --limit 5
API_ORIGIN=$(gcloud run services describe doppel-api --project="$PROJECT_ID" \
  --region="$REGION" --format='value(status.url)')
curl --fail "$API_ORIGIN/doppel/api/v1/health"
curl --fail "https://${SITE_ID}.web.app/"
curl --fail "https://${SITE_ID}.web.app/doppel/api/v1/health"
curl --fail "https://${SITE_ID}.web.app/doppel/api/v1/openapi.json"
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

Resource endpoints are read-only. The anonymous playground model is ephemeral, capacity-bounded, and unlisted, not account-based tenant isolation or durable hosting. Persistent APIs, user accounts, database storage, write endpoints, distributed rate limits, and stronger abuse controls are not implemented. The deployment status and live endpoint are recorded above; passing local tests alone does not establish cloud deployment or browser behavior.

## License

Apache-2.0. See [LICENSE](LICENSE).
