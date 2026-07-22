# cityblend — product spec

## What this is

A web app where someone enters the cities they've lived in (born → now), and gets a shareable card with a funny blended "identity" name, a dry one-line comment, and a visual timeline of their path. Built to launch fast, validate whether it spreads organically, and learn the end-to-end process of shipping something solo.

## Goals

User goal: self-expression / identity content for expats and multi-city people — something that says "here's who I've become," worth posting because it's about them, not just a stat.

Product goal (this version): not revenue, not signups. The one metric that matters: did anyone besides Sofia generate a card and share/download it, organically, without being personally asked. That's the signal that decides whether idea #2 is worth building.

Distribution: not Instagram-exclusive. Optimized for Instagram/WhatsApp Stories (9:16 export) since that's the primary seeding channel, but the artifact itself (image + link) is platform-agnostic.

## Inputs

- **Handle/name** — free text, shown on the card so it makes sense out of context (screenshots lose captions). Max ~30 characters.
- **Birth city** — required, free text (not a country picker — cities carry more personality; someone can type "Cyprus" if that's genuinely how they'd answer).
- **City you live in now** — required, separate field from birth city. If someone has never left, they enter the same city in both — this is how the "never moved" case is handled, rather than needing a special zero-stops state.
- **Cities lived in between**, in chronological order — repeatable free-text field, optional. Max ~40 characters per city.
- **Cap**: 8 cities total, enforced at input (based on general list-UX guidance converging around 8-10 items, cognitive chunking research (~7±2), and our own visual stress test — 8 held up, the text line was already at its limit).
- **Years per stop** — optional. If given, used to weight which places matter most in the generated name/line. If skipped, default logic: birthplace = anchor, most recent/current city = heaviest.

## Output (the card)

- Handle, top, small/muted
- Identity name (e.g. "the moscelonian") — AI-generated portmanteau, large
- One dry line of commentary — AI-generated, single consistent deadpan voice (calibrated to the input, not hyped up for impressive paths or mocking for boring ones — the "barely qualifies, moved 30km" test case is the tonal north star)
- Visual timeline: dots connected by a line in chronological (not geographic) order. Last dot (current city) larger/different color = "home now."
  - Chronological, not geography-accurate — real relative positions require an actual map backdrop to read correctly and would fight the narrative. Shelved as a stretch goal, not v1.
  - Single-city case (never moved): one dot, no line. Chosen line: "one hometown, zero passport stamps."
- General prompt-writing rule: favor a concrete, specific, countable detail ("moved 30km" — the specificity is the joke) over a closing cliché like "no notes" / "no regrets," which reads as filler, not observation.
- Text list of the full path underneath the graphic (the "receipt" — visual alone doesn't reliably convey unusual city names, especially at 6-8 stops)
- Footer, baked into the image itself: "and you? → cityblend.app"
  - Hook + destination combined — "and you?" invites the viewer to participate, the domain tells them where. Must be literal text on the image, not a clickable element — once downloaded/screenshotted to a story it's a flat image, no live links.
  - Longer explainer phrases (e.g. "what's your geographical identity") belong on the site's headline, not the card footer — footer needs to stay short.
- Export: 9:16 image, downloadable
  - Visual polish (typography, color, spacing) is pure front-end rendering — zero API cost either way. "Pretty" and "cheap" aren't in tension here.

## Tone / voice

Single consistent voice for all outputs. No tone switch/toggle in v1.

Voice = deadpan, self-aware, calibrated to the material rather than always reaching for "impressive."

## Naming / branding

- App name: cityblend
- Domain: cityblend.app (~€9-15/yr; .com is squatted at ~€4,248, skip it)
- Quick check done: no active product/trademark conflict found — a dormant, unused @cityblend X handle, and "City Blend" as a generic coffee-roast term (different category, low risk). Worth a final domain-availability check on the actual registrar before buying.

## Technical approach

- Web app, mobile-first, no native app
- No accounts/login — form → generated card
- Name/line generation: live call to the Claude API per submission (serverless function, key never exposed client-side). Haiku-class model is likely sufficient for this task; test quality before reaching for a pricier model.
- Hosting: Vercel or Netlify, free tier
- Build and run this on a personal Anthropic account, not the company one. Actual API costs are small enough (see below) that the "saves company spend" argument doesn't hold up much value against the downside: many employment contracts have IP-assignment language that can extend to things built with company tools/accounts, regardless of cost. Worth a direct conversation with your manager if you want to use company tools for personal-project learning in general — better than inferring it's fine.

## Cost & abuse protection

- Rate limit: 3 generations per hour, enforced primarily by IP (not session — session/cookie-based limits are trivially bypassed and only useful for showing the user their own remaining count in the UI).
- Global daily cap on total generations, independent of per-IP limits — bounds worst-case cost regardless of how a spike happens.
- Needs a small persistent store to track counts across requests (serverless functions are stateless) — Vercel KV or Upstash Redis, both have free tiers sufficient for this scale.
- Input length caps (city ~40 chars, handle ~30 chars) — bounds prompt size predictably and closes off basic prompt-stuffing/injection attempts. Treat all user input strictly as data in the prompt template, not instructions.
- Regenerate button consumes the same rate limit — otherwise it's a free way to bypass the cap entirely. Communicate the remaining count clearly near the button (e.g. "2 of 3 left this hour") so it doesn't feel broken.
- Realistic cost estimate: each generation costs a small fraction of a cent (short input + ~50-60 word output, lightweight model). Even at 1,000 cards/day for a month, total API spend lands roughly in the $15-25 range. Domain is ~€10-15/year. Hosting, KV store, and analytics (see below) are free at this scale. Total realistic cost for the whole test phase: well under $50.

## Content filter

Single mechanism covers both offensive content and unrelated/nonsense input (e.g. someone typing gibberish as a "city") — no need for two separate systems:

- A cheap keyword blocklist rejects the worst offenders for free, before spending an API call.
- The generation prompt itself is instructed to handle unclear input gracefully (acknowledge it's not a real place, respond in voice) rather than needing a dedicated validator.

## Site structure

Main page: not a bare form, not a heavy marketing page — a short hook. Headline (good home for "what's your geographical identity"-style copy), one example card shown as proof of what they'll get, a "make yours" button that reveals the input form. Most visitors arrive cold via a shared card with zero context — one good example sells the concept faster than explanatory text.

Stats page (linked quietly from the main page footer): public, aggregate only — total cities logged, top logged cities, a word-cloud of city names sized by frequency, average/typical path length ("most people log 3-4 cities"). Doubles as social proof (a growth mechanic itself) and as your own product visibility. Must NOT show individual handle+path records publicly — people submitted to make their own card, not to be listed without being asked.

A public gallery of individual real cards is a genuinely good v2 idea, but needs an explicit opt-in checkbox at submission ("show my card on the public wall?") — separate feature, separate consent, not folded into v1.

## Analytics

Two separate things, kept separate:

**Aggregate/funnel tool** — decision deferred, not urgent (not wired in until week 3-4). Not Plausible (no longer has a free tier as of 2026, starts at $9/mo). Choosing between GoatCounter (free for small/non-commercial use, cookieless, simple) and Vercel Analytics (zero extra setup since already hosting there). Decision rule for later: default to Vercel Analytics if still on Vercel with no friction; switch to GoatCounter only if a free-tier limit is hit or more control is wanted. Low-cost to swap later either way. Track:

- Visits → cards generated → downloaded/shared (the core loop — most important number)
- Regenerate rate (signals how often the AI's first output misses — direct feedback for prompt tuning)
- Rate-limit hits (real demand vs. ceiling)
- Referrer source, country-level geography (aggregate, privacy-safe) — tells you if this spreads beyond your own seeding and beyond Barcelona

**Content log** (separate, for manual product review, not a formal analytics tool) — store handle, full input path, years (if given), generated output, timestamp. Reasonable to keep since people submit this specifically to produce something they intend to share publicly. Add one simple disclosure line near the form (e.g. "your inputs help us improve cityblend"). Don't merge into the aggregate tool; don't retain indefinitely by default.

From this log, also track: distribution of path length (validates whether the 8-cap is actually being used) and most-logged cities (tells you whether this is landing with the intended Barcelona-expat audience or spreading elsewhere — useful for where to seed next). No separate system needed, just queries against the existing log.

## Open items still to decide / build

- Buy domain (cityblend.app)
- Write and test the actual generation prompt against the known test cases until the voice is consistently landing
- Confirm current free-tier limits on GoatCounter / Vercel Analytics at setup
- Decide exact fallback for the text path once someone hits the 8-city cap (full list still fits at 8, so likely a non-issue — confirm during build)

## Timeline (2-4 hrs/week)

Note: this maps the ~10-13 total estimated hours onto the stated weekly time budget — not a fixed calendar requirement. More hours in a given week compress the schedule proportionally. Order matters more than pace: visual polish depends on the API integration existing first, testing depends on the share flow being built.

| Week | Focus |
|---|---|
| 1 | Input form, deploy blank shell |
| 2 | Claude API integration for name/line generation, rate limiting — most time here |
| 3 | Card visual + share/download flow, real design polish pass |
| 4 | Test with real friend data, launch, seed Barcelona expat groups + own network |

## Test cases (for prompt-tuning)

| Name | Path | Draft identity | Draft line |
|---|---|---|---|
| Sofia | Moscow → London (5y) → Barcelona (10y) | the moscelonian | moscow-raised, did five years in london, chose barcelona anyway |
| Mira | Moscow → Turin → Milan → Rome → Milan | the mosilanese | moved four times to end up back in milan |
| Elena | Cyprus → London → Barcelona | the cybarcelonian | island girl, mediterranean at heart, took the scenic route through london |
| Noor | Novara → Milan → Istanbul → Amsterdam → Barcelona | the novarcelonian | started in a town of 100k, now can't stop crossing borders |
| Diego | Terrassa → Barcelona | barely qualifies | moved 30km and still filled out this form |
| Theo | Valladolid → Tokyo → Leipzig → Barcelona | the valladolonian | castilian roots, a tokyo and leipzig detour, landed in catalonia |
| (never moved case) | one city only | technically an expat of nowhere | chose loyalty over adventure, no notes |

Note: Mira/Elena/Noor/Diego/Theo are placeholder names standing in for real friends — their paths were written from Sofia's memory, not confirmed by them, so small inaccuracies are possible. This file is public, so real names/data about other people shouldn't go in it; use placeholders like these for any future test cases too.
