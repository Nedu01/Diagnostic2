# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A password-protected `/admin` page showing funnel numbers, result patterns, traffic sources, and recent Systeme.io leads, fed by an anonymous events table in Neon Postgres.

**Architecture:** The existing `track()` seam posts events to a new `/api/events` Vercel function that writes rows to a single Postgres `events` table. `/api/admin/stats` aggregates that table and fetches recent leads live from Systeme.io; `/api/admin/login` exchanges the admin password for a 30-day HMAC token. A lazy-loaded React route renders the dashboard. The dev-server plugin in `vite.config.ts` mounts all API routes locally.

**Tech Stack:** Vite 8 + React 19 + TypeScript (strict), react-router-dom, vitest 4 + Testing Library + jsdom, Vercel serverless functions (`@vercel/node` types), `@neondatabase/serverless` (new dependency), Node `crypto` for HMAC.

## Global Constraints

- **No personal data in the events table** — band keys only, never emails, names, raw answers, or unhashed IPs. `/api/events` must reject unknown event names and unknown props.
- Spec: `docs/superpowers/specs/2026-07-18-admin-dashboard-design.md` — follow it on any ambiguity.
- Event names (exactly these six): `visit`, `diagnostic_started`, `question_answered`, `diagnostic_completed`, `report_unlocked`, `result_shared`.
- Band vocabularies (from `app/src/lib/types.ts`): pillar `BandKey` = `strong | solid | needs_work | concern`; `OverallKey` = `strong | good | gaps | concern`.
- Env vars: `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (new), `SYSTEME_API_KEY` (existing). Local values live in `app/.env.local` (gitignored); never commit secrets.
- All commands run from `app/` in Git Bash. Test with `npx vitest run <file>`; the whole suite must stay green after every task.
- Match existing code style: no semicolons where the file omits them, existing test patterns (see `app/api/_lib/systeme.test.ts`), existing CSS variable tokens.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

**Owner prerequisites (before Task 12 can be verified end-to-end):** create a free Neon project at neon.tech, run `app/db/schema.sql` in its SQL editor, and add `DATABASE_URL=<neon connection string>`, `ADMIN_PASSWORD=<chosen password>`, `ADMIN_SESSION_SECRET=<long random string>` to `app/.env.local`. Tasks 1–11 need no live database (tests stub it).

---

### Task 1: Database schema and query helper

**Files:**
- Create: `app/db/schema.sql`
- Create: `app/api/_lib/db.ts`
- Test: `app/api/_lib/db.test.ts`
- Modify: `app/package.json` (add dependency)

**Interfaces:**
- Produces: `type QueryFn = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>` and `getQuery(): QueryFn` from `app/api/_lib/db.ts`. Every later server task consumes `QueryFn`/`getQuery`.

- [ ] **Step 1: Install the Neon driver**

Run: `npm install @neondatabase/serverless`
Expected: added to `dependencies` in `app/package.json`.

- [ ] **Step 2: Write the schema file**

Create `app/db/schema.sql`:

```sql
-- Applied once per database, by hand: paste into the Neon SQL editor
-- (or run: psql "$DATABASE_URL" -f db/schema.sql).

create table if not exists events (
  id bigserial primary key,
  happened_at timestamptz not null default now(),
  visitor_id uuid not null,
  name text not null,
  props jsonb not null default '{}'::jsonb
);
create index if not exists events_name_time on events (name, happened_at);
create index if not exists events_visitor on events (visitor_id);

-- Fixed-window rate limiting shared by /api/events and /api/admin/login.
-- key examples: 'events:<hashed ip>', 'login:<hashed ip>'.
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
```

- [ ] **Step 3: Write the failing test**

Create `app/api/_lib/db.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { getQuery, resetQueryCache } from './db'

describe('getQuery', () => {
  afterEach(() => {
    resetQueryCache()
    delete process.env.DATABASE_URL
  })

  it('throws a clear error when DATABASE_URL is missing', () => {
    delete process.env.DATABASE_URL
    expect(() => getQuery()).toThrow('DATABASE_URL')
  })

  it('returns a function when DATABASE_URL is set', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@host.neon.tech/db'
    expect(typeof getQuery()).toBe('function')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run api/_lib/db.test.ts`
Expected: FAIL — cannot resolve `./db`.

- [ ] **Step 5: Write the implementation**

Create `app/api/_lib/db.ts`:

```ts
import { neon } from '@neondatabase/serverless'

export type QueryFn = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>

let cached: QueryFn | null = null

/** Lazily creates one Neon client per warm serverless instance. */
export function getQuery(): QueryFn {
  if (!cached) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not configured')
    const sql = neon(url)
    cached = async (text, params = []) =>
      (await sql.query(text, params)) as Record<string, unknown>[]
  }
  return cached
}

/** Test hook: drop the cached client so env changes take effect. */
export function resetQueryCache(): void {
  cached = null
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run api/_lib/db.test.ts`
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json db/schema.sql api/_lib/db.ts api/_lib/db.test.ts
git commit -m "Add events schema and Neon query helper"
```

---

### Task 2: Rate-limit helper

**Files:**
- Create: `app/api/_lib/rateLimit.ts`
- Test: `app/api/_lib/rateLimit.test.ts`

**Interfaces:**
- Consumes: `QueryFn` from `./db`.
- Produces: `hashIp(ip: string): string` and `checkRateLimit(q: QueryFn, key: string, limit: number, windowSeconds: number): Promise<boolean>` (true = allowed). Consumed by Tasks 4 and 5.

- [ ] **Step 1: Write the failing test**

Create `app/api/_lib/rateLimit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { QueryFn } from './db'
import { checkRateLimit, hashIp } from './rateLimit'

const stubQ = (count: number): { q: QueryFn; calls: { text: string; params: unknown[] }[] } => {
  const calls: { text: string; params: unknown[] }[] = []
  const q: QueryFn = async (text, params = []) => {
    calls.push({ text, params })
    return [{ count }]
  }
  return { q, calls }
}

describe('hashIp', () => {
  it('is deterministic and does not contain the raw ip', () => {
    expect(hashIp('203.0.113.9')).toBe(hashIp('203.0.113.9'))
    expect(hashIp('203.0.113.9')).not.toContain('203')
    expect(hashIp('203.0.113.9')).toHaveLength(32)
  })
})

describe('checkRateLimit', () => {
  it('allows when the window count is at or below the limit', async () => {
    const { q } = stubQ(10)
    expect(await checkRateLimit(q, 'login:abc', 10, 900)).toBe(true)
  })

  it('blocks when the window count exceeds the limit', async () => {
    const { q } = stubQ(11)
    expect(await checkRateLimit(q, 'login:abc', 10, 900)).toBe(false)
  })

  it('upserts against the rate_limits table with the key and window', async () => {
    const { q, calls } = stubQ(1)
    await checkRateLimit(q, 'events:xyz', 120, 60)
    expect(calls).toHaveLength(1)
    expect(calls[0].text).toContain('rate_limits')
    expect(calls[0].params).toEqual(['events:xyz', 60])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/rateLimit.test.ts`
Expected: FAIL — cannot resolve `./rateLimit`.

- [ ] **Step 3: Write the implementation**

Create `app/api/_lib/rateLimit.ts`:

```ts
import { createHash } from 'node:crypto'
import type { QueryFn } from './db'

/** Stable, non-reversible key for an IP so raw addresses are never stored. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

/**
 * Fixed-window counter in Postgres (in-memory counters reset between
 * serverless invocations). Returns true while the caller is within limit.
 */
export async function checkRateLimit(
  q: QueryFn,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const rows = await q(
    `insert into rate_limits (key, window_start, count)
     values ($1, now(), 1)
     on conflict (key) do update set
       count = case
         when rate_limits.window_start < now() - make_interval(secs => $2) then 1
         else rate_limits.count + 1
       end,
       window_start = case
         when rate_limits.window_start < now() - make_interval(secs => $2) then now()
         else rate_limits.window_start
       end
     returning count`,
    [key, windowSeconds],
  )
  return Number(rows[0].count) <= limit
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/rateLimit.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/rateLimit.ts api/_lib/rateLimit.test.ts
git commit -m "Add Postgres-backed fixed-window rate limiter"
```

---

### Task 3: Admin token signing and verification

**Files:**
- Create: `app/api/_lib/adminAuth.ts`
- Test: `app/api/_lib/adminAuth.test.ts`

**Interfaces:**
- Produces: `signToken(secret: string, nowMs?: number): string`, `verifyToken(secret: string, token: string, nowMs?: number): boolean`, `safeEqual(a: string, b: string): boolean`, `bearerToken(header: string | undefined): string | null`. Consumed by Tasks 5 and 8.

- [ ] **Step 1: Write the failing test**

Create `app/api/_lib/adminAuth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { bearerToken, safeEqual, signToken, verifyToken } from './adminAuth'

const SECRET = 'test-secret'
const DAY_MS = 24 * 60 * 60 * 1000

describe('admin tokens', () => {
  it('verifies a freshly signed token', () => {
    const token = signToken(SECRET)
    expect(verifyToken(SECRET, token)).toBe(true)
  })

  it('rejects a token signed with a different secret', () => {
    expect(verifyToken('other-secret', signToken(SECRET))).toBe(false)
  })

  it('rejects a tampered payload', () => {
    const [, sig] = signToken(SECRET).split('.')
    const forged = `${Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url')}.${sig}`
    expect(verifyToken(SECRET, forged)).toBe(false)
  })

  it('rejects an expired token (31 days later)', () => {
    const token = signToken(SECRET, Date.now())
    expect(verifyToken(SECRET, token, Date.now() + 31 * DAY_MS)).toBe(false)
  })

  it('accepts a token 29 days later', () => {
    const token = signToken(SECRET, Date.now())
    expect(verifyToken(SECRET, token, Date.now() + 29 * DAY_MS)).toBe(true)
  })

  it('rejects malformed tokens without throwing', () => {
    expect(verifyToken(SECRET, '')).toBe(false)
    expect(verifyToken(SECRET, 'no-dot')).toBe(false)
    expect(verifyToken(SECRET, 'a.b')).toBe(false)
  })
})

describe('safeEqual', () => {
  it('matches equal strings and rejects different ones', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('bearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(bearerToken('Bearer tok.en')).toBe('tok.en')
    expect(bearerToken('Basic xyz')).toBeNull()
    expect(bearerToken(undefined)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/adminAuth.test.ts`
Expected: FAIL — cannot resolve `./adminAuth`.

- [ ] **Step 3: Write the implementation**

Create `app/api/_lib/adminAuth.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

const THIRTY_DAYS_S = 30 * 24 * 60 * 60

const hmac = (secret: string, data: string): string =>
  createHmac('sha256', secret).update(data).digest('base64url')

export function signToken(secret: string, nowMs = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(nowMs / 1000) + THIRTY_DAYS_S }),
  ).toString('base64url')
  return `${payload}.${hmac(secret, payload)}`
}

export function verifyToken(secret: string, token: string, nowMs = Date.now()): boolean {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  if (!safeEqual(sig, hmac(secret, payload))) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number }
    return typeof exp === 'number' && exp * 1000 > nowMs
  } catch {
    return false
  }
}

/** Constant-time string comparison (length leak is acceptable). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function bearerToken(header: string | undefined): string | null {
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/adminAuth.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/adminAuth.ts api/_lib/adminAuth.test.ts
git commit -m "Add HMAC admin session tokens"
```

---

### Task 4: POST /api/events endpoint

**Files:**
- Create: `app/api/events.ts`
- Test: `app/api/events.test.ts`

**Interfaces:**
- Consumes: `getQuery` from `./_lib/db`, `checkRateLimit`/`hashIp` from `./_lib/rateLimit`.
- Produces: HTTP contract `POST /api/events` with JSON body `{ name: string, visitorId: string (uuid), props?: object }` → `200 {ok:true}` | `400` | `405` | `429` | `502`. Consumed by the client in Task 9 and the dev middleware in Task 12.

- [ ] **Step 1: Write the failing test**

Create `app/api/events.test.ts`. The response stub mirrors the handler's `res.status(n).json(x)` usage; the db and rateLimit modules are mocked so no database is needed:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const inserted: { text: string; params: unknown[] }[] = []
let allowRate = true

vi.mock('./_lib/db', () => ({
  getQuery: () => async (text: string, params: unknown[] = []) => {
    inserted.push({ text, params })
    return []
  },
}))
vi.mock('./_lib/rateLimit', () => ({
  hashIp: (ip: string) => `hashed(${ip})`,
  checkRateLimit: async () => allowRate,
}))

import handler from './events'

type Sent = { status: number; body: unknown }
const call = async (method: string, body: unknown, headers: Record<string, string> = {}) => {
  const sent: Sent = { status: 0, body: null }
  const req = { method, body, headers } as never
  const res = {
    status(code: number) {
      sent.status = code
      return { json(payload: unknown) { sent.body = payload } }
    },
  } as never
  await handler(req, res)
  return sent
}

const VISITOR = '123e4567-e89b-42d3-a456-426614174000'

beforeEach(() => {
  inserted.length = 0
  allowRate = true
})

describe('/api/events', () => {
  it('accepts a valid completed event and inserts one row', async () => {
    const sent = await call('POST', {
      name: 'diagnostic_completed',
      visitorId: VISITOR,
      props: { band: 'strong', clarity: 'strong', freedom: 'solid', capacity: 'strong', intention: 'strong', unity: 'needs_work' },
    })
    expect(sent.status).toBe(200)
    expect(inserted).toHaveLength(1)
    expect(inserted[0].params[0]).toBe(VISITOR)
    expect(inserted[0].params[1]).toBe('diagnostic_completed')
  })

  it('accepts a visit event with a source', async () => {
    const sent = await call('POST', { name: 'visit', visitorId: VISITOR, props: { source: 'catholicmarriagelife.com' } })
    expect(sent.status).toBe(200)
  })

  it('rejects unknown event names', async () => {
    const sent = await call('POST', { name: 'password_typed', visitorId: VISITOR })
    expect(sent.status).toBe(400)
    expect(inserted).toHaveLength(0)
  })

  it('rejects unknown props on a known event', async () => {
    const sent = await call('POST', { name: 'diagnostic_started', visitorId: VISITOR, props: { email: 'a@b.com' } })
    expect(sent.status).toBe(400)
  })

  it('rejects an email-shaped visit source', async () => {
    const sent = await call('POST', { name: 'visit', visitorId: VISITOR, props: { source: 'a@b.com' } })
    expect(sent.status).toBe(400)
  })

  it('rejects a malformed visitor id', async () => {
    const sent = await call('POST', { name: 'diagnostic_started', visitorId: 'not-a-uuid' })
    expect(sent.status).toBe(400)
  })

  it('rejects an out-of-range question number', async () => {
    const sent = await call('POST', { name: 'question_answered', visitorId: VISITOR, props: { question: 21 } })
    expect(sent.status).toBe(400)
  })

  it('rejects non-POST methods', async () => {
    const sent = await call('GET', undefined)
    expect(sent.status).toBe(405)
  })

  it('returns 429 when rate limited', async () => {
    allowRate = false
    const sent = await call('POST', { name: 'diagnostic_started', visitorId: VISITOR })
    expect(sent.status).toBe(429)
    expect(inserted).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/events.test.ts`
Expected: FAIL — cannot resolve `./events`.

- [ ] **Step 3: Write the implementation**

Create `app/api/events.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getQuery } from './_lib/db'
import { checkRateLimit, hashIp } from './_lib/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PILLAR_BAND = new Set(['strong', 'solid', 'needs_work', 'concern'])
const OVERALL_BAND = new Set(['strong', 'good', 'gaps', 'concern'])
const PILLARS = ['clarity', 'freedom', 'capacity', 'intention', 'unity'] as const

type Props = Record<string, unknown>
const onlyKeys = (p: Props, allowed: string[]) => Object.keys(p).every((k) => allowed.includes(k))

/** Allowlist: event name → validator for its props. Anything else is rejected. */
const EVENTS: Record<string, (p: Props) => boolean> = {
  visit: (p) =>
    onlyKeys(p, ['source']) &&
    (p.source === undefined ||
      (typeof p.source === 'string' && p.source.length <= 100 && !p.source.includes('@'))),
  diagnostic_started: (p) => onlyKeys(p, []),
  question_answered: (p) =>
    onlyKeys(p, ['question']) &&
    typeof p.question === 'number' && Number.isInteger(p.question) &&
    p.question >= 1 && p.question <= 20,
  diagnostic_completed: (p) =>
    onlyKeys(p, ['band', ...PILLARS]) &&
    OVERALL_BAND.has(String(p.band)) &&
    PILLARS.every((k) => PILLAR_BAND.has(String(p[k]))),
  report_unlocked: (p) => onlyKeys(p, ['band']) && OVERALL_BAND.has(String(p.band)),
  result_shared: (p) => onlyKeys(p, ['method']) && ['native', 'clipboard'].includes(String(p.method)),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false })
    return
  }
  const { name, visitorId, props = {} } = (req.body ?? {}) as {
    name?: string
    visitorId?: string
    props?: Props
  }
  const validate = name ? EVENTS[name] : undefined
  if (
    !validate ||
    typeof visitorId !== 'string' || !UUID_RE.test(visitorId) ||
    typeof props !== 'object' || props === null || Array.isArray(props) ||
    !validate(props)
  ) {
    res.status(400).json({ ok: false })
    return
  }
  try {
    const q = getQuery()
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
    if (!(await checkRateLimit(q, `events:${hashIp(ip)}`, 120, 60))) {
      res.status(429).json({ ok: false })
      return
    }
    await q('insert into events (visitor_id, name, props) values ($1, $2, $3)', [
      visitorId,
      name,
      JSON.stringify(props),
    ])
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('event insert failed:', err instanceof Error ? err.message : err)
    res.status(502).json({ ok: false })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/events.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add api/events.ts api/events.test.ts
git commit -m "Add anonymous event recording endpoint"
```

---

### Task 5: POST /api/admin/login endpoint

**Files:**
- Create: `app/api/admin/login.ts`
- Test: `app/api/admin/login.test.ts`

**Interfaces:**
- Consumes: `safeEqual`/`signToken` from `../_lib/adminAuth`, `getQuery` from `../_lib/db`, `checkRateLimit`/`hashIp` from `../_lib/rateLimit`.
- Produces: HTTP contract `POST /api/admin/login` `{ password: string }` → `200 {ok:true, token}` | `401 {error:'wrong_password'}` | `429 {error:'too_many_attempts'}` | `405` | `502`. Consumed by Task 10's `login()`.

- [ ] **Step 1: Write the failing test**

Create `app/api/admin/login.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

let allowRate = true
vi.mock('../_lib/db', () => ({ getQuery: () => async () => [] }))
vi.mock('../_lib/rateLimit', () => ({
  hashIp: (ip: string) => `hashed(${ip})`,
  checkRateLimit: async () => allowRate,
}))

import { verifyToken } from '../_lib/adminAuth'
import handler from './login'

type Sent = { status: number; body: { ok?: boolean; token?: string; error?: string } }
const call = async (method: string, body: unknown) => {
  const sent: Sent = { status: 0, body: {} }
  const req = { method, body, headers: {} } as never
  const res = {
    status(code: number) {
      sent.status = code
      return { json(payload: unknown) { sent.body = payload as Sent['body'] } }
    },
  } as never
  await handler(req, res)
  return sent
}

beforeEach(() => {
  allowRate = true
  process.env.ADMIN_PASSWORD = 'correct-horse'
  process.env.ADMIN_SESSION_SECRET = 'session-secret'
})

describe('/api/admin/login', () => {
  it('returns a verifiable token for the right password', async () => {
    const sent = await call('POST', { password: 'correct-horse' })
    expect(sent.status).toBe(200)
    expect(verifyToken('session-secret', sent.body.token!)).toBe(true)
  })

  it('rejects a wrong password with 401', async () => {
    const sent = await call('POST', { password: 'guess' })
    expect(sent.status).toBe(401)
    expect(sent.body.token).toBeUndefined()
  })

  it('rejects a missing password with 401', async () => {
    expect((await call('POST', {})).status).toBe(401)
  })

  it('returns 429 when rate limited, even with the right password', async () => {
    allowRate = false
    expect((await call('POST', { password: 'correct-horse' })).status).toBe(429)
  })

  it('returns 502 when env vars are not configured', async () => {
    delete process.env.ADMIN_PASSWORD
    expect((await call('POST', { password: 'x' })).status).toBe(502)
  })

  it('rejects non-POST methods', async () => {
    expect((await call('GET', undefined)).status).toBe(405)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/admin/login.test.ts`
Expected: FAIL — cannot resolve `./login`.

- [ ] **Step 3: Write the implementation**

Create `app/api/admin/login.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { safeEqual, signToken } from '../_lib/adminAuth'
import { getQuery } from '../_lib/db'
import { checkRateLimit, hashIp } from '../_lib/rateLimit'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }
  const expected = process.env.ADMIN_PASSWORD
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!expected || !secret) {
    console.error('ADMIN_PASSWORD / ADMIN_SESSION_SECRET is not configured')
    res.status(502).json({ ok: false, error: 'not_configured' })
    return
  }
  try {
    const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
    // Spec: 10 attempts per 15 minutes per IP, counted in Postgres.
    if (!(await checkRateLimit(getQuery(), `login:${hashIp(ip)}`, 10, 15 * 60))) {
      res.status(429).json({ ok: false, error: 'too_many_attempts' })
      return
    }
  } catch (err) {
    console.error('login rate check failed:', err instanceof Error ? err.message : err)
    res.status(502).json({ ok: false, error: 'provider_error' })
    return
  }
  const { password } = (req.body ?? {}) as { password?: string }
  if (typeof password !== 'string' || !safeEqual(password, expected)) {
    res.status(401).json({ ok: false, error: 'wrong_password' })
    return
  }
  res.status(200).json({ ok: true, token: signToken(secret) })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/admin/login.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add api/admin/login.ts api/admin/login.test.ts
git commit -m "Add admin login endpoint with rate limiting"
```

---

### Task 6: Recent leads from Systeme.io

**Files:**
- Modify: `app/api/_lib/systeme.ts` (append at end of file)
- Test: `app/api/_lib/systeme.test.ts` (append a new describe block)

**Interfaces:**
- Consumes: the module-private `request()` already in `systeme.ts`.
- Produces: `fetchRecentLeads(apiKey: string, limit?: number): Promise<RecentLead[]>` and `interface RecentLead { id: number; email: string; firstName: string | null; registeredAt: string; scoreTotal: string | null; overallBand: string | null; pillarBands: Record<'clarity'|'freedom'|'capacity'|'intention'|'unity', string | null>; tags: string[]; url: string }`. Consumed by Task 8.

- [ ] **Step 1: Write the failing test**

Append to `app/api/_lib/systeme.test.ts` (uses the file's existing `jsonResponse` helper):

```ts
describe('fetchRecentLeads', () => {
  beforeEach(() => vi.restoreAllMocks())

  const contact = (id: number, registeredAt: string) => ({
    id,
    email: `u${id}@example.com`,
    registeredAt,
    fields: [
      { slug: 'first_name', value: `Name${id}` },
      { slug: 'score_total', value: '37' },
      { slug: 'overall_band', value: 'strong' },
      { slug: 'clarity_band', value: 'strong' },
      { slug: 'freedom_band', value: 'solid' },
      { slug: 'capacity_band', value: 'strong' },
      { slug: 'intention_band', value: 'strong' },
      { slug: 'unity_band', value: 'needs_work' },
    ],
    tags: [{ id: 1, name: 'diagnostic-completed' }, { id: 2, name: 'band-strong' }],
  })

  it('maps contacts to leads, newest first', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        items: [contact(1, '2026-07-01T00:00:00+00:00'), contact(2, '2026-07-15T00:00:00+00:00')],
      }),
    )
    const leads = await fetchRecentLeads('key', 20)
    expect(leads.map((l) => l.id)).toEqual([2, 1])
    expect(leads[0]).toMatchObject({
      email: 'u2@example.com',
      firstName: 'Name2',
      scoreTotal: '37',
      overallBand: 'strong',
      pillarBands: { clarity: 'strong', freedom: 'solid', capacity: 'strong', intention: 'strong', unity: 'needs_work' },
      tags: ['diagnostic-completed', 'band-strong'],
      url: 'https://systeme.io/dashboard/contacts/2',
    })
  })

  it('tolerates contacts with no custom fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { items: [{ id: 3, email: 'u3@example.com', registeredAt: '2026-07-10T00:00:00+00:00' }] }),
    )
    const [lead] = await fetchRecentLeads('key')
    expect(lead.firstName).toBeNull()
    expect(lead.overallBand).toBeNull()
    expect(lead.tags).toEqual([])
  })

  it('throws on a non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(500, {}))
    // request() retries once on 5xx, so the mock above must resolve twice — mockResolvedValue does.
    await expect(fetchRecentLeads('key')).rejects.toThrow('contacts list failed')
  })
})
```

Also add `fetchRecentLeads` to the import from `./systeme` at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/systeme.test.ts`
Expected: FAIL — `fetchRecentLeads` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `app/api/_lib/systeme.ts`:

```ts
export interface RecentLead {
  id: number
  email: string
  firstName: string | null
  registeredAt: string
  scoreTotal: string | null
  overallBand: string | null
  pillarBands: Record<'clarity' | 'freedom' | 'capacity' | 'intention' | 'unity', string | null>
  tags: string[]
  url: string
}

interface SystemeContactDetail {
  id: number
  email: string
  registeredAt: string
  fields?: { slug: string; value: string | null }[]
  tags?: { name: string }[]
}

/**
 * Newest contacts for the admin dashboard. Fetches one page and sorts by
 * registeredAt in case the API returns oldest-first.
 */
export async function fetchRecentLeads(apiKey: string, limit = 20): Promise<RecentLead[]> {
  const res = await request(apiKey, 'GET', `/contacts?limit=${Math.max(limit, 50)}`)
  if (!res.ok) throw new Error(`Systeme contacts list failed: ${res.status}`)
  const data = (await res.json()) as { items?: SystemeContactDetail[] }
  return (data.items ?? [])
    .map((c) => {
      const field = (slug: string) => c.fields?.find((f) => f.slug === slug)?.value ?? null
      return {
        id: c.id,
        email: c.email,
        firstName: field('first_name'),
        registeredAt: c.registeredAt,
        scoreTotal: field('score_total'),
        overallBand: field('overall_band'),
        pillarBands: {
          clarity: field('clarity_band'),
          freedom: field('freedom_band'),
          capacity: field('capacity_band'),
          intention: field('intention_band'),
          unity: field('unity_band'),
        },
        tags: (c.tags ?? []).map((t) => t.name),
        url: `https://systeme.io/dashboard/contacts/${c.id}`,
      }
    })
    .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
    .slice(0, limit)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/systeme.test.ts`
Expected: all tests in the file pass (existing + 3 new).

- [ ] **Step 5: Manual check against the live API (needs `SYSTEME_API_KEY` in `app/.env.local`)**

Run (from `app/`):
`KEY=$(grep '^SYSTEME_API_KEY=' .env.local | cut -d= -f2-) && curl -s "https://api.systeme.io/api/contacts?limit=50" -H "X-API-Key: $KEY" | head -c 400`
Expected: JSON with `items`. Confirm `registeredAt` is present on each item (the sort key). If the account someday exceeds 50 contacts and the API returns oldest-first, raise the page size or use the API's documented sort parameter — note it in the code if changed.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/systeme.ts api/_lib/systeme.test.ts
git commit -m "Add recent-leads fetch to Systeme adapter"
```

---

### Task 7: Stats aggregation module

**Files:**
- Create: `app/api/_lib/stats.ts`
- Test: `app/api/_lib/stats.test.ts`

**Interfaces:**
- Consumes: `QueryFn` from `./db`.
- Produces (consumed by Tasks 8 and 10 — the client mirrors these shapes):

```ts
export type Period = '7d' | '30d' | 'all'
export interface Stats {
  funnel: {
    visitors: number; starts: number; completions: number; optIns: number
    startRate: number | null; completionRate: number | null; optInRate: number | null
  }
  dropoff: { question: number; visitors: number }[]
  overallBands: Record<string, number>
  pillarBands: Record<string, Record<string, number>>
  shares: number
  sources: { source: string; visitors: number }[]
}
export function getStats(q: QueryFn, period: Period): Promise<Stats>
```

- [ ] **Step 1: Write the failing test**

Create `app/api/_lib/stats.test.ts`. The stub dispatches on distinctive SQL fragments, so the test pins both the queries' intent and the shaping math:

```ts
import { describe, expect, it } from 'vitest'
import type { QueryFn } from './db'
import { getStats } from './stats'

/** Routes each query to canned rows by matching a distinctive fragment. */
const stubQ: QueryFn = async (text, params = []) => {
  if (text.includes('count(distinct visitor_id) as n from events where happened_at')) return [{ n: 100 }]
  if (params[0] === 'diagnostic_started') return [{ n: 80 }]
  if (params[0] === 'diagnostic_completed') return [{ n: 60 }]
  if (params[0] === 'report_unlocked') return [{ n: 15 }]
  if (text.includes("'question_answered'")) {
    return [
      { question: 1, visitors: 80 },
      { question: 2, visitors: 74 },
    ]
  }
  if (text.includes('unnest')) {
    return [
      { pillar: 'clarity', band: 'strong', n: 40 },
      { pillar: 'clarity', band: 'concern', n: 20 },
      { pillar: 'unity', band: 'needs_work', n: 60 },
    ]
  }
  if (text.includes("'diagnostic_completed'") && text.includes("props->>'band'")) {
    return [
      { band: 'strong', n: 35 },
      { band: 'gaps', n: 25 },
    ]
  }
  if (text.includes("'result_shared'")) return [{ n: 9 }]
  if (text.includes("'visit'") && text.includes('source')) {
    return [
      { source: 'catholicmarriagelife.com', visitors: 70 },
      { source: 'direct', visitors: 30 },
    ]
  }
  throw new Error(`unexpected query: ${text}`)
}

describe('getStats', () => {
  it('assembles the funnel with conversion rates', async () => {
    const stats = await getStats(stubQ, '30d')
    expect(stats.funnel).toEqual({
      visitors: 100,
      starts: 80,
      completions: 60,
      optIns: 15,
      startRate: 0.8,
      completionRate: 0.75,
      optInRate: 0.25,
    })
  })

  it('returns null rates when a preceding step is zero', async () => {
    const zeroQ: QueryFn = async (text, params = []) => {
      if (text.includes('count(distinct visitor_id) as n from events where happened_at')) return [{ n: 0 }]
      if (typeof params[0] === 'string') return [{ n: 0 }]
      return []
    }
    const stats = await getStats(zeroQ, 'all')
    expect(stats.funnel.startRate).toBeNull()
    expect(stats.funnel.optInRate).toBeNull()
  })

  it('shapes dropoff, bands, shares, and sources', async () => {
    const stats = await getStats(stubQ, '7d')
    expect(stats.dropoff).toEqual([
      { question: 1, visitors: 80 },
      { question: 2, visitors: 74 },
    ])
    expect(stats.overallBands).toEqual({ strong: 35, gaps: 25 })
    expect(stats.pillarBands.clarity).toEqual({ strong: 40, concern: 20 })
    expect(stats.pillarBands.unity).toEqual({ needs_work: 60 })
    expect(stats.shares).toBe(9)
    expect(stats.sources[0]).toEqual({ source: 'catholicmarriagelife.com', visitors: 70 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/stats.test.ts`
Expected: FAIL — cannot resolve `./stats`.

- [ ] **Step 3: Write the implementation**

Create `app/api/_lib/stats.ts`:

```ts
import type { QueryFn } from './db'

export type Period = '7d' | '30d' | 'all'

export interface Stats {
  funnel: {
    visitors: number
    starts: number
    completions: number
    optIns: number
    startRate: number | null
    completionRate: number | null
    optInRate: number | null
  }
  dropoff: { question: number; visitors: number }[]
  overallBands: Record<string, number>
  pillarBands: Record<string, Record<string, number>>
  shares: number
  sources: { source: string; visitors: number }[]
}

/** Safe to interpolate: values are fixed per enum key, never user input. */
const SINCE: Record<Period, string> = {
  '7d': "now() - interval '7 days'",
  '30d': "now() - interval '30 days'",
  all: "'epoch'::timestamptz",
}

const rate = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null)

export async function getStats(q: QueryFn, period: Period): Promise<Stats> {
  const since = SINCE[period]
  const uniqByName = async (name: string) =>
    Number(
      (
        await q(
          `select count(distinct visitor_id) as n from events where name = $1 and happened_at >= ${since}`,
          [name],
        )
      )[0]?.n ?? 0,
    )

  const [visitorRows, starts, completions, optIns, dropoffRows, overallRows, pillarRows, shareRows, sourceRows] =
    await Promise.all([
      q(`select count(distinct visitor_id) as n from events where happened_at >= ${since}`),
      uniqByName('diagnostic_started'),
      uniqByName('diagnostic_completed'),
      uniqByName('report_unlocked'),
      q(
        `select (props->>'question')::int as question, count(distinct visitor_id) as visitors
         from events where name = 'question_answered' and happened_at >= ${since}
         group by 1 order by 1`,
      ),
      q(
        `select props->>'band' as band, count(*) as n
         from events where name = 'diagnostic_completed' and happened_at >= ${since}
         group by 1`,
      ),
      q(
        `select k.pillar as pillar, e.props->>k.pillar as band, count(*) as n
         from events e,
              unnest(array['clarity','freedom','capacity','intention','unity']) as k(pillar)
         where e.name = 'diagnostic_completed' and e.happened_at >= ${since}
         group by 1, 2`,
      ),
      q(`select count(*) as n from events where name = 'result_shared' and happened_at >= ${since}`),
      q(
        `select coalesce(nullif(props->>'source', ''), 'direct') as source,
                count(distinct visitor_id) as visitors
         from events where name = 'visit' and happened_at >= ${since}
         group by 1 order by 2 desc limit 10`,
      ),
    ])

  const visitors = Number(visitorRows[0]?.n ?? 0)

  const overallBands: Record<string, number> = {}
  for (const r of overallRows) overallBands[String(r.band)] = Number(r.n)

  const pillarBands: Record<string, Record<string, number>> = {}
  for (const r of pillarRows) {
    const pillar = String(r.pillar)
    pillarBands[pillar] = pillarBands[pillar] ?? {}
    pillarBands[pillar][String(r.band)] = Number(r.n)
  }

  return {
    funnel: {
      visitors,
      starts,
      completions,
      optIns,
      startRate: rate(starts, visitors),
      completionRate: rate(completions, starts),
      optInRate: rate(optIns, completions),
    },
    dropoff: dropoffRows.map((r) => ({ question: Number(r.question), visitors: Number(r.visitors) })),
    overallBands,
    pillarBands,
    shares: Number(shareRows[0]?.n ?? 0),
    sources: sourceRows.map((r) => ({ source: String(r.source), visitors: Number(r.visitors) })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/stats.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/stats.ts api/_lib/stats.test.ts
git commit -m "Add events aggregation for the dashboard"
```

---

### Task 8: GET /api/admin/stats endpoint

**Files:**
- Create: `app/api/admin/stats.ts`
- Test: `app/api/admin/stats.test.ts`

**Interfaces:**
- Consumes: `verifyToken`/`bearerToken` (Task 3), `getQuery` (Task 1), `getStats`/`Period` (Task 7), `fetchRecentLeads` (Task 6).
- Produces: HTTP contract `GET /api/admin/stats?period=7d|30d|all` with `Authorization: Bearer <token>` → `200 { ok: true, period, stats: Stats | {error:true}, leads: RecentLead[] | {error:true} }` | `401` | `405`. Stats and leads fail independently. Consumed by Task 10's `fetchDashboard()`.

- [ ] **Step 1: Write the failing test**

Create `app/api/admin/stats.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

let statsImpl: () => Promise<unknown> = async () => ({ fake: 'stats' })
let leadsImpl: () => Promise<unknown> = async () => [{ id: 1 }]

vi.mock('../_lib/db', () => ({ getQuery: () => async () => [] }))
vi.mock('../_lib/stats', () => ({ getStats: () => statsImpl() }))
vi.mock('../_lib/systeme', () => ({ fetchRecentLeads: () => leadsImpl() }))

import { signToken } from '../_lib/adminAuth'
import handler from './stats'

type Sent = { status: number; body: { ok?: boolean; period?: string; stats?: unknown; leads?: unknown } }
const call = async (headers: Record<string, string>, query: Record<string, string> = {}) => {
  const sent: Sent = { status: 0, body: {} }
  const req = { method: 'GET', headers, query } as never
  const res = {
    status(code: number) {
      sent.status = code
      return { json(payload: unknown) { sent.body = payload as Sent['body'] } }
    },
  } as never
  await handler(req, res)
  return sent
}

const SECRET = 'session-secret'

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET
  process.env.SYSTEME_API_KEY = 'sk'
  statsImpl = async () => ({ fake: 'stats' })
  leadsImpl = async () => [{ id: 1 }]
})

describe('/api/admin/stats', () => {
  const auth = () => ({ authorization: `Bearer ${signToken(SECRET)}` })

  it('returns stats and leads with a valid token', async () => {
    const sent = await call(auth(), { period: '7d' })
    expect(sent.status).toBe(200)
    expect(sent.body.period).toBe('7d')
    expect(sent.body.stats).toEqual({ fake: 'stats' })
    expect(sent.body.leads).toEqual([{ id: 1 }])
  })

  it('defaults an invalid period to 30d', async () => {
    const sent = await call(auth(), { period: 'nonsense' })
    expect(sent.body.period).toBe('30d')
  })

  it('rejects a missing or bad token with 401', async () => {
    expect((await call({})).status).toBe(401)
    expect((await call({ authorization: 'Bearer forged.token' })).status).toBe(401)
  })

  it('still returns leads when stats fail (and marks stats as errored)', async () => {
    statsImpl = async () => { throw new Error('db down') }
    const sent = await call(auth())
    expect(sent.status).toBe(200)
    expect(sent.body.stats).toEqual({ error: true })
    expect(sent.body.leads).toEqual([{ id: 1 }])
  })

  it('still returns stats when leads fail (and marks leads as errored)', async () => {
    leadsImpl = async () => { throw new Error('systeme down') }
    const sent = await call(auth())
    expect(sent.status).toBe(200)
    expect(sent.body.stats).toEqual({ fake: 'stats' })
    expect(sent.body.leads).toEqual({ error: true })
  })

  it('marks leads as errored when SYSTEME_API_KEY is missing', async () => {
    delete process.env.SYSTEME_API_KEY
    const sent = await call(auth())
    expect(sent.body.leads).toEqual({ error: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/admin/stats.test.ts`
Expected: FAIL — cannot resolve `./stats`.

- [ ] **Step 3: Write the implementation**

Create `app/api/admin/stats.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bearerToken, verifyToken } from '../_lib/adminAuth'
import { getQuery } from '../_lib/db'
import { getStats, type Period } from '../_lib/stats'
import { fetchRecentLeads } from '../_lib/systeme'

const PERIODS: Period[] = ['7d', '30d', 'all']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }
  const secret = process.env.ADMIN_SESSION_SECRET
  const token = bearerToken(req.headers.authorization)
  if (!secret || !token || !verifyToken(secret, token)) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }

  const requested = String(req.query.period ?? '')
  const period: Period = (PERIODS as string[]).includes(requested) ? (requested as Period) : '30d'

  const apiKey = process.env.SYSTEME_API_KEY
  // Stats and leads fail independently — the dashboard shows whichever loaded.
  const [stats, leads] = await Promise.allSettled([
    Promise.resolve().then(() => getStats(getQuery(), period)),
    apiKey
      ? fetchRecentLeads(apiKey)
      : Promise.reject(new Error('SYSTEME_API_KEY is not configured')),
  ])
  if (stats.status === 'rejected') {
    console.error('stats failed:', stats.reason instanceof Error ? stats.reason.message : stats.reason)
  }
  if (leads.status === 'rejected') {
    console.error('leads failed:', leads.reason instanceof Error ? leads.reason.message : leads.reason)
  }
  res.status(200).json({
    ok: true,
    period,
    stats: stats.status === 'fulfilled' ? stats.value : { error: true },
    leads: leads.status === 'fulfilled' ? leads.value : { error: true },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/admin/stats.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add api/admin/stats.ts api/admin/stats.test.ts
git commit -m "Add authenticated dashboard stats endpoint"
```

---

### Task 9: Client event sending

**Files:**
- Modify: `app/src/lib/analytics.ts` (full rewrite, shown below)
- Modify: `app/src/App.tsx` (add `useEffect` + `trackVisit`)
- Modify: `app/src/components/ResultsScreen.tsx:26` (add pillar bands to the completed event)
- Test: `app/src/lib/analytics.test.ts`

**Interfaces:**
- Consumes: HTTP contract of `/api/events` (Task 4).
- Produces: `track(event, props?)` (same signature callers already use — no other call sites change) and `trackVisit(): void` (new; called once from `App`).

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/analytics.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { track, trackVisit } from './analytics'

const sentBodies = () =>
  vi.mocked(fetch).mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}')))
})

describe('track', () => {
  it('posts the event with a stable visitor id', () => {
    track('diagnostic_started')
    track('question_answered', { question: 1 })
    const bodies = sentBodies()
    expect(bodies[0].name).toBe('diagnostic_started')
    expect(bodies[1].props).toEqual({ question: 1 })
    expect(bodies[0].visitorId).toBe(bodies[1].visitorId)
    expect(bodies[0].visitorId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('never throws even when sending fails', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(() => track('diagnostic_started')).not.toThrow()
  })
})

describe('trackVisit', () => {
  it('fires once per browser session', () => {
    trackVisit()
    trackVisit()
    expect(sentBodies().filter((b) => b.name === 'visit')).toHaveLength(1)
  })

  it('uses the utm_source when present', () => {
    window.history.replaceState(null, '', '/?utm_source=newsletter')
    trackVisit()
    expect(sentBodies()[0].props).toEqual({ source: 'newsletter' })
    window.history.replaceState(null, '', '/')
  })

  it('omits the source when there is no referrer or utm', () => {
    trackVisit()
    expect(sentBodies()[0].props).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/analytics.test.ts`
Expected: FAIL — `trackVisit` is not exported.

- [ ] **Step 3: Rewrite `app/src/lib/analytics.ts`**

Replace the whole file with:

```ts
type AnalyticsEvent =
  | 'diagnostic_started'
  | 'question_answered'
  | 'diagnostic_completed'
  | 'report_unlocked'
  | 'result_shared'

const VISITOR_KEY = 'diagnostic-visitor-id'
const VISIT_FLAG = 'diagnostic-visit-tracked'

function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(VISITOR_KEY, id)
  }
  return id
}

function send(name: string, props?: Record<string, string | number>): void {
  try {
    const body = JSON.stringify({ name, visitorId: visitorId(), props })
    // sendBeacon survives page navigation; fall back to keepalive fetch.
    const beaconed = navigator.sendBeacon?.(
      '/api/events',
      new Blob([body], { type: 'application/json' }),
    )
    if (!beaconed) {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // Analytics must never break the visitor's flow.
  }
}

/**
 * Single seam for analytics. Events land in our own Postgres via
 * /api/events. Never pass emails or raw answers — bands only.
 */
export function track(event: AnalyticsEvent, props?: Record<string, string | number>): void {
  send(event, props)
}

/** Fires once per browser session, carrying the traffic source if known. */
export function trackVisit(): void {
  try {
    if (sessionStorage.getItem(VISIT_FLAG)) return
    sessionStorage.setItem(VISIT_FLAG, '1')
  } catch {
    return
  }
  const utm = new URLSearchParams(window.location.search).get('utm_source')
  let source = utm ?? ''
  if (!source && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname
      if (host && host !== window.location.hostname) source = host
    } catch {
      // Malformed referrer — treat as direct.
    }
  }
  send('visit', source ? { source: source.slice(0, 100) } : undefined)
}
```

- [ ] **Step 4: Wire the visit event in `app/src/App.tsx`**

Replace the file's imports and component with:

```tsx
import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import WelcomeScreen from './components/WelcomeScreen'
import QuizScreen from './components/QuizScreen'
import ResultsScreen from './components/ResultsScreen'
import SharedResultScreen from './components/SharedResultScreen'
import { trackVisit } from './lib/analytics'

export default function App() {
  useEffect(() => {
    trackVisit()
  }, [])
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/quiz" element={<QuizScreen />} />
      <Route path="/r/:code" element={<ResultsScreen />} />
      <Route path="/s/:code" element={<SharedResultScreen />} />
      <Route path="*" element={<WelcomeScreen />} />
    </Routes>
  )
}
```

- [ ] **Step 5: Add pillar bands to the completed event**

In `app/src/components/ResultsScreen.tsx`, the effect around line 26 currently calls:

```ts
track('diagnostic_completed', { band: result.overall.key })
```

Replace that call with:

```ts
track('diagnostic_completed', {
  band: result.overall.key,
  clarity: result.pillars.Clarity.band.key,
  freedom: result.pillars.Freedom.band.key,
  capacity: result.pillars.Capacity.band.key,
  intention: result.pillars.Intention.band.key,
  unity: result.pillars.Unity.band.key,
})
```

(`result` there is a `DiagnosticResult`; if the surrounding effect derives bands differently, keep its existing variable names and only extend the props.)

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: all files pass, including the new analytics tests and the untouched QuizScreen/ResultsScreen tests (their existing assertions don't inspect these props; if one asserts on the old single-prop call, update the expectation to the six-prop object above).

- [ ] **Step 7: Commit**

```bash
git add src/lib/analytics.ts src/lib/analytics.test.ts src/App.tsx src/components/ResultsScreen.tsx
git commit -m "Send analytics events to /api/events with visit tracking"
```

---

### Task 10: Admin API client and login screen

**Files:**
- Create: `app/src/lib/adminApi.ts`
- Create: `app/src/components/admin/AdminLogin.tsx`
- Test: `app/src/lib/adminApi.test.ts`

**Interfaces:**
- Consumes: HTTP contracts of `/api/admin/login` (Task 5) and `/api/admin/stats` (Task 8).
- Produces (consumed by Task 11's `AdminScreen`):

```ts
export type Period = '7d' | '30d' | 'all'
export interface AdminStats { /* mirror of Task 7's Stats */ }
export interface AdminLead { /* mirror of Task 6's RecentLead */ }
export interface DashboardData {
  period: Period
  stats: AdminStats | { error: true }
  leads: AdminLead[] | { error: true }
}
export function getToken(): string | null
export function clearToken(): void
export function login(password: string): Promise<boolean>       // stores token on success
export function fetchDashboard(period: Period): Promise<DashboardData>  // throws Error('unauthorized') on 401 after clearing the token
// AdminLogin props: { onSuccess: () => void }
```

- [ ] **Step 1: Write the failing test**

Create `app/src/lib/adminApi.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearToken, fetchDashboard, getToken, login } from './adminApi'

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status })

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('login', () => {
  it('stores the token on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { ok: true, token: 'a.b' })))
    expect(await login('pw')).toBe(true)
    expect(getToken()).toBe('a.b')
  })

  it('returns false and stores nothing on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { ok: false })))
    expect(await login('bad')).toBe(false)
    expect(getToken()).toBeNull()
  })
})

describe('fetchDashboard', () => {
  it('sends the bearer token and returns the payload', async () => {
    localStorage.setItem('admin-token', 'tok')
    const payload = { ok: true, period: '30d', stats: { error: true }, leads: [] }
    const mock = vi.fn().mockResolvedValue(jsonResponse(200, payload))
    vi.stubGlobal('fetch', mock)
    const data = await fetchDashboard('30d')
    expect(data.period).toBe('30d')
    const [url, init] = mock.mock.calls[0]
    expect(String(url)).toBe('/api/admin/stats?period=30d')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' })
  })

  it('clears the token and throws "unauthorized" on 401', async () => {
    localStorage.setItem('admin-token', 'expired')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { ok: false })))
    await expect(fetchDashboard('7d')).rejects.toThrow('unauthorized')
    expect(getToken()).toBeNull()
  })

  it('throws on other failures without clearing the token', async () => {
    localStorage.setItem('admin-token', 'tok')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(502, {})))
    await expect(fetchDashboard('7d')).rejects.toThrow()
    expect(getToken()).toBe('tok')
  })
})

describe('clearToken', () => {
  it('removes the stored token', () => {
    localStorage.setItem('admin-token', 'tok')
    clearToken()
    expect(getToken()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/adminApi.test.ts`
Expected: FAIL — cannot resolve `./adminApi`.

- [ ] **Step 3: Write `app/src/lib/adminApi.ts`**

```ts
export type Period = '7d' | '30d' | 'all'

export interface AdminStats {
  funnel: {
    visitors: number
    starts: number
    completions: number
    optIns: number
    startRate: number | null
    completionRate: number | null
    optInRate: number | null
  }
  dropoff: { question: number; visitors: number }[]
  overallBands: Record<string, number>
  pillarBands: Record<string, Record<string, number>>
  shares: number
  sources: { source: string; visitors: number }[]
}

export interface AdminLead {
  id: number
  email: string
  firstName: string | null
  registeredAt: string
  scoreTotal: string | null
  overallBand: string | null
  pillarBands: Record<string, string | null>
  tags: string[]
  url: string
}

export interface DashboardData {
  period: Period
  stats: AdminStats | { error: true }
  leads: AdminLead[] | { error: true }
}

const TOKEN_KEY = 'admin-token'

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY)

export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) return false
  const data = (await res.json()) as { token?: string }
  if (!data.token) return false
  localStorage.setItem(TOKEN_KEY, data.token)
  return true
}

export async function fetchDashboard(period: Period): Promise<DashboardData> {
  const res = await fetch(`/api/admin/stats?period=${period}`, {
    headers: { Authorization: `Bearer ${getToken() ?? ''}` },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('unauthorized')
  }
  if (!res.ok) throw new Error(`dashboard request failed: ${res.status}`)
  return (await res.json()) as DashboardData
}
```

- [ ] **Step 4: Write `app/src/components/admin/AdminLogin.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { login } from '../../lib/adminApi'

export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (await login(password)) onSuccess()
      else setError('That password is not right. Try again.')
    } catch {
      setError('Could not reach the server. Try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="admin admin-login">
      <h1>Dashboard</h1>
      <form onSubmit={submit}>
        <label htmlFor="admin-password">Admin password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting || !password}>
          Sign in
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/adminApi.test.ts`
Expected: 6 passed. Also run `npx tsc -b` — expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/adminApi.ts src/lib/adminApi.test.ts src/components/admin/AdminLogin.tsx
git commit -m "Add admin API client and login form"
```

---

### Task 11: Dashboard screen and sections

**Files:**
- Create: `app/src/components/admin/AdminScreen.tsx`
- Create: `app/src/components/admin/StatTiles.tsx`
- Create: `app/src/components/admin/DropoffBars.tsx`
- Create: `app/src/components/admin/ResultPatterns.tsx`
- Create: `app/src/components/admin/SourcesShares.tsx`
- Create: `app/src/components/admin/LeadsTable.tsx`
- Create: `app/src/styles/admin.css`
- Test: `app/src/components/admin/AdminScreen.test.tsx`

**Interfaces:**
- Consumes: everything `adminApi.ts` exports (Task 10) and `AdminLogin` (Task 10).
- Produces: default export `AdminScreen` (no props) — mounted at `/admin` in Task 12.

- [ ] **Step 1: Write the failing test**

Create `app/src/components/admin/AdminScreen.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DashboardData } from '../../lib/adminApi'
import AdminScreen from './AdminScreen'

const happyData: DashboardData = {
  period: '30d',
  stats: {
    funnel: {
      visitors: 100, starts: 80, completions: 60, optIns: 15,
      startRate: 0.8, completionRate: 0.75, optInRate: 0.25,
    },
    dropoff: [
      { question: 1, visitors: 80 },
      { question: 2, visitors: 74 },
    ],
    overallBands: { strong: 35, gaps: 25 },
    pillarBands: { clarity: { strong: 40 }, unity: { needs_work: 60 } },
    shares: 9,
    sources: [{ source: 'catholicmarriagelife.com', visitors: 70 }],
  },
  leads: [
    {
      id: 2, email: 'ada@example.com', firstName: 'Ada',
      registeredAt: '2026-07-15T00:00:00+00:00', scoreTotal: '37', overallBand: 'strong',
      pillarBands: { clarity: 'strong', freedom: 'solid', capacity: 'strong', intention: 'strong', unity: 'needs_work' },
      tags: ['diagnostic-completed'], url: 'https://systeme.io/dashboard/contacts/2',
    },
  ],
}

const { fetchDashboard } = vi.hoisted(() => ({ fetchDashboard: vi.fn() }))
vi.mock('../../lib/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/adminApi')>()),
  fetchDashboard,
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AdminScreen', () => {
  it('shows the login form when there is no token', () => {
    render(<AdminScreen />)
    expect(screen.getByLabelText('Admin password')).toBeInTheDocument()
  })

  it('renders tiles, patterns, sources, and leads when data loads', async () => {
    localStorage.setItem('admin-token', 'tok')
    fetchDashboard.mockResolvedValue(happyData)
    render(<AdminScreen />)
    expect(await screen.findByText('100')).toBeInTheDocument() // visitors tile
    expect(screen.getByText(/80%/)).toBeInTheDocument() // start rate
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByText('catholicmarriagelife.com')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open in systeme/i })).toHaveAttribute(
      'href',
      'https://systeme.io/dashboard/contacts/2',
    )
  })

  it('shows independent error banners when a source fails', async () => {
    localStorage.setItem('admin-token', 'tok')
    fetchDashboard.mockResolvedValue({ period: '30d', stats: { error: true }, leads: { error: true } })
    render(<AdminScreen />)
    expect(await screen.findByText(/activity stats are unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/leads are unavailable/i)).toBeInTheDocument()
  })

  it('falls back to the login form when the token is rejected', async () => {
    localStorage.setItem('admin-token', 'expired')
    fetchDashboard.mockRejectedValue(new Error('unauthorized'))
    render(<AdminScreen />)
    expect(await screen.findByLabelText('Admin password')).toBeInTheDocument()
  })

  it('reloads when the period changes', async () => {
    localStorage.setItem('admin-token', 'tok')
    fetchDashboard.mockResolvedValue(happyData)
    render(<AdminScreen />)
    await screen.findByText('100')
    await userEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(fetchDashboard).toHaveBeenLastCalledWith('7d')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/AdminScreen.test.tsx`
Expected: FAIL — cannot resolve `./AdminScreen`.

- [ ] **Step 3: Write the section components**

Create `app/src/components/admin/StatTiles.tsx`:

```tsx
import type { AdminStats } from '../../lib/adminApi'

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`)

export default function StatTiles({ funnel }: { funnel: AdminStats['funnel'] }) {
  const tiles = [
    { label: 'Visitors', value: funnel.visitors, rate: null as string | null },
    { label: 'Started', value: funnel.starts, rate: pct(funnel.startRate) },
    { label: 'Completed', value: funnel.completions, rate: pct(funnel.completionRate) },
    { label: 'Opted in', value: funnel.optIns, rate: pct(funnel.optInRate) },
  ]
  return (
    <section className="admin-tiles" aria-label="Funnel">
      {tiles.map((t) => (
        <div key={t.label} className="admin-tile">
          <p className="admin-tile-value">{t.value}</p>
          <p className="admin-tile-label">
            {t.label}
            {t.rate !== null && <span className="admin-tile-rate"> · {t.rate}</span>}
          </p>
        </div>
      ))}
    </section>
  )
}
```

Create `app/src/components/admin/DropoffBars.tsx`:

```tsx
import type { AdminStats } from '../../lib/adminApi'

export default function DropoffBars({ dropoff }: { dropoff: AdminStats['dropoff'] }) {
  if (dropoff.length === 0) return null
  const max = Math.max(...dropoff.map((d) => d.visitors))
  return (
    <section aria-label="Question drop-off">
      <h2>Where people drop off</h2>
      <ol className="admin-bars">
        {dropoff.map((d) => (
          <li key={d.question}>
            <span className="admin-bar-label">Q{d.question}</span>
            <span
              className="admin-bar"
              style={{ width: `${max > 0 ? (d.visitors / max) * 100 : 0}%` }}
            />
            <span className="admin-bar-count">{d.visitors}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

Create `app/src/components/admin/ResultPatterns.tsx`:

```tsx
import type { AdminStats } from '../../lib/adminApi'

const BAND_LABEL: Record<string, string> = {
  strong: 'Strong', good: 'Good', solid: 'Solid',
  gaps: 'Gaps', needs_work: 'Needs work', concern: 'Concern',
}
const label = (k: string) => BAND_LABEL[k] ?? k

export default function ResultPatterns({
  overall,
  pillars,
}: {
  overall: AdminStats['overallBands']
  pillars: AdminStats['pillarBands']
}) {
  const weakest = Object.entries(pillars)
    .map(([pillar, bands]) => ({
      pillar,
      weak: (bands.needs_work ?? 0) + (bands.concern ?? 0),
    }))
    .sort((a, b) => b.weak - a.weak)
  return (
    <section aria-label="Result patterns">
      <h2>Result patterns</h2>
      <ul className="admin-inline-list">
        {Object.entries(overall).map(([band, n]) => (
          <li key={band}>
            <strong>{n}</strong> {label(band)}
          </li>
        ))}
      </ul>
      {weakest.length > 0 && (
        <>
          <h3>Weakest pillars</h3>
          <ol className="admin-inline-list">
            {weakest.map((w) => (
              <li key={w.pillar}>
                {w.pillar.charAt(0).toUpperCase() + w.pillar.slice(1)}: {w.weak} in need of work
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
```

Create `app/src/components/admin/SourcesShares.tsx`:

```tsx
import type { AdminStats } from '../../lib/adminApi'

export default function SourcesShares({
  sources,
  shares,
}: {
  sources: AdminStats['sources']
  shares: number
}) {
  return (
    <section aria-label="Traffic sources">
      <h2>Where visitors come from</h2>
      {sources.length === 0 ? (
        <p>No visits recorded yet.</p>
      ) : (
        <ul className="admin-inline-list">
          {sources.map((s) => (
            <li key={s.source}>
              {s.source}: <strong>{s.visitors}</strong>
            </li>
          ))}
        </ul>
      )}
      <p>
        Results shared: <strong>{shares}</strong>
      </p>
    </section>
  )
}
```

Create `app/src/components/admin/LeadsTable.tsx`:

```tsx
import type { AdminLead } from '../../lib/adminApi'

export default function LeadsTable({ leads }: { leads: AdminLead[] }) {
  return (
    <section aria-label="Recent leads">
      <h2>Recent leads</h2>
      {leads.length === 0 ? (
        <p>No subscribers yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Date</th>
                <th>Score</th>
                <th>Band</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{l.firstName ?? '—'}</td>
                  <td>{l.email}</td>
                  <td>{new Date(l.registeredAt).toLocaleDateString()}</td>
                  <td>{l.scoreTotal ?? '—'}</td>
                  <td>{l.overallBand ?? '—'}</td>
                  <td>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      Open in Systeme
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Write `app/src/components/admin/AdminScreen.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import {
  fetchDashboard,
  getToken,
  type DashboardData,
  type Period,
} from '../../lib/adminApi'
import AdminLogin from './AdminLogin'
import StatTiles from './StatTiles'
import DropoffBars from './DropoffBars'
import ResultPatterns from './ResultPatterns'
import SourcesShares from './SourcesShares'
import LeadsTable from './LeadsTable'
import '../../styles/admin.css'

const PERIOD_LABEL: Record<Period, string> = { '7d': '7 days', '30d': '30 days', all: 'All time' }

export default function AdminScreen() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()))
  const [period, setPeriod] = useState<Period>('30d')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: Period) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchDashboard(p))
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') setAuthed(false)
      else setError('Could not load the dashboard. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) void load(period)
  }, [authed, period, load])

  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>Diagnostic dashboard</h1>
        <div role="group" aria-label="Period">
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              className={p === period ? 'admin-period active' : 'admin-period'}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </header>
      {loading && <p>Loading…</p>}
      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}
      {data && (
        <>
          {'error' in data.stats ? (
            <p role="alert" className="admin-error">
              Activity stats are unavailable right now.
            </p>
          ) : (
            <>
              <StatTiles funnel={data.stats.funnel} />
              <DropoffBars dropoff={data.stats.dropoff} />
              <ResultPatterns overall={data.stats.overallBands} pillars={data.stats.pillarBands} />
              <SourcesShares sources={data.stats.sources} shares={data.stats.shares} />
            </>
          )}
          {Array.isArray(data.leads) ? (
            <LeadsTable leads={data.leads} />
          ) : (
            <p role="alert" className="admin-error">
              Leads are unavailable right now.
            </p>
          )}
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 5: Write `app/src/styles/admin.css`**

Follow the app's existing tokens (`app/src/styles/tokens.css` — inspect it and reuse its custom properties for background, text, and accent colors; the class names below are what the components reference):

```css
.admin {
  max-width: 56rem;
  margin: 0 auto;
  padding: 2rem 1.25rem 4rem;
}
.admin-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}
.admin-period {
  margin-left: 0.5rem;
}
.admin-period.active {
  font-weight: 700;
  text-decoration: underline;
}
.admin-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
}
.admin-tile {
  border: 1px solid var(--color-border, #d9c9a8);
  border-radius: 0.5rem;
  padding: 1rem;
  text-align: center;
}
.admin-tile-value {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
}
.admin-tile-label {
  margin: 0.25rem 0 0;
}
.admin-bars {
  list-style: none;
  padding: 0;
}
.admin-bars li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.25rem 0;
}
.admin-bar-label {
  width: 2.5rem;
}
.admin-bar {
  display: inline-block;
  height: 0.9rem;
  background: var(--color-accent, #6b4a2f);
  border-radius: 0.2rem;
  min-width: 2px;
}
.admin-inline-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}
.admin-error {
  border: 1px solid #b3583c;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}
.admin-table-wrap {
  overflow-x: auto;
}
.admin table {
  border-collapse: collapse;
  width: 100%;
}
.admin th,
.admin td {
  text-align: left;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--color-border, #d9c9a8);
}
.admin-login form {
  display: grid;
  gap: 0.75rem;
  max-width: 20rem;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/components/admin/AdminScreen.test.tsx`
Expected: 5 passed. Also run `npx tsc -b` — no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin src/styles/admin.css
git commit -m "Add admin dashboard screen and sections"
```

---

### Task 12: Route wiring, dev middleware, deployment config, docs

**Files:**
- Modify: `app/src/App.tsx` (lazy `/admin` route)
- Modify: `app/vite.config.ts` (mount all API routes in dev)
- Modify: `app/vercel.json` (noindex for `/admin`)
- Modify: `app/README.md` (env vars + database setup)
- Test: existing suites (no new test file; this task is wiring)

**Interfaces:**
- Consumes: `AdminScreen` (Task 11); the three handler modules (Tasks 4, 5, 8).

- [ ] **Step 1: Add the lazy route in `app/src/App.tsx`**

Replace the file with:

```tsx
import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import WelcomeScreen from './components/WelcomeScreen'
import QuizScreen from './components/QuizScreen'
import ResultsScreen from './components/ResultsScreen'
import SharedResultScreen from './components/SharedResultScreen'
import { trackVisit } from './lib/analytics'

// Lazy: regular visitors never download the dashboard bundle.
const AdminScreen = lazy(() => import('./components/admin/AdminScreen'))

export default function App() {
  useEffect(() => {
    trackVisit()
  }, [])
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/quiz" element={<QuizScreen />} />
      <Route path="/r/:code" element={<ResultsScreen />} />
      <Route path="/s/:code" element={<SharedResultScreen />} />
      <Route
        path="/admin"
        element={
          <Suspense fallback={null}>
            <AdminScreen />
          </Suspense>
        }
      />
      <Route path="*" element={<WelcomeScreen />} />
    </Routes>
  )
}
```

- [ ] **Step 2: Generalize the dev API middleware in `app/vite.config.ts`**

In the `devApi` plugin: (a) copy all four env vars, (b) mount every API route, (c) add `query` to the request shim (the stats endpoint reads `req.query.period`). Replace the plugin's `configureServer` with:

```ts
configureServer(server) {
  for (const key of ['SYSTEME_API_KEY', 'DATABASE_URL', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }
  const routes: Record<string, string> = {
    '/api/subscribe': '/api/subscribe.ts',
    '/api/events': '/api/events.ts',
    '/api/admin/login': '/api/admin/login.ts',
    '/api/admin/stats': '/api/admin/stats.ts',
  }
  for (const [route, modulePath] of Object.entries(routes)) {
    server.middlewares.use(route, (req: IncomingMessage, res: ServerResponse) => {
      void (async () => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        let body: unknown = {}
        try {
          body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
        } catch {
          // fall through with an empty body; handlers reject it
        }
        const send = (status: number, payload: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(payload))
        }
        // vite strips the mount prefix from req.url; what remains is query string
        const query = Object.fromEntries(
          new URL(req.url ?? '', 'http://localhost').searchParams,
        )

        if (route === '/api/subscribe' && !process.env.SYSTEME_API_KEY) {
          if (req.method !== 'POST') return send(405, { ok: false, error: 'method_not_allowed' })
          const { email, firstName } = (body ?? {}) as { email?: string; firstName?: string }
          if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
            return send(400, { ok: false, error: 'invalid_email' })
          }
          console.log(
            `[dev-api] mock subscribe accepted for ${firstName ? `${firstName} <${email}>` : email} — set SYSTEME_API_KEY in app/.env.local to send real leads`,
          )
          return send(200, { ok: true })
        }

        const mod = await server.ssrLoadModule(modulePath)
        const vercelReq = Object.assign(req, { body, query })
        const vercelRes = {
          status: (code: number) => ({ json: (payload: unknown) => send(code, payload) }),
        }
        await mod.default(vercelReq, vercelRes)
      })().catch((err) => {
        console.error(`[dev-api] ${route} failed:`, err)
        if (!res.writableEnded) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'provider_error' }))
        }
      })
    })
  }
},
```

Keep the existing `EMAIL_RE` constant and the `devApi(loadEnv(mode, __dirname, ''))` call; the plugin signature stays `function devApi(env: Record<string, string>): Plugin`.

- [ ] **Step 3: Add the noindex header in `app/vercel.json`**

Add to the `headers` array:

```json
{
  "source": "/admin",
  "headers": [{ "key": "X-Robots-Tag", "value": "noindex" }]
}
```

- [ ] **Step 4: Document setup in `app/README.md`**

Append a section:

```markdown
## Admin dashboard

`/admin` shows funnel numbers, result patterns, traffic sources, and recent
Systeme.io leads. Setup:

1. Create a free Postgres database at neon.tech and run `db/schema.sql` in its
   SQL editor (once per database).
2. Environment variables (in `.env.local` locally; in Vercel project settings
   in production):
   - `DATABASE_URL` — the Neon connection string
   - `ADMIN_PASSWORD` — the dashboard password
   - `ADMIN_SESSION_SECRET` — any long random string; signs the 30-day session
   - `SYSTEME_API_KEY` — already used by /api/subscribe; also powers the leads list

Anonymous quiz events (never emails, names, or raw answers — result bands
only) are recorded via `/api/events` into the `events` table.
```

- [ ] **Step 5: Full verification**

Run: `npx vitest run` — expected: every file passes.
Run: `npx tsc -b` — expected: no output.
Run: `npm run build` — expected: build succeeds; the main JS bundle does not grow by the dashboard's size (a separate `AdminScreen-*.js` chunk appears in `dist/assets`).

Then live-check with the dev server running (requires the owner's `DATABASE_URL` etc. in `app/.env.local` and the schema applied in Neon):

```bash
curl -s -X POST http://localhost:5173/api/events -H "Content-Type: application/json" \
  -d '{"name":"diagnostic_started","visitorId":"123e4567-e89b-42d3-a456-426614174000"}'
# expect {"ok":true}
curl -s -X POST http://localhost:5173/api/admin/login -H "Content-Type: application/json" \
  -d '{"password":"<the ADMIN_PASSWORD value>"}'
# expect {"ok":true,"token":"..."}
```

Finally open `http://localhost:5173/admin` in the browser: log in, confirm tiles render, complete a quiz run in another tab, refresh the dashboard, and confirm the numbers moved.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx vite.config.ts vercel.json README.md
git commit -m "Wire /admin route, dev API middleware, and deployment config"
```

---

## Post-plan deployment steps (owner + assistant together, not part of the code plan)

1. Owner creates the Neon database and runs `db/schema.sql`; adds the three new env vars to `app/.env.local`.
2. Deploy to Vercel (project root `app/`); set `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SYSTEME_API_KEY`, and `ALLOWED_ORIGIN=https://diagnostic.catholicmarriagelife.com` in Vercel env settings.
3. Add the custom domain `diagnostic.catholicmarriagelife.com` in Vercel; owner adds the CNAME record Vercel displays at their DNS host.
4. Owner points the WordPress "Begin the Diagnostic" button at `https://diagnostic.catholicmarriagelife.com/quiz`.
5. Verify: complete the quiz from the WordPress page, then check `/admin` shows the visit with source `catholicmarriagelife.com` and the lead in Systeme.io.
