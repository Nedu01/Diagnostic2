# Diagnostic Follow-Up Email Sequence

Nine emails, triggered when a contact receives the `diagnostic-completed`
tag (which the app applies to every lead). Written in Fr. Chime's voice per
the band copy in `content/diagnostic-config.json` and the manuscript.

**Setup notes for Systeme.io**

- One campaign: "Diagnostic Nurture". Automation rule: *Tag added:
  diagnostic-completed → Subscribe to campaign: Diagnostic Nurture*.
- `[FirstName]` below = insert the editor's **Personalization → First name**
  variable. Where a greeting must survive a missing name, the sentence is
  written to read naturally either way ("Dear [FirstName]," → "Dear friend,"
  fallback if the editor supports one; otherwise use "Dear friend" alone in
  Emails 8–9 which lean pastoral).
- Links used: https://diagnostic.catholicmarriagelife.com/quiz (the
  diagnostic), https://www.catholicmarriagelife.com/five-pillars-of-valid-consent
  (pillar article), https://www.catholicmarriagelife.com/book-waitlist (book),
  https://www.catholicmarriagelife.com/diagnostic-report (Free Edition
  opt-in/download), https://www.catholicmarriagelife.com/contact (reach a
  priest / consultation).
- **Segmented variants** (marked ⭑) require the tags `band-concern` /
  `band-gaps`, which the current Systeme plan cannot create. Until the plan
  is upgraded or tags are freed, send the universal versions only — they are
  written to hold every reader.

---

## Email 1 — Day 0, immediately

**Internal name:** 01 Your report is unlocked
**Subject:** Your Marriage Readiness results — and how to read them
**Preview text:** The score matters less than the conversations it opens.

Dear [FirstName],

Thank you for taking the Marriage Readiness Diagnostic honestly. Honesty is
the only way it works.

Your full pillar-by-pillar report is unlocked on the results page you just
saw. Before you read it again, let me tell you how a tribunal judge reads
such results.

I do not look first at the number. I look at the pillars — Clarity, Freedom,
Capacity, Intention, Unity — because a marriage does not fail by
percentage. It fails at a pillar. A couple can score well overall while one
quiet pillar carries a crack that twenty years of tribunal files have taught
me to recognise.

So read your report this way:

1. **Find your strongest pillar.** Thank God for it aloud, together. It is
   real, and it was built by real choices.
2. **Find your weakest pillar.** Do not be ashamed of it. Every couple has
   one. The engaged couples who frighten me are not the ones with a weak
   pillar — they are the ones who have never looked.
3. **Have one conversation about that weakest pillar this week.** Not to
   solve it. Simply to say it aloud to each other.

One more thing, and it matters: this diagnostic measures *your* readiness,
answered alone. Your fiancé(e)'s answers may differ from what you assume.
Ask them to take it too, then compare — question by question, without
defending yourselves:

**[Button] Send the diagnostic to your fiancé(e) →** https://diagnostic.catholicmarriagelife.com/quiz

In the coming days I will walk you through each of the five pillars — what
it means, why marriages fail there, and the one conversation each pillar
asks of you before your wedding day.

In Christ,
Fr. Michael C. Chime, JCD
President, Interdiocesan Marriage Tribunal, Enugu
*Ad Maiorem Dei Gloriam*

⭑ **Concern-band variant (needs `band-concern` tag):** replace paragraph 3
with — "Your results include areas of honest concern. I want to say this
plainly and gently: a result like yours is not a verdict on your love, and
it is not rare. It is the most valuable result this diagnostic can give,
because it arrived *before* your wedding day rather than in a tribunal file
after it. Please do two things: read your report slowly, and make time this
week to speak with a priest — not because something is wrong with you, but
because something important deserves care."

---

## Email 2 — Day 1

**Internal name:** 02 The certainty trap
**Subject:** "Father, we were so sure."
**Preview text:** The sentence I have heard more than any other.

Dear [FirstName],

In twenty years of tribunal work, one sentence has reached my desk more
often than any other: *"Father, we were so sure."*

Not "we were foolish." Not "we rushed." *Sure.* The couples whose cases I
read were, almost without exception, certain on their wedding day. Their
certainty was sincere. It was also unexamined — and sincerity is not the
same thing as examination.

That is why I wrote *Before You Say "I Do" At the Altar* — and why the
first part of it, the part that shows you what the tribunal side of the
altar looks like, is free. It contains the case files (names changed,
truths intact): couples who would have answered your diagnostic confidently
and wrongly, and the three paths by which sure couples arrive at a
tribunal.

**[Button] Get the Free Edition →** https://www.catholicmarriagelife.com/diagnostic-report

Read it with your fiancé(e). It asks nothing of you but honesty — and it
will make the pillar emails that follow this one land differently.

In Christ,
Fr. Michael C. Chime, JCD
*Ad Maiorem Dei Gloriam*

---

## Email 3 — Day 3 (Five Pillars course 1/5)

**Internal name:** 03 Pillar of Clarity
**Subject:** Pillar One: Do you know what you are promising?
**Preview text:** Most couples can recite it. Few have examined it.

Dear [FirstName],

The first pillar is **Clarity**: knowing, in your own words and not the
Church's borrowed ones, what lifelong Catholic marriage will actually
demand of you.

Here is the test I apply, and it is severe: could you explain to someone
who doubted it why your marriage cannot simply be ended — and would your
answer go beyond "because the Church says so"? Could your fiancé(e) name
the single demand of permanence that *you* will find hardest? Could you
name theirs?

Canon law calls marriage a partnership of the whole of life. Every word in
that phrase has teeth. *Whole* — not the parts you enjoy. *Life* — not
until the feeling fades. Couples do not fail because the standard was
hidden from them; they fail because they recited it without ever holding
it up against their own particular selves.

**This week's conversation:** each of you, separately, write one sentence
completing this: "The demand of lifelong marriage I find hardest is ___."
Then exchange sentences. If you both guessed each other's correctly, your
Clarity is real. If either of you was surprised — that surprise is the
conversation.

**[Button] Read: The Five Pillars of Valid Consent →** https://www.catholicmarriagelife.com/five-pillars-of-valid-consent

Next: the pillar the tribunal sees broken most often — and it is not the
one couples expect.

In Christ,
Fr. Michael C. Chime, JCD
*Ad Maiorem Dei Gloriam*

---

## Email 4 — Day 5 (course 2/5)

**Internal name:** 04 Pillar of Freedom
**Subject:** Pillar Two: Whose choice is this wedding?
**Preview text:** Pressure rarely announces itself.

Dear [FirstName],

The second pillar is **Freedom** — and I must be direct with you, because
the files on my desk are direct with me: consent that is not free is not
consent, and no ceremony can repair it.

Pressure rarely arrives wearing its own name. It arrives as a family's
expectations, as money already spent, as the quiet arithmetic of age, as a
pregnancy, as the sheer momentum of a wedding that has become too large to
stop. None of these people mean harm. All of them can carry a person to an
altar their heart never chose.

So ask yourself the question I would ask you across my desk: *if a serious
reason to delay appeared next week, could you actually stop the plans?*
Not "would you want to" — could you, facing the embarrassment and the
deposits and the aunties? If the honest answer is no, then it is not the
wedding that is carrying you. Something else is, and it deserves to be
named before it stands beside you at the altar.

**This week's conversation:** tell each other the story of the moment you
each *chose* this marriage — the actual moment, place, and reason. If
either of you cannot find such a moment, do not panic, and do not proceed
past it either. Bring it to the priest preparing you.

**[Button] Take the diagnostic together →** https://diagnostic.catholicmarriagelife.com/quiz

In Christ,
Fr. Michael C. Chime, JCD
*Ad Maiorem Dei Gloriam*

---

## Email 5 — Day 7 (course 3/5)

**Internal name:** 05 Pillar of Capacity
**Subject:** Pillar Three: Love is not the same as capacity
**Preview text:** The hardest truth in the tribunal's files.

Dear [FirstName],

The third pillar, **Capacity**, holds the hardest truth I know: a person
can love sincerely and still lack, at this moment, what daily married life
requires. Love is the fuel; capacity is the engine. A tribunal sees what
happens when a marriage has one without the other.

Capacity is unglamorous. It is whether each of you runs an adult life
without being rescued — work, money, commitments kept. It is what happened
the last time a plan collapsed: did you recover together, or fall apart,
or turn on each other? It is whether the struggle one of you carries — and
many of us carry one: drink, debt, a compulsion, an untreated wound of the
mind — has been *named aloud* between you and acted upon, or politely left
in the dark on the assumption that marriage will settle it.

Hear a tribunal judge on that assumption: marriage settles nothing. It
multiplies what it is given. Given honesty and treatment, it multiplies
healing. Given concealment, it multiplies exactly that.

**This week's conversation:** each of you answer, aloud: "The thing I am
most tempted to hope marriage will fix is ___." Then decide, together, one
real step to address it *before* the wedding instead.

**[Button] The Free Edition — the case files behind this pillar →** https://www.catholicmarriagelife.com/diagnostic-report

In Christ,
Fr. Michael C. Chime, JCD
*Ad Maiorem Dei Gloriam*

---

## Email 6 — Day 9 (course 4/5)

**Internal name:** 06 Pillar of Intention
**Subject:** Pillar Four: What are you actually saying yes to?
**Preview text:** The words at the altar are fixed. The intention is yours.

Dear [FirstName],

The fourth pillar is **Intention**. At the altar, the Church's words will
be in your mouth — but the intention behind them will be entirely your
own, and it is the intention, not the recitation, that makes the marriage.

The Church intends four things by marriage: a union that is *faithful*,
*permanent*, *fruitful*, and *unconditional*. A private reservation
against any one of them — a quiet "unless," a hidden refusal of children,
an exit held in reserve, a benefit that is the real reason — does not
merely weaken the marriage. It can mean that no marriage occurs at all,
whatever the photographs show. I have signed too many declarations that
say precisely this.

The examination is simple to state and demanding to do: *is there anything
about this marriage you would be afraid to say aloud to your fiancé(e)
before the wedding?* If yes, that unsaid thing is not protecting the
marriage. It is the case file forming.

**This week's conversation:** the four intentions, one evening, no
audience: faithful — permanent — open to children — for this person alone,
benefits aside. Speak your yes to each one *in your own words*, and let
your fiancé(e) hear where the words come easily and where they do not.

**[Button] Read: What Is an Annulment →** https://www.catholicmarriagelife.com/what-is-an-annulment

In Christ,
Fr. Michael C. Chime, JCD
*Ad Maiorem Dei Gloriam*

---

## Email 7 — Day 11 (course 5/5)

**Internal name:** 07 Pillar of Unity
**Subject:** Pillar Five: One life, or two lives sharing an address?
**Preview text:** The pillar that decides what daily marriage feels like.

Dear [FirstName],

The final pillar is **Unity** — whether you are building one life or
politely running two. Of the five, this is the one that decides what your
marriage will *feel like* on an ordinary Tuesday in year eleven.

Unity is tested, never declared. It is tested when money is spent, when
family intrudes, when the faith is practised or postponed, when the last
three disagreements happened — did anyone go silent for days, walk out,
reach for the threat of ending it? It is tested by whether the great
questions — where you will live, how money will work, how children will
be raised and in what faith — are actually *settled*, or merely
postponed conversations wearing engagement rings.

And it is tested by something so ordinary it is almost embarrassing to
name: setting the wedding aside, do you have a plain, unremarkable
friendship you both enjoy? The wedding lasts a day. The friendship is the
marriage.

**This week's conversation:** describe to each other what an ordinary,
unremarkable week of your married life will look like — not the honeymoon,
the *Tuesday*. Where the two descriptions differ, you have found the work.

You now have all five pillars. In two days, I will show you the difference
between knowing them and having examined them — the difference on which
everything I have written turns.

In Christ,
Fr. Michael C. Chime, JCD
*Ad Maiorem Dei Gloriam*

---

## Email 8 — Day 13

**Internal name:** 08 The examination
**Subject:** Knowing about the pillars is not examining them
**Preview text:** The distinction my whole book turns on.

Dear friend,

You have now read all five pillars. Let me tell you what that has given
you, and what it has not.

Scholastic philosophy distinguishes *notional* knowledge — knowing about a
thing — from *operative* knowledge: knowledge that has passed through you
and changed how you act. You now have notional knowledge of the five
pillars. Every couple whose case file I have read had at least that. What
they lacked was the examination: the written, spoken, unhurried work of
holding their own particular engagement up against each pillar in turn.

That examination is what my complete book, *Before You Say "I Do" At the
Altar*, exists to give you: the full case files for all five pillars, the
written examinations, the Seven Conversations, the freedom test, the One
Thing Exercise — a structured path that begins, incidentally, exactly
where you began: with your diagnostic results, giving your weakest pillar
the most unhurried attention.

The book is completing its journey to publication now. The waitlist is
where I will reach first — with the earliest copies and the best price I
will ever offer it at:

**[Button] Join the book waitlist →** https://www.catholicmarriagelife.com/book-waitlist

If you have not yet read the Free Edition, begin there today — it costs
only honesty: https://www.catholicmarriagelife.com/diagnostic-report

In Christ,
Fr. Michael C. Chime, JCD
*Ad Maiorem Dei Gloriam*

---

## Email 9 — Day 15

**Internal name:** 09 The pastoral close
**Subject:** Whatever your results said — read this last one
**Preview text:** A word I say to every couple, whatever their score.

Dear friend,

This is the last email of this series, and I have kept the most important
thing for it.

Whatever your diagnostic said — strong foundation or honest concern — the
result was never the point. The conversations were. If these two weeks
have started even one conversation you had been postponing, then the
diagnostic has done its work, and so have you.

But some things are too important for a score and an email course, and
this is one of them: **please bring what you have found to a priest.** Not
because something is wrong — because something is *sacred*. The priest
preparing you can do more with one honest hour than any diagnostic can do
with twenty questions. Show him your results. Tell him which pillar was
weakest. Ask him the question you have been carrying. That conversation is
what all of this was built to begin.

If you do not know where to start, start here: https://www.catholicmarriagelife.com/contact

And one final ask, the one I make of every couple: you know another couple
who needs this. Engaged, or about to be, sure of themselves the way every
couple in my files was sure. Send them the diagnostic. It is free, it is
five minutes, and it may be the kindest thing anyone does for their
marriage:

**[Button] Share the diagnostic →** https://diagnostic.catholicmarriagelife.com/quiz

It has been an honour to walk these pillars with you. May God bless your
engagement, your wedding day, and the long, ordinary, holy life after it.

In Christ,
Fr. Michael C. Chime, JCD
President, Interdiocesan Marriage Tribunal, Enugu
*Ad Maiorem Dei Gloriam*

⭑ **Concern-band variant (needs `band-concern` tag):** insert before the
final ask — "And if your results landed in honest concern, hear me once
more: a delayed wedding is recoverable. A null marriage is a wound that
lasts. The bravest thing an engaged person can do is slow down long enough
to be sure — and no one who ever did so, in twenty years of my ministry,
regretted it. If you would like help finding the right person to talk to,
reply to this email. It reaches my ministry, and it will be answered."

---

## Future segmented sequences (when tags become available)

| Tag | Addition |
| --- | --- |
| `band-concern` | Use both ⭑ variants; add a Day 4 standalone pastoral email inviting a consultation; soften course CTAs (pastoral emphasis, no sales pressure). |
| `band-gaps` | Day 13 email leads with the 15-day Examined Consent Program framing ("your results name the pillars; the program is the path"). |
| `pillar-<name>-concern` | Day 13 email names the reader's weakest pillar and the premium exercise that addresses it (e.g. Intention → the One Thing Exercise). |
| `premium-owner` (post-purchase) | 15-day program delivery sequence, one email per program day — to be written when premium launches. |
