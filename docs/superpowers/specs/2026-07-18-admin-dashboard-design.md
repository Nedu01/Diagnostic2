# Admin Dashboard — Design

Date: 2026-07-18
Status: Approved by owner

## Purpose

Give the site owner one password-protected page — `/admin` — that answers
"what is happening?": new leads and their results, the anonymous funnel
(visitors → starts → completions → opt-ins, with drop-off), aggregate result
patterns, shares, and traffic sources. Also connect the live WordPress page's
"Begin the Diagnostic" button seamlessly to the app.

## Constraints and decisions (from brainstorming)

- **Event store:** owner's own database — Neon Postgres free tier, attached to
  the Vercel project. No third-party analytics service, no tracking scripts.
- **Access:** single owner, single admin password (`ADMIN_PASSWORD` env var).
- **Deployment:** app is not yet deployed; it will deploy to Vercel at
  `diagnostic.catholicmarriagelife.com`. Dashboard ships with that first deploy.
- **Leads stay in Systeme.io.** The dashboard reads them live via the existing
  `SYSTEME_API_KEY`; no second copy of names/emails is stored.
- **No personal data in the events table.** Anonymous visitor ID only.

## Architecture

Three additions to the existing app; nothing is replaced.

```
Visitor browser ──► track() (src/lib/analytics.ts, existing seam)
                        │  POST /api/events  (fire-and-forget)
                        ▼
                  Neon Postgres: events table
                        ▲
                        │  aggregate queries
Owner browser ──► /admin (React route) ──► GET /api/admin/stats ──► numbers
                        │                        │
                        │ password login         └──► Systeme.io API (recent leads)
                        ▼
                  POST /api/admin/login ──► signed token (30 days)
```

### 1. Event recording

- `src/lib/analytics.ts` `track()` currently forwards to `window.plausible`
  (never wired). It will instead POST to `/api/events` with
  `navigator.sendBeacon` (fallback `fetch` with `keepalive`), so navigation is
  never blocked and failures are silent for the visitor.
- Anonymous visitor ID: random UUID generated client-side, kept in
  `localStorage`. No cookies, no fingerprinting, no email/name ever sent.
- Events (existing names kept): `diagnostic_started`, `question_answered`
  (with question index), `diagnostic_completed` (with overall band and five
  pillar bands — bands only, never raw answers), `report_unlocked`,
  `result_shared`. One new event: `visit`, fired on first page view per
  browser session (guarded by a `sessionStorage` flag), carrying the referrer
  hostname and UTM source if present.
- `/api/events` (Vercel function): validates the event against an allowlist of
  names and props, rejects anything else (including any email-shaped string),
  inserts one row. Rate-limited per IP to deter junk.

### 2. Events table (single table)

| column      | type        | notes                                       |
| ----------- | ----------- | ------------------------------------------- |
| id          | bigserial   | PK                                          |
| happened_at | timestamptz | server clock, not client                    |
| visitor_id  | uuid        | anonymous                                   |
| name        | text        | one of the six allowed event names          |
| props       | jsonb       | question index, bands, referrer, utm — validated per event |

Indexes on `(name, happened_at)` and `(visitor_id)`. Connection via Neon's
serverless driver; schema created by a checked-in SQL migration file applied
once (documented in README).

### 3. Stats endpoint

`GET /api/admin/stats?period=7d|30d|all` (auth required) returns one JSON
payload:

- **Funnel:** unique visitors, starts, completions, opt-ins
  (`report_unlocked`), each with conversion rate from the previous step.
- **Drop-off:** per question index, how many visitors answered it — computed
  from `question_answered` props.
- **Result patterns:** counts per overall band; per pillar, counts per band —
  from `diagnostic_completed` props (all quiz-takers, not just subscribers).
- **Shares:** count of `result_shared`.
- **Sources:** top referrer hostnames / UTM sources by unique visitors.
- **Recent leads:** newest ~20 contacts fetched live from Systeme.io
  (email, first name, registered date, score fields, tags) plus a per-contact
  link to open it in Systeme.io. Fetched server-side; the API key never
  reaches the browser. Independent failure: if Systeme.io errors, `leads` is
  returned as an error marker while event stats still load (and vice versa).

### 4. Admin auth

- `POST /api/admin/login` compares the submitted password to `ADMIN_PASSWORD`
  (constant-time comparison). Success returns an HMAC-signed token (signed
  with `ADMIN_SESSION_SECRET` env var) with a 30-day expiry; the client keeps
  it in `localStorage` and sends it as a `Bearer` header.
- Failed attempts are rate-limited: attempts are recorded in Postgres (an
  in-memory counter would reset between serverless invocations) and an IP is
  locked out for 15 minutes after 10 failures.
- `/api/admin/stats` verifies the token signature and expiry on every call.
- Env vars: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `DATABASE_URL` — set in
  `app/.env.local` locally and Vercel project settings in production, same
  pattern as `SYSTEME_API_KEY`. The dev-server plugin in `vite.config.ts`
  gains the same middleware treatment for the new endpoints so everything is
  testable locally.

### 5. Dashboard page

- Route `/admin`, lazy-loaded so regular visitors never download it; excluded
  from robots (`X-Robots-Tag: noindex` via `vercel.json`, matching `/r/` and
  `/s/`).
- Logged-out state: single password field.
- Logged-in state, top to bottom:
  1. Period selector: 7 days / 30 days / all time.
  2. Headline tiles: visitors, starts, completions, opt-ins + conversion rates.
  3. Funnel detail: per-question drop-off (horizontal bars).
  4. Result patterns: overall band split; weakest pillars ranked.
  5. Traffic sources and share count.
  6. Recent leads table with links into Systeme.io.
- Existing visual language (tokens.css, serif headings, cream/brown palette).
- Honest error banners per section when a data source is unreachable — never
  silent zeros.

### 6. WordPress integration

- Deploy app to Vercel; add custom domain `diagnostic.catholicmarriagelife.com`
  (one CNAME record at the domain host).
- The "Begin the Diagnostic" button on `catholicmarriagelife.com/diagnostic`
  links to `https://diagnostic.catholicmarriagelife.com/quiz` — straight into
  question 1; the app's own welcome screen remains at the subdomain root for
  shared links.
- Visits referred from the WordPress page appear in Sources as
  `catholicmarriagelife.com`.
- `ALLOWED_ORIGIN` env var set to the subdomain origin in production
  (the subscribe endpoint already honors it).

## Error handling summary

- Event POST failures: invisible to visitors; event is dropped.
- Stats/leads failures: per-section error banner in the dashboard.
- Auth failures: clear message; rate limit after repeated failures.
- Database unreachable at aggregation time: stats section errors; leads
  section still renders (and vice versa).

## Testing

Same stack as the repo (vitest, Testing Library, CI):

- `/api/events`: accepts allowed events, rejects unknown names/props and
  email-shaped values, rate-limits.
- Stats aggregation: seeded events in → expected funnel/drop-off/band numbers
  out (SQL layer behind a small module boundary so it can run against a test
  double).
- Auth: wrong password rejected, token expiry honored, tampered token rejected.
- Dashboard component: renders tiles/funnel/leads from mocked payload; shows
  error banners on failures; login flow.

## Out of scope (deliberately)

- Multiple admin users or roles.
- Email digests/alerts.
- Storing leads outside Systeme.io.
- Historical backfill (tracking starts at deployment).
- Real-time updates (refresh/period switch is enough).
