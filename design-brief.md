# cityblend card — design brief

Written 2026-08-05, after the "Night Line" card had been live for two weeks and
three attempts to recolour it were all rejected. Those attempts failed because
they were variants without a brief. This is the brief.

The card design decided in week 3 is recorded in [spec.md](spec.md) under *Card
design — "Night Line"*. That section stays as the record of what was built and
why. This document is the input to redesigning it.

---

## 1. The job

**The card has to make a stranger type a URL from memory.**

That is the whole product loop and it is a brutal conversion ask. Someone sees a
full-bleed image in a story, for perhaps two seconds, on a phone, while tapping
through. No link is guaranteed — the person posting may or may not add a link
sticker, and the two most-shared cards so far went out without one. Everything
on the card competes for the attention needed to read and remember
`cityblend.app`.

Every design decision should be checked against that sentence.

### Two audiences, different needs

| | who they are | what they need from the card |
|---|---|---|
| **The owner** | the person who made it | something they are proud to post — flattering, true, specific to them |
| **The viewer** | scrolling past it | to understand what this *is* in about two seconds, and want one |

The owner already knows their own cities and can decode anything. The viewer
knows nothing. **The card must be legible cold.** Any element that only makes
sense once you already understand the product is spending attention the viewer
does not have.

### What we are NOT designing for

- Not a dashboard. There is no data to explore.
- Not a keepsake. It gets posted, seen, and disappears in 24 hours.
- Not a Spotify Wrapped card. Wrapped can be cryptic because everyone already
  knows the format. We have no such licence.

---

## 2. What the content actually is

Measured from 51 real live cards (2026-08-05). The week-3 design was drawn
before any of this was known.

| | min | median | p90 | max |
|---|---|---|---|---|
| identity (chars, after "the ") | 7 | **11** | 13 | 15 |
| joke (words) | 5 | **13** | 16 | 20 |
| joke (chars) | 27 | **73** | 90 | 111 |
| stops | 2 | **4** | 6 | 7 |

Stop-count spread: `2:12 · 3:8 · 4:10 · 5:14 · 6:5 · 7:2`

**Three things follow that the current design does not exploit:**

1. **The identity is reliably short and always one word.** 7–15 characters,
   median 11. Only **1 of 51** exceeded 14 characters. The current card carries
   a whole fit-and-scale mechanism for a two-line identity that fires about 2%
   of the time. The identity can be set very large at a near-fixed size.
2. **The joke is short prose, and 27% is two sentences.** Median 13 words. It
   needs 2–4 lines of comfortable measure, not a headline treatment.
3. **Short paths are the most common single case.** Two stops is the largest
   bucket (12 of 51). The design is currently tuned to survive 8 stops; it
   should be tuned to *look best* at 2–5, and merely survive 7.

---

## 3. Fixed — do not redesign these

Non-negotiable, with the reason. Numbers are verified, not assumed.

- **9:16, 1080×1920.** Instagram's documented Stories asset size.
- **Safe area.** Top ~13% and bottom ~18–20% sit under platform UI. All content
  inside that band. Worst case measured bottoms out at ~79.5% of card height.
- **Contrast floors.** 4.5:1 for normal text, 3:1 for lines, rings and large
  bold type. Measured at real rendered size, not eyeballed. This has already
  been violated twice and caught twice; it is not negotiable.
- **The per-person colour.** Nine curated colours, hashed from the **whole
  path** (not the current city — current city collapses in a Barcelona expat
  network where everyone shares it). Stable across rerolls, so the card stays
  *theirs*.
- **The route.** Sequence of stops with origin and now marked. This is the only
  element that makes the card not a generic quote card, and the only thing
  carrying the transit idea. **The treatment is open; the element is not.**
- **`cqw` units only, never `cqh`** — block-axis container units silently
  measure against the viewport under `container-type: inline-size`.
- **Preview and export must be identical.** The on-page card and the canvas PNG
  are two renderers of one design. Whatever is built must be buildable in both.
- **No trademarked transit identity.** No TfL roundel. Johnston/Underground
  styling is off-limits.
- **The CTA stays.** `and you? → cityblend.app` is the conversion mechanism.
  Its treatment is open; its presence is not.

---

## 4. Open — everything else

- Ground: dark, light, coloured, textured, gradient.
- Whether the ground is constant across cards or varies per person.
- Composition and proportion, including deliberate asymmetric splits.
- Type: currently a system Helvetica stack, chosen because Helvetica is NYC
  subway signage. A webfont is available if the concept wants one — the export
  path already awaits `document.fonts.ready`, so it is a small change, but it
  **must** be remembered or exported PNGs silently render in the fallback face.
- Case. Currently Title Case for cities, lowercase for the identity and joke.
- Whether the wordmark, handle and stop badge earn their space at all.
- Whether the route is vertical.

---

## 5. The central decision

**The card currently sits between two references and commits to neither.** That
is the most likely reason it reads as unremarkable rather than wrong.

| | printed metro diagram | departure screen |
|---|---|---|
| ground | flat, paper, often **light** | emissive, **dark** |
| colour | flat spot colour | glow, gradient |
| texture | ink, halftone, misregistration | scanlines, pixel grid |
| type | crisp, Title Case | monospaced, all-caps |

What exists today is **diagram grammar rendered as though on a screen**: flat map
elements on a near-black ground. Both readings are present; neither is
committed to.

**Pick one and go all the way.** A third option is legitimate — abandon the
transit reference entirely and find another — provided the route survives as an
element.

Two arguments to weigh honestly, both real:

- *For dark:* the week-3 rationale was that a dark card stands out against
  light-mode backgrounds in feeds and DMs. That is about **thumbnails**, not
  about the concept, and it is a genuine consideration.
- *Against dark:* it is a category default. Every music, film and finance app
  is near-black. A committed light or coloured card is rarer and more likely to
  interrupt a scroll.

---

## 6. How a direction gets judged

In this order. A direction that fails an early one is out regardless of how it
scores later.

1. **Legible cold.** Would a viewer who has never heard of this understand what
   they are looking at in two seconds?
2. **Contrast holds** at real rendered size, across all nine colours, at 2 and
   at 7 stops. Checked with numbers.
3. **Would the owner post it?** Flattering enough to want to, specific enough to
   feel like theirs.
4. **Distinguishable from a friend's.** Five cards posted the same night should
   look like a thing spreading, not one template five times.
5. **The URL survives.** Still readable and memorable at thumb-scroll speed.
6. **Does it look like anything else?** If it reads as a Wrapped variant it has
   lost the one positioning advantage week 3 identified.

---

## 7. Dead ends — established, do not repeat

All three were built, shipped behind a flag, and rejected on 2026-08-05.

- **Saturated colour as the whole ground.** The card needs three levels —
  ground, text, accent. On full-strength colour the only lighter accent is
  white, which measures **1.30:1 to 2.64:1** across the nine colours against the
  3:1 a line or ring needs. The badge and route flatten into the type: four
  tones become two. *Any* direction using a saturated ground must solve this
  first.
- **Deepening the ground toward the person's colour.** At 16% it sits **1.11:1**
  from the original near-black — imperceptible; it shipped and was genuinely
  invisible. Pushed until it reads as colour at all, the muted route labels fall
  to **3.71:1** and below, because `#78848C` was chosen against near-black.
  There is no strength that is both visible and legible.
- **A colour field whose height is set by the content.** The band ended where
  the route began, so it landed at a different proportion on every card. A split
  that moves per card cannot read as designed. **If a split is used, fix the
  ratio and make the type fit it** — the fit loop already scales type, so this
  is mechanically available.

---

## 8. Honest gaps

- **No conversion evidence.** Zero shares have been attributed to a card, and
  no referral traffic has been traced to a posted story. Every design argument
  here — including "dark stands out in a feed" — is reasoning, not measurement.
  Instrumentation now exists (card ids, share/download/reroll joined back,
  abandon beacons), so this is answerable, but it needs traffic first.
- **The Instagram crop is unresolved.** On a taller-than-9:16 screen, Stories
  either letterboxes or fills-and-crops. Sources disagree. Current padding errs
  cautious, which can only waste space rather than lose content. One real
  posted card would settle it.
- **One judge.** All taste calls to date are Sofia's, blind where possible. That
  is the best instrument available and it is still one person.

---

## 9. How to run it

1. **Commit to a reference first** (§5). Everything else follows from it, and
   nothing should be drawn before it is chosen.
2. **Draw against real content** (§2) — a 2-stop card and a 7-stop card, with a
   median joke and a 20-word joke. Not lorem, not a favourite example.
3. **Two directions maximum, fully committed**, rather than five hedged ones.
   Tonight's failure was variants without a thesis.
4. **Check §6 in order**, with numbers where numbers apply.
5. **Ship behind `?theme=`** and compare on a phone, in a story, at night —
   never on a desktop monitor. That is where the card is actually seen.
