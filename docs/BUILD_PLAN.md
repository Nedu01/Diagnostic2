# Marriage Diagnostic App — Build Plan

Turning the Catholic Marriage Life **Marriage Readiness Diagnostic**
(catholicmarriagelife.com/diagnostic) into a standalone app.

---

## 1. Goal & product vision

The existing web diagnostic is *The Marriage Readiness Diagnostic — A Tribunal
Judge's Five-Pillar Self-Assessment for Engaged Catholics*, by Fr. Michael C.
Chime, JCD (President, Interdiocesan Marriage Tribunal, Enugu). It assesses an
engaged person's readiness to give **valid consent** across the Five Pillars —
**Clarity, Freedom, Capacity, Intention, Unity** — in 20 questions (~5 min),
scored out of 40.

The app brings this to mobile: an engaged person — ideally both fiancé(e)s —
takes the diagnostic, receives the scored pillar-by-pillar report with
Fr. Chime's band-specific pastoral feedback, and is guided to next steps: the
free *Reading Your Results* guide (email capture at /diagnostic-report), the
conversations the results call for, and Catholic Marriage Life's book and
mentoring offerings.

Success for v1 looks like:

- A user can complete the diagnostic in ~5 minutes on their phone.
- They immediately see the results report (total /40 with overall band +
  five pillar cards with status and feedback), matching the tone and content
  of the web version.
- The funnel carries over: results drive users to the results guide email
  opt-in, the share action, and the book waitlist.

## 2. Key assumptions (confirm these)

These were made to keep planning moving; each one is cheap to change now and
expensive to change later:

1. ~~**Content ownership**~~ ✅ **Resolved** — the full diagnostic source was
   provided and the complete content (questions, scale, scoring, all feedback
   copy) is now extracted into `content/diagnostic-config.json`, ready for the
   app's scoring engine (see §5).
2. **Platform** — cross-platform mobile via **React Native + Expo**, shipping
   to iOS and Android from one codebase, with the same code reusable as a web
   build later. (If you'd rather start with a PWA or no-code tool, most of this
   plan still applies — see §11 alternatives.)
3. **V1 scope** — anonymous-friendly: users can take the diagnostic and see
   results without creating an account; an optional email capture / account
   saves results. Couple-comparison mode is phase 2.
4. **Monetization** — v1 is free and serves as a lead-generation funnel
   (email capture + links to paid offerings). In-app payments deferred.

## 3. Feature phases

### Phase 1 — MVP (the diagnostic itself)

- Welcome / onboarding: Fr. Chime's introduction, the five pillar chips, time
  expectation, privacy note.
- Question flow: one question per screen, progress bar + current-pillar label,
  back navigation, the three-option scale ("Yes, and I can point to it" = 2 /
  "Not yet, we have not faced this" = 1 / "No, this is not yet true of us" = 0),
  answer-revision behaviour matching the web version.
- Scoring engine: per-pillar (/8) and total (/40) scores from
  `content/diagnostic-config.json` (content-driven — no code change needed to
  tweak questions, thresholds, or copy).
- Results screen: total score with overall band (Strong foundation ≥34 /
  Generally solid ≥26 / Significant gaps ≥18 / Honest concern), overall
  feedback paragraph, then five pillar cards with status (Strong ≥7 / Solid ≥5 /
  Needs Work ≥3 / Concern) and Fr. Chime's per-band feedback, plus signature.
- Funnel actions: "Send me my free results guide" (links to or embeds the
  /diagnostic-report email opt-in) and native share sheet with the existing
  share text.
- Local persistence: results saved on-device so users can revisit them.

### Phase 2 — Accounts & couples

- Accounts (email magic-link or Apple/Google sign-in) syncing results to a
  backend so history survives device changes.
- Retake tracking: retake as engagement progresses ("Not yet" answers are
  designed to become "Yes" as the couple does the work) and see pillar trends.
- **Couple mode**: one fiancé(e) invites the other by link/code; each takes
  the diagnostic privately; the app produces a combined report highlighting
  where the two of them align and where their answers diverge per pillar —
  exactly the "conversations this assessment will open" that the diagnostic's
  own introduction promises. (Flagship differentiator — worth doing well, and
  worth deferring until the solo flow is polished.)

### Phase 3 — Growth & revenue

- Premium tier: deeper report, guided action plans, or content library
  (via RevenueCat to handle App Store / Play Store billing).
- Push-notification nudges: gentle reminders tied to recommendations
  ("You wanted to work on communication this month…").
- In-app content: articles/videos from Catholic Marriage Life.
- Coach/parish dashboard (web): aggregate, anonymized cohort views for
  marriage-ministry leaders — only if demand appears.

## 4. Architecture

```
┌─────────────────────────────┐
│  Mobile app (Expo/React     │
│  Native, TypeScript)        │
│  • question flow UI         │
│  • scoring engine (local)   │
│  • results & recommendations│
│  • local storage (MMKV)     │
└──────────────┬──────────────┘
               │ HTTPS (only when needed)
┌──────────────▼──────────────┐
│  Backend (Supabase)         │
│  • auth (phase 2)           │
│  • results storage (opt-in) │
│  • couple pairing (phase 2) │
│  • content delivery: quiz   │
│    config JSON (versioned)  │
└──────────────┬──────────────┘
               │
   Email provider (results email + list)   Analytics (PostHog)
```

Design principles:

- **Content-driven quiz**: the entire diagnostic (questions, order, scales,
  dimensions, weights, band thresholds, recommendation copy) lives in a
  versioned JSON config, not in code. Editing a question is a content change,
  not an app release. The app bundles a copy and checks the backend for a
  newer version on launch.
- **Offline-first**: the diagnostic runs fully offline; the network is only
  needed for email capture, sync, and config updates.
- **Privacy by default**: answers about someone's marriage are sensitive.
  Nothing leaves the device unless the user opts in (email results / create
  account). This is both the right thing and a strong marketing point.

## 5. Content model — ✅ extracted to `content/diagnostic-config.json`

The complete diagnostic content now lives in a single versioned config file
the app's scoring engine consumes directly:

- **20 questions**, 4 per pillar, in order: Clarity, Freedom, Capacity,
  Intention, Unity.
- **Three-option scale**: 2 ("Yes, and I can point to it"), 1 ("Not yet, we
  have not faced this"), 0 ("No, this is not yet true of us"). No reverse
  scoring, no weights — simple sums.
- **Pillar bands** (score /8): Strong ≥7, Solid ≥5, Needs Work ≥3, Concern <3,
  each with its own feedback paragraph per pillar (20 paragraphs total).
- **Overall bands** (score /40): Strong foundation ≥34, Generally solid ≥26,
  Significant gaps ≥18, Honest concern <18, each with a feedback paragraph.
- **Welcome copy, CTA labels, share text, signature, and the results-guide
  URL** (`/diagnostic-report`) are all in the config too, so app releases are
  never needed for copy changes.

The web page's exact scoring behaviour was preserved (verified against its
JavaScript), so app and website will always agree on a user's result.

## 6. Data model (backend, phase 2)

- `users` — id, email, created_at
- `quiz_versions` — id, config JSON, published_at
- `results` — id, user_id (nullable for anonymous email-only), quiz_version_id,
  answers JSON, dimension_scores JSON, overall_score, taken_at
- `couples` — id, invite_code, user_a, user_b, created_at
- `couple_reports` — couple_id, result_a, result_b, generated comparison

Each spouse's individual answers stay private to them; the couple report only
exposes the agreed comparison view.

## 7. Screens (v1)

1. Welcome / value proposition
2. Privacy & expectations ("your answers stay on your device unless…")
3. Question flow (one per screen, ~N questions, progress indicator)
4. Calculating / transition moment
5. Results overview (overall band + dimension chart)
6. Dimension detail (score, interpretation, recommendations)
7. Email my results / save
8. Settings & about (retake, delete my data, links to the site)

## 8. Tech stack summary

| Concern | Choice | Why |
|---|---|---|
| App | React Native + Expo (TypeScript) | One codebase for iOS/Android, later web; huge ecosystem; fast iteration with EAS builds |
| State | Zustand + quiz config JSON | Lightweight; quiz flow is simple state |
| Local storage | MMKV / AsyncStorage | Offline results |
| Backend | Supabase | Auth, Postgres, row-level security, generous free tier; avoids building a server |
| Email | ConvertKit or Mailchimp API | Results email + list growth (match whatever the site already uses) |
| Analytics | PostHog | Funnel: start → complete → email capture; self-serve and privacy-respecting |
| Payments (ph. 3) | RevenueCat | Abstracts App Store / Play billing |
| CI/CD | EAS Build + Submit, GitHub Actions | Automated store builds |

## 9. Delivery roadmap (solo dev or small team, part-time pace)

| Milestone | Scope | Rough effort |
|---|---|---|
| M0 — Content lockdown | ✅ Done — full diagnostic extracted into `content/diagnostic-config.json` | Complete |
| M1 — Walking skeleton | Expo app, question flow with real content, local scoring, plain results screen | 2 wks |
| M2 — Polished MVP | Designed results report, recommendations, email capture, analytics, app icons/branding | 2–3 wks |
| M3 — Store launch | TestFlight/Play beta with real couples, fix feedback, store listings, review submission | 2 wks |
| M4 — Phase 2 | Accounts, sync, retake trends, couple mode | 4–6 wks |

App Store review note: apps that are "just a quiz/website wrapper" risk
rejection under Apple's minimum-functionality rule (4.2). Saved history,
offline use, tailored recommendations, and (later) couple mode are what make
this clearly an app rather than a wrapped web page — worth keeping M2 scope
intact before submitting.

## 10. Risks & mitigations

- ~~**Content extraction**~~: resolved — the full source was provided and
  extracted (§5). Remaining task: keep the website and app config in sync when
  copy changes (single source of truth is the JSON config; regenerate the web
  embed from it eventually).
- **Sensitive data**: answers about consent, addiction, mental health, and
  family pressure are intimate. *Mitigation:
  local-first design, explicit opt-in for anything leaving the device, easy
  data deletion, and a plain-language privacy policy (also required by both
  app stores).*
- **Not medical/therapeutic advice**: include a clear disclaimer that the
  diagnostic is a reflection tool, not counseling, with pointers to real help
  (e.g. Retrouvaille, Catholic counselors) for low-scoring users — both
  pastorally right and store-compliance-safe.
- **Couple mode complexity**: pairing, privacy between spouses, and combined
  reporting is the hardest feature. *Mitigation: phase 2, designed after real
  users validate the solo flow.*

## 11. Alternatives considered

- **PWA instead of native app**: cheapest path, no store review, instant
  updates — but no store presence, weaker retention (no reliable push on iOS
  until installed), and "there's an app" is part of the value. The Expo
  codebase can target web anyway, so this isn't either/or.
- **No-code (FlutterFlow/Glide)**: fastest demo, but scoring logic, couple
  pairing, and offline-first behavior get painful; migration cost later.
- **Native Swift + Kotlin**: best feel, ~2× cost; unjustified at this stage.

## 12. Immediate next steps

1. ~~Export the diagnostic content~~ ✅ Done — `content/diagnostic-config.json`.
2. You: confirm/adjust the assumptions in §2 (platform, v1 scope, monetization).
3. Me: scaffold the Expo app — question flow, scoring engine, and results
   screens driven entirely by the config file (M1).
