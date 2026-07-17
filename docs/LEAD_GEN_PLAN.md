# Lead-Generation Plan — The Diagnostic as the Engine of catholicmarriagelife.com

Primary goal (restated): **generate leads for www.catholicmarriagelife.com** —
email subscribers who can be nurtured toward the book, mentoring, and other
Catholic Marriage Life offerings. The Marriage Readiness Diagnostic is the
lead magnet; the "app" is whatever form of it converts visitors into
subscribers best.

This supersedes the app-store framing in `BUILD_PLAN.md` for v1: **for lead
generation, a web app wins decisively over a native app.** A native app adds
app-store friction (download, install, review delays) between a visitor and
your email list, and app stores don't send traffic to a niche ministry site.
The website is where the audience already arrives (articles, search, shares);
the diagnostic must convert them *there*. A native app remains a fine phase-3
brand asset — but it is not a lead-gen tool. (BUILD_PLAN.md's architecture,
config-driven content, and couple-mode roadmap all still apply — to the web
first.)

---

## 1. Where the current funnel leaks

Reading the live diagnostic's code, the quiz itself is excellent, but as a
lead-gen funnel it leaks at exactly the moment of highest intent:

1. **All value is given away before the ask.** The user sees their full
   report — total, bands, all five pillar feedbacks — and only *then* is asked
   to opt in for a guide. The strongest quiz funnels show the headline result
   (score + band) immediately, and deliver the *detailed, personalised*
   interpretation by email.
2. **Scores never reach the email list.** The CTA is a static link to
   `/diagnostic-report`; the form there can't know the user scored "Honest
   concern" on Freedom. Every subscriber gets the same generic follow-up,
   when band-segmented sequences are the whole power of a quiz funnel.
3. **Results vanish.** Nothing is persisted — refresh and the result is gone.
   No return visits, no "your results are waiting" recovery email, no retake
   comparison.
4. **No measurement.** Starts, completion rate, drop-off question, opt-in
   rate — none of it is tracked, so the funnel can't be improved.

## 2. The funnel to build

```
Traffic (articles, search, social, shares, parish/priest referrals)
   │
   ▼
Diagnostic (web app, on the site or diagnostic.catholicmarriagelife.com)
   │   completion → headline result shown FREE (score /40 + band + 5 pillar statuses)
   ▼
Email gate: "Get your full pillar-by-pillar report + Reading Your Results guide"
   │   → subscriber created WITH band + five pillar scores as tags/fields
   ▼
Instant email: full personalised report (Fr. Chime's band copy per pillar)
   │
   ▼
Nurture sequence, SEGMENTED BY RESULT:
   • Strong/Solid  → affirm → five-pillars deep-dive series → BOOK WAITLIST
   • Needs Work    → conversation guides per weak pillar → book + mentoring
   • Concern       → gentle, pastoral track → "talk to a priest" resources → mentoring
   ▼
Offers: book waitlist, marriage mentoring, (future) parish/priest licensing
```

Two conversion details that matter:

- **The share loop stays free.** Sharing ("send this to a couple who needs
  it") must never be behind the email gate — it's the organic traffic engine.
- **Both fiancé(e)s = two leads.** After opt-in, the single most natural CTA
  is "Have your fiancé(e) take it too — then compare your answers." Couple
  comparison (BUILD_PLAN §Phase 2) doubles list growth per couple and is a
  compelling return-visit hook.

## 3. What to build (recommended: Option B)

### Option A — Patch the existing Squarespace embed (days of work)
Keep the current Raw HTML block; add an inline email form on the results
screen that posts to the email platform with hidden fields for band + pillar
scores; add analytics events. Cheapest possible fix for leaks #1, #2, #4.
Worth doing immediately even if Option B follows.

### Option B — Standalone web app (recommended, ~2–3 weeks)
A proper web app (Vite + React + TypeScript — the MRS-5 prototype's stack,
rebuilt production-grade) driven by `content/diagnostic-config.json`:

- Hosted at **diagnostic.catholicmarriagelife.com** (Vercel/Netlify, free
  tier), linked from the site's nav exactly as today, and embeddable back
  into Squarespace via iframe if desired.
- Styled to the site's canonical brand (Crimson Text / Open Sans, cream–
  brown–gold), not the prototype's divergent palette.
- Results flow per §2: free headline result → email gate → full report by
  email + on screen after opt-in.
- Backend: one small serverless function + Supabase (or even just the email
  platform's API) to store results and subscribe the user with score fields.
  No client-side API keys of any kind — and **no LLM-generated feedback**;
  every word a user reads is Fr. Chime's fixed copy from the config.
- Resumable/persistent results via localStorage + a unique results URL
  (`/r/abc123`) — shareable with a fiancé(e) or priest, and linkable from
  follow-up emails.
- Analytics (Plausible or PostHog): started, per-question drop-off,
  completed, opted-in, shared.
- SEO landing content around the tool (the Five Pillars explained) so the
  diagnostic page itself can rank and draw traffic.

### Option C — Native mobile app (defer)
Revisit after the web funnel is converting; build with Expo sharing the same
config, per BUILD_PLAN.md.

## 4. Email platform requirements

Whichever platform the site uses (Squarespace Email, Mailchimp, ConvertKit/
Kit, Flodesk — to confirm), it must support: custom fields or tags per
subscriber (overall band + five pillar bands), automation triggered on
signup, and branching/segmentation by those fields. All major platforms do;
the integration is one API call at opt-in:

```
subscribe(email, {
  overall_band: "gaps",
  clarity: "solid", freedom: "concern", capacity: "strong",
  intention: "solid", unity: "needs_work",
  score_total: 24, source: "diagnostic-webapp"
})
```

Sequences to write (content largely already exists in Fr. Chime's band copy
and articles): instant report email; a 5-email "Five Pillars" course; a
weak-pillar conversation-guide email per pillar; book-waitlist invitation;
mentoring invitation for Concern-band subscribers (worded pastorally, with
the "speak with a priest" emphasis preserved).

## 5. Metrics & targets

| Funnel step | Metric | Healthy quiz-funnel benchmark |
|---|---|---|
| Visit → start | start rate | 30–50% |
| Start → complete | completion rate | 60–80% (20 short questions is fine) |
| Complete → opt-in | opt-in rate | 30–50% with gated full report |
| Opt-in → sequence engagement | open/click | 40%+ opens for result emails |
| Subscriber → offer | book waitlist / mentoring clicks | track from day one |

Review monthly; the per-question drop-off report tells you if any question
is losing people.

## 6. Sequenced roadmap

| Step | What | Effort |
|---|---|---|
| 1 | Option A patch on the live embed (email form + score fields + analytics) | days |
| 2 | Confirm email platform; build the segmented welcome sequence | ~1 wk (mostly writing) |
| 3 | Option B standalone web app at diagnostic.catholicmarriagelife.com | 2–3 wks |
| 4 | Couple-comparison results (two-leads-per-couple loop) | +2 wks |
| 5 | Retake reminders, priest/parish referral page, SEO content around the tool | ongoing |
| 6 | Native app (Expo) if/when the funnel justifies it | later |

## 7. Decisions needed from you

1. Which email platform does the site use today (and is `/diagnostic-report`
   already wired to it)?
2. Approve the gating change: headline result free, full pillar report after
   email opt-in. (This is the single highest-impact change; if it feels too
   aggressive pastorally, the fallback is showing everything and gating only
   the *Reading Your Results* guide + emailed copy — lower conversion, gentler.)
3. Subdomain vs embedded: diagnostic.catholicmarriagelife.com (recommended)
   or keep everything inside Squarespace?
