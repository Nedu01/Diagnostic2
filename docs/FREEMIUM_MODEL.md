# Freemium Model — *Before You Say "I Do" At the Altar*

How the manuscript converts into a two-tier product that feeds the
catholicmarriagelife.com funnel. The generated documents:

- `BEFORE_YOU_SAY_I_DO_Free_Edition.docx` — the lead magnet (~68 pages)
- `BEFORE_YOU_SAY_I_DO_Premium_Program.docx` — the paid product (~291 pages)

Both were produced by XML-splitting the original manuscript, so pagination,
typography, and formatting match the source exactly.

## The split logic

The manuscript has a natural freemium seam:

| | Contents | Job |
|---|---|---|
| **Free Edition** | Front matter, Foreword, Author's Note, How to Use This Book, Introduction (Adaeze), **Chapters 1–4** (The Certainty Trap, First Hour of a Case File, What the Church Requires, Three Paths Leading to Tribunal), + new closing chapter "Where the Examination Begins" | Create the *need*: the reader sees the tribunal side of the altar, meets couples whose certainty was never examined, and learns the questions exist — but not the examinations. Ends exactly where the book pivots to the pillar examinations. |
| **Premium Program** | The **complete book** (all 17 chapters, Conclusion, Appendices, Glossary, Notes, Discussion Questions) + new front section **"The Examined Consent Program — From Notional to Operative Knowledge of the Five Pillars"** | Deliver the *transformation*: the examinations themselves plus a structured method for doing them. |

Free gives away Part One in full — generous enough to be genuinely shareable
and to establish Fr. Chime's authority — while every examination tool
(Seven Conversations, written examinations, freedom test, One Thing Exercise,
same-marriage examination) is premium-only.

## The transformation method (why premium delivers, not just informs)

The premium program operationalizes the book's own central distinction:
reading produces **notional** knowledge; only examination produces
**operative** knowledge. The Examined Consent Program prescribes five
movements per pillar — the most efficient known path from knowing-about to
operative knowing:

1. **Read the cases** (recognition — see yourself in the file)
2. **Study the standard** (the canon, precisely)
3. **Write the examination** (by hand, alone, before discussion — "written
   honesty arrives before managed speech")
4. **Speak it aloud** (structured couple conversations, one topic per sitting)
5. **Bring findings to your priest** (the pastoral checkpoint; gap vs defect)

Sequenced as a **15-day path** (spreadable to six weeks), with a
**diagnostic-personalized entry point**: take the Marriage Readiness
Diagnostic first; your weakest pillar gets the most unhurried attention;
retake after finishing to see the change. This closes the loop with the web
app — the diagnostic is simultaneously the top of the funnel and the
program's progress instrument.

## Funnel integration

```
Articles / shares / parish referrals
        │
        ▼
Marriage Readiness Diagnostic (web app)────────► Systeme.io lead
        │  free headline result, gated report        with band + pillar tags
        ▼
FREE EDITION (delivered by email as PDF/EPUB — the "Reading Your Results"
        │      companion offer, or downloadable from the site)
        ▼
PREMIUM: complete book + Examined Consent Program (paid)
        │
        ▼
Mentoring / book waitlist / parish licensing
```

Systeme.io automation mapping (tags already emitted by the app):
- `diagnostic-completed` → deliver report email + offer the Free Edition
- `band-*` → segmented nurture; `band-gaps` / `band-concern` sequences
  emphasize the examinations and pastoral urgency (pastorally worded)
- `pillar-<name>-<band>` → the sales email can name the reader's actual weak
  pillar and the specific premium exercise that addresses it (e.g.
  "pillar-intention-concern" → the One Thing Exercise)
- Purchase → tag `premium-owner`, start the 15-day program email sequence
  (one email per program day is a natural premium-delivery upgrade)

## Pricing & packaging guidance

- **Free Edition**: $0, email-gated download (the email capture IS the price).
- **Premium**: complete book + program. Typical range for this format:
  $19–29 ebook-only; $49–79 as a "program" (book + 15-day email course +
  printable examination worksheets); $149+ if bundled with a group cohort or
  a session with a marriage mentor. Recommend launching at the program tier —
  the notional→operative transformation is the value story, and a bare ebook
  undersells it.
- Keep the physical book (Amazon etc.) at normal book pricing; the *program*
  is the differentiated direct-sales product the funnel drives to.

## Production notes / next steps

1. Fill the bracketed placeholders in the front matter (ISBNs, designer,
   printing) before publishing either edition.
2. Optional: generate EPUBs from the docx files for e-reader delivery.
3. Optional: extract the five written examinations into standalone printable
   worksheets (premium bonus, one per pillar).
4. Wire the Free Edition download into Systeme.io as the deliverable of the
   diagnostic report email; wire the premium checkout (Systeme.io supports
   payments) to tag `premium-owner`.
5. The 15-day program maps 1:1 to a Systeme.io email sequence — the copy for
   each email already exists as the program-day descriptions.
