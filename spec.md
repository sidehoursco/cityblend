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
- Visual timeline: a **vertical route**, dots connected by a line in chronological (not geographic) order, with each city named beside its own dot. Last dot (current city) larger/filled = "home now."
  - Chronological, not geography-accurate — real relative positions require an actual map backdrop to read correctly and would fight the narrative. Shelved as a stretch goal, not v1.
  - Single-city case (never moved): one dot, no line. Chosen line: "one hometown, zero passport stamps."
  - **Superseded (week 3):** originally specced as a horizontal dot row *plus* a separate text list of the same cities underneath. These were merged into one vertical route — the names sit on the dots, so the graphic is self-explanatory, eight stops fit down the long axis of a 9:16 frame (which horizontal never did), and the optional per-stop years finally have somewhere to live.
- Stop-count badge, top right: the number of cities, large, in the route's colour. Not decoration — a visible comparable number turns a personal card into a scoreboard ("ha, I have four"), which is a reason to make your own. Uses "stops" because it's the one count honestly derivable from what someone typed (see the note on country counts under Cost & abuse protection).
- General prompt-writing rule: favor a concrete, specific, countable detail ("moved 30km" — the specificity is the joke) over a closing cliché like "no notes" / "no regrets," which reads as filler, not observation.
- Footer, baked into the image itself: "and you? → cityblend.app"
  - Hook + destination combined — "and you?" invites the viewer to participate, the domain tells them where. Must be literal text on the image, not a clickable element — once downloaded/screenshotted to a story it's a flat image, no live links.
  - Longer explainer phrases (e.g. "what's your geographical identity") belong on the site's headline, not the card footer — footer needs to stay short.
- Export: 9:16 image, downloadable, **full-bleed** (the image fills the whole story frame rather than floating as a card on a plain background — reads as intentional and designed rather than as a screenshot of a website)
  - Visual polish (typography, color, spacing) is pure front-end rendering — zero API cost either way. "Pretty" and "cheap" aren't in tension here.
  - **Square export deliberately skipped for v1.** A format picker puts a decision in front of someone at the highest-intent moment they'll ever have (the second they want to share), and it isn't a cheap resize — the vertical route is designed for the tall axis, so a square is a genuine second layout. Instead, keep the name, line and badge inside the centre square so a crop or grid repost still carries the hook. Revisit only if real requests come in.

## Card design — "Night Line" (decided week 3)

Chosen over two alternatives (a passport/travel-document treatment, and a loud flat-colour poster). Rationale: it's the only direction that isn't already a known internet format, so it can read as a new thing rather than a Spotify Wrapped variant, and the form has a reason to look the way it does.

- **Concept:** a transit line at night. This is the *universal* grammar of metro diagrams (coloured line, dots as stops, sequence over geography) shared by Tokyo, Moscow, Paris, Istanbul and Barcelona — deliberately **not** London's identity. Practical checks: use Helvetica-family type (the international/NYC-subway convention, not London's Johnston), and avoid the roundel, which is a Transport for London trademark. Chosen partly because metro diagrams are globally legible without a legend, which suits an app about people who've lived in several countries.
- **Ground:** near-black, constant on every card. This is the house identity.
- **Line colour varies per person**, from a hash of the *whole path* — not the current city. Deriving it from the current city collapses in a Barcelona expat network, where current city is the field everyone shares; the full path is the field that actually diverges. Colour comes from a curated set of nine (not free-generated), so a hash can never produce a muddy or clashing result. Because the hash is of the path, the colour is stable across regenerations — the card stays "theirs" rather than looking like a reroll.
- **Hierarchy**, in order: identity name (biggest, bold — the hook and punchline), the dry line (near-white, medium weight, clearly second), stop badge, the route, then handle and footer deliberately quiet. Nothing on the card is thin.
- **Labels:** "origin" on the first stop (transit vocabulary — origin/destination — and it fits the card's language better than "born"), "now" on the last.
- **Dark, not light:** once a story is open the full-bleed card *is* the screen, so the app's own theme barely matters; where it does matter — thumbnails in a feed or DM — a dark card stands out more against a light-mode background. Also just punchier and more memorable.

### Layout constraints (verified, not assumed)

- **Instagram Stories safe area:** the top ~13% and bottom ~18-20% of the frame sit under platform UI (username/progress bar; reply bar). All content must stay inside that band. Verified by measurement across 2–8 stops with short, long, and non-Latin city names — worst case bottoms out at ~79.5% of card height.
- **Spacing compresses as stop count rises**, driven off the number of stops. Fixed type sizes with a variable-length route overflow the frame.
- **Use only `cqw` container units, never `cqh`.** With `container-type: inline-size`, block-axis container units do not resolve against the container — they silently measure against the viewport, which is exactly what broke the first build. Since 9:16 is locked, `1cqh == 1.7778cqw`, so `cqw` alone is sufficient.
- **Set explicit `line-height` on route rows.** CJK, Arabic and similar scripts inflate the default line box enough to blow the vertical budget.
- **City names must survive as entered** — accented (san sebastián, reykjavík) and non-Latin (Москва, 東京, القاهرة, 서울) all need to render correctly in the exported image, since the audience is international by definition.

### Aspect ratio: 9:16 is the asset spec, not the screen

The card is 9:16 (1080×1920) because that is Instagram's documented Stories asset size. Modern phones are **taller** than that — an iPhone 16 Pro is roughly 19.5:9 — so the card will look slightly "more square" than the phone screen it's viewed on. That's expected, and the on-page preview deliberately matches the *exported image*, not the device.

Open question, only answerable empirically: on a taller-than-9:16 screen Instagram either letterboxes the image or scales it to fill and crops. Sources disagree and none are authoritative. This matters because if it letterboxes, the current safe-area padding is over-conservative and wastes space. The current padding errs on the cautious side, which can only ever be too careful rather than too little — so it's a safe default until someone actually posts a real exported card to a real story and looks.

### Export & download (platform constraints, researched)

- **`download` on an anchor is not supported in iOS Safari.** Critically, this also affects **Chrome on iPhone**, because Apple requires all iOS browsers to use WebKit — Chrome on iOS is not immune. Chrome on Android and desktop behave normally. Chrome is fully in scope; it just isn't a separate problem except on iOS, where it's the same problem.
- **Preferred path on mobile: the Web Share API** (`navigator.share` with a `files` array from `canvas.toBlob()`), which opens the native share sheet — better UX for "post this to a story" than a download anyway. Fall back to `<a download>` on desktop.
- **Don't rely on Web Share alone.** It has a documented history of iOS bugs: a once-per-session permission error on iOS 14, and on iOS 16 the sheet offering only "Save to Files" rather than "Save to Photos" — which is a real problem, because an image has to be in Photos to be posted to a story.
- **Therefore always render the finished image visibly on the page.** Long-press → "Save to Photos" is the one path that reliably works on iOS regardless of API support, so it should exist as a fallback for everyone, with clear wording telling people they can do it.
- Needs testing on real devices, not emulation.

**Confirmed on a real iPhone (2026-07-25):** the share-sheet path works, and a saved card posted to a story looks right. Two bugs the device test caught that emulation didn't:

1. **Revoking the blob URL immediately after `a.click()` cancels the download** — desktop Chrome showed the button transition and then silently did nothing. Release the URL later, not synchronously.
2. **People long-press or right-click the *card*, not a separate fallback image.** When the card was a DOM element that saved HTML, or nothing. Fix: render the PNG as soon as the card exists and swap it in for the DOM card, so what's on screen is literally the file that gets saved. This also removes any chance of preview and export drifting apart, and sidesteps a latent bug where awaiting the canvas render inside the click handler could burn the transient user activation `navigator.share()` requires.

**Saving is not the finish line.** In testing it was easy to save the image and stop, because nothing signalled a next step — the card ends up in the camera roll and never reaches a story. There's now a post-save nudge. Note that mimicking Instagram's logo or brand gradient to make this more obvious is a trademark question, so keep it text or a neutral icon.

### City name casing

People type city names inconsistently ("MOSCOW", "moscow", "Moscow"), so the card normalises rather than trusting input either way. Currently **Title Case**, set by a single `CITY_CASE` constant in `js/card-image.js` and shared by the on-page card and the canvas renderer via `formatCity()` so the two cannot drift.

Title Case over all-lowercase because the card's own reference argues for it: real metro maps set station names in Title Case, and the card no longer reads as "low effort" now that it's high-contrast and polished, which was the main thing the lowercase treatment bought. Still an open aesthetic call — flipping the constant to `'lower'` reverses it everywhere. Verified to handle `NOVARA`→`Novara`, `san sebastián`→`San Sebastián`, CJK unchanged, and Turkish dotted-İ correctly.

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

- Buy domain (cityblend.app) — see note below, this is more time-pressured than it looks
- Confirm current free-tier limits on GoatCounter / Vercel Analytics at setup
- Expand the content blocklist beyond the current starter list before real traffic
- Decide the homepage's example-card strategy — currently one hardcoded card (Sofia/moscelonian) shown to every visitor; agreed direction is rotating between a handful of hand-curated good examples instead, but no candidate cards chosen yet. Also worth tracking conversion by which example card a visitor saw, once the aggregate log exists.
- Later/v2 idea, not scoped: Instagram gives no way for someone who taps a friend's Story to land on the sender's own card — no referral-personalization path exists without a manually-added link sticker per share.

**Launch checklist**

- `HOURLY_LIMIT` is currently set to 30 in Vercel (Production+Preview) for pre-launch testing — the real limit in code defaults to 3. **Must revert (delete the env var, or set it to 3) before any public launch/seeding.**
- The card footer bakes in "cityblend.app" as literal text on every generated image, but the domain isn't purchased/pointed yet. No real cards are circulating yet — testing so far has been the builder entering friends' path data personally, not friends using the site themselves — but buy and point the domain before that changes, not just before "launch."

**Resolved**

- ~~Decide exact fallback for the text path once someone hits the 8-city cap~~ — no fallback needed, but the original "verified by measurement" claim was incomplete: real friend-data testing found the route can overlap the footer at as few as 5-6 stops, not just near the 8-cap, whenever the identity wraps to 2 lines or the line-text wraps more than expected — the old compression math only reacted to stop *count*, not to how tall the identity/line blocks actually rendered. Fixed in `js/card-image.js`: before drawing, it now measures the real wrapped line counts at candidate sizes and iterates the compression factor until the identity + line + route provably fit above the footer, instead of assuming stop count alone predicts the content height.
- ~~Render the card to a real 1080×1920 PNG for download~~ — done: hand-drawn canvas render, adaptive share/download button, iOS press-and-hold fallback. Verified on a real device.
- ~~Redo the input form mobile-first~~ — done. Field order fixed (birth/current city adjacent, optional stops last — found by watching a real user hesitate over the old order), touch targets brought to 44-48px, page unified with the card's typeface/accent. Field labels stayed as plain "birth city" / "current city" (not relabeled to the card's own ORIGIN/NOW vocabulary) — matching the card's *wording* made the fields more ambiguous, not less; matching its *styling* (typeface, uppercase micro-labels, accent colour) was the actual win. Current-city placeholder is "where you live," not "where you are," to rule out a day-trip reading.
- ~~Resolve the page's background against the card~~ — went through four candidate directions (light-neutral, full dark matched to the card's own `#0D1014`, tinted-navy dark, and plain monochrome-dark) before landing on the last one: page background is `#1C2024`, a few steps lighter than the card's `#0D1014` — same grey family, no added hue, so the card still reads as the darkest object on the page through a lightness gap alone. Full-dark-matched was rejected outright (page and card were literally the same hex value — zero gap, card disappeared). Tinted-navy was a real contender but shelved in favour of monochrome, since a hue-shifted background is one more colour that has to get along with whichever of the 9 line-colours a given card lands on; monochrome has no hue to clash with. CTA button is neutral light (`--accent: #F2F4F0`) rather than the teal used in the mockups, for the same reason — decoupled from any specific accent colour rather than borrowed from one example card. Worth revisiting the tinted-navy direction later purely for its own sake — it reads as more "designed"/distinctive — but monochrome was the safer pick for now.
- ~~Write and test the generation prompt against the known test cases~~ — ongoing rather than a state you finish; each round of real testing has found a new failure category:
  - Round 1: identity names that were just two city names glued together rather than demonyms; invented geographic facts (wrong compass directions, wrong continent counts); paraphrasing a given city as "a small italian town"; soft closing clichés ("decided that was the final answer") — same filler as "no notes" reworded.
  - Round 2 (real friend-data testing): invented climate claims ("picked the warmest option" — false, Barcelona isn't warmer than Cyprus/Athens); invented language/script claims ("each move a different alphabet" — false, all Latin script); identity silently skipping the blend and using one city's plain demonym; lines that recite the path instead of making one observation about it (stating the same fact twice — "milan twice... back in milan").
  - Round 3 (real friend-data testing, 6-8 stop paths): the anti-recitation rule had a loophole — reciting every city in the path and then adding one closing tag at the end still technically "makes one observation," so all four test lines were 80%+ path recitation plus a generic tag ("six border crossings and still counting," "eight cities, zero pattern") that could apply to almost any long path. Fixed by naming the loophole directly (reciting-then-tagging still counts as reciting) and pointing at duration comparisons between specific stops as sharper, more specific material than a generic closing line — added a new few-shot example demonstrating a 7-stop path resolved by naming only the 2-3 cities the observation actually needs.
  - Key lesson, reconfirmed each round: **positive worked examples beat prohibition lists.** Banning a specific phrase just produces a new equivalent; naming the general principle and adding a few-shot example of the failure case actually moves the output. The fact-invention ban specifically needed to be the *principle* ("don't assert real-world facts about the cities you don't reliably know") rather than a list of categories — climate and language were both missed the first time because only direction/distance/continent-count were named.
  - Not a bug, by design: the identity typically blends only 2 cities (usually birth + current) even on long paths — matches the spec's own canonical example ("the moscelonian" drops London). The route below already lists every stop; the identity's job is an evocative nickname, not a manifest.

## Later / v2 (not v1 scope)

- **Comparative stat on the card badge** — e.g. "more moves than 78% of people" instead of a raw stop count. Strictly better as a brag, and it upgrades the same slot rather than needing a redesign. Blocked on having the aggregate content log, so it can't happen before the log exists.
- Public gallery of individual cards, with explicit opt-in consent at submission (see Site structure).
- Square/1:1 export, only if requests actually arrive.
- Geography-accurate map view, which needs a real map backdrop to read correctly.

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
