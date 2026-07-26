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
- **Type is a system stack, not a webfont — deliberate for now, revisit later.** Both the page and the canvas renderer use `"Helvetica Neue", Helvetica, Arial, sans-serif` with a monospace stack for the micro-labels, and **no `@font-face` or hosted font is loaded at all**. The Helvetica choice is the transit rationale above, and it's a real one: Helvetica is the NYC subway signage face, so calling it a transit font is accurate rather than a retrofit. The caveat is delivery — that stack resolves to genuine Helvetica on Apple devices and falls back to Arial or Roboto on Windows and Android. All neutral grotesques, close in spirit, but not the same face, so a card exported on an Android phone won't be pixel-identical to one exported on an iPhone. Nobody notices without a side-by-side, which is why this is not a launch blocker.
  - If it ever becomes worth fixing (cards circulating widely, brand consistency mattering), loading one webfont — Inter is the usual Helvetica-adjacent pick — closes it. One real constraint if so: `js/card-image.js` must wait for the font to load before drawing, or exported PNGs come out in the fallback face while the on-page card shows the right one. The hook already exists — `renderCardPNG()` awaits `document.fonts.ready` — so it's a small change, but it has to be remembered or the export silently diverges from the preview.

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

**The core principle, learned the hard way (week 3):** the line is a *verdict on the person*, not a description of the path. The route is already printed on the card directly below the line, so any line that walks through the cities is telling the reader something they can already see — which is why those lines read as competent but boring no matter how well written. "moved 30km and still filled out this form" works because it is about a person's behaviour and names zero cities; "novara to milan to istanbul to amsterdam…" fails because it is a route with adjectives. The test: could this line be about a recognisable human, or is it a travel itinerary?

Practical rules that follow from it, all validated against real output:
- **Brevity is the joke.** Hard cap of 12 words. Every line that landed was short; every line that failed was long. Past 12 words the model is explaining rather than landing, and explaining is the opposite of funny.
- **Name at most two cities**, zero is often strongest. Three or more means it has drifted back into narrating the route.
- **Bold about the person, rigid about the places.** Playful inference about someone's habits, self-image, or how they'd describe the move is the entire point and should be confident. Factual claims about the cities themselves (climate, language, direction, distance, region, sea, size) are banned — the model gets them wrong in ways that are simply false.
- **Aim at a recognisable type**, not at the data: the serial mover, the one who left and came back, the one who never left, the one whose move barely counts. Types are what make people tag friends.
- **Never assume gender** from a handle. Getting it wrong on someone's own card is worse than any joke is good.

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
- **Analytics aren't installed at all yet** — no GoatCounter, Plausible or Vercel Analytics script is on the page. Everything in the Analytics section above is still a plan, so today a launch would produce no numbers whatsoever, including the conversion rate that's supposed to be the headline metric.
- **The footer "stats" link is dead** — `#stats-link` is `href="#"` with no handler in `js/main.js`. It's visible to every visitor and does nothing. Either wire it to the public stats view or remove it before launch; a link that goes nowhere reads as broken.
- **The content log isn't built.** Redis currently does nothing but `INCR`/`EXPIRE` for rate limiting. Worth pulling forward rather than leaving to v2: right now line quality is being judged from screenshots one card at a time, and a log of handle + path + output + timestamp would make it possible to read fifty at once and see which failure patterns are actually common instead of which ones happened to be noticed. It's also the blocker on the comparative badge idea ("more moves than 78% of people").
- Track conversion by which example card a visitor saw, once the aggregate log exists — `#example-card` already carries a stable `data-example` id for exactly this.
- Later/v2 idea, not scoped: Instagram gives no way for someone who taps a friend's Story to land on the sender's own card — no referral-personalization path exists without a manually-added link sticker per share.

**Launch checklist**

- `HOURLY_LIMIT` is currently set to 30 in Vercel (Production+Preview) for pre-launch testing — the real limit in code defaults to 3. **Must revert (delete the env var, or set it to 3) before any public launch/seeding.**
- The card footer bakes in "cityblend.app" as literal text on every generated image, but the domain isn't purchased/pointed yet. No real cards are circulating yet — testing so far has been the builder entering friends' path data personally, not friends using the site themselves — but buy and point the domain before that changes, not just before "launch."

**Resolved**

- ~~Decide exact fallback for the text path once someone hits the 8-city cap~~ — no fallback needed, but the original "verified by measurement" claim was incomplete: real friend-data testing found the route can overlap the footer at as few as 5-6 stops, not just near the 8-cap, whenever the identity wraps to 2 lines or the line-text wraps more than expected — the old compression math only reacted to stop *count*, not to how tall the identity/line blocks actually rendered. Fixed in `js/card-image.js`: before drawing, it now measures the real wrapped line counts at candidate sizes and iterates the compression factor until the identity + line + route provably fit above the footer, instead of assuming stop count alone predicts the content height.
- ~~Render the card to a real 1080×1920 PNG for download~~ — done: hand-drawn canvas render, adaptive share/download button, iOS press-and-hold fallback. Verified on a real device.
- ~~Redo the input form mobile-first~~ — done. Field order fixed (birth/current city adjacent, optional stops last — found by watching a real user hesitate over the old order), touch targets brought to 44-48px, page unified with the card's typeface/accent. Field labels stayed as plain "birth city" / "current city" (not relabeled to the card's own ORIGIN/NOW vocabulary) — matching the card's *wording* made the fields more ambiguous, not less; matching its *styling* (typeface, uppercase micro-labels, accent colour) was the actual win. Current-city placeholder is "where you live," not "where you are," to rule out a day-trip reading.
- ~~Decide the homepage's example-card strategy~~ — done. Rotates between four hand-reviewed cards (`EXAMPLE_CARDS` in `js/main.js`), one picked at random per visit. **Curated, deliberately not generated per visit:** this card is the entire pitch to someone arriving cold from a shared story, so it can't depend on the model having an average day — and the previous single hardcoded card was itself a plain recitation with no angle, the exact failure the prompt work has been fixing. The set spreads across 2-4 stops and leads with short paths as often as long ones, because most visitors have lived in two or three cities and "barely qualifies / moved 30km and still filled out this form" directly answers the main reason someone wouldn't try it ("my path is too boring"). Static markup in `index.html` is a real card, so a JS failure degrades to something sensible rather than an empty frame.
- ~~Resolve the page's background against the card~~ — went through four candidate directions (light-neutral, full dark matched to the card's own `#0D1014`, tinted-navy dark, and plain monochrome-dark) before landing on the last one: page background is `#1C2024`, a few steps lighter than the card's `#0D1014` — same grey family, no added hue, so the card still reads as the darkest object on the page through a lightness gap alone. Full-dark-matched was rejected outright (page and card were literally the same hex value — zero gap, card disappeared). Tinted-navy was a real contender but shelved in favour of monochrome, since a hue-shifted background is one more colour that has to get along with whichever of the 9 line-colours a given card lands on; monochrome has no hue to clash with. CTA button is neutral light (`--accent: #F2F4F0`) rather than the teal used in the mockups, for the same reason — decoupled from any specific accent colour rather than borrowed from one example card. Worth revisiting the tinted-navy direction later purely for its own sake — it reads as more "designed"/distinctive — but monochrome was the safer pick for now.
- ~~Write and test the generation prompt against the known test cases~~ — ongoing rather than a state you finish; each round of real testing has found a new failure category:
  - Round 1: identity names that were just two city names glued together rather than demonyms; invented geographic facts (wrong compass directions, wrong continent counts); paraphrasing a given city as "a small italian town"; soft closing clichés ("decided that was the final answer") — same filler as "no notes" reworded.
  - Round 2 (real friend-data testing): invented climate claims ("picked the warmest option" — false, Barcelona isn't warmer than Cyprus/Athens); invented language/script claims ("each move a different alphabet" — false, all Latin script); identity silently skipping the blend and using one city's plain demonym; lines that recite the path instead of making one observation about it (stating the same fact twice — "milan twice... back in milan").
  - Round 3 (real friend-data testing, 6-8 stop paths): the anti-recitation rule had a loophole — reciting every city in the path and then adding one closing tag at the end still technically "makes one observation," so all four test lines were 80%+ path recitation plus a generic tag ("six border crossings and still counting," "eight cities, zero pattern") that could apply to almost any long path. Fixed by naming the loophole directly (reciting-then-tagging still counts as reciting) and pointing at duration comparisons between specific stops as sharper, more specific material than a generic closing line — added a new few-shot example demonstrating a 7-stop path resolved by naming only the 2-3 cities the observation actually needs.
  - Round 4 — the root cause behind rounds 1-3, finally found: **the examples and the rules were in direct contradiction, and the prompt told the model to trust the examples.** Five of the seven few-shot examples were themselves comma-separated path recitations, while the prompt said "match their pattern more than any rule described here" — so every anti-recitation rule added in rounds 1-3 was overridden by design, and each round's ban simply produced a reworded recitation. Fixed by rewriting all examples to be short, person-focused and non-reciting, and reframing the task itself (see Tone / voice above). Lesson: when output ignores a rule, check whether the examples contradict it before writing a stronger rule.
  - Round 4 also surfaced three secondary failures worth remembering: (a) instructing the model to "be bold" leaked from *people* into *geography*, producing confident falsehoods ("keeps moving east", "left the mediterranean" about Barcelona) — boldness has to be explicitly scoped to the person; (b) adding lots of new prompt material silently diluted the demonym-blend rule until plain single-city demonyms came back, so important rules need restating after big edits; (c) asking the model to "check your work before answering" made it write that reasoning out loud before the JSON, breaking a whole-string `JSON.parse` about 2 times in 3 on short paths — the parser now extracts the first `{...}` block instead, and the prompt asks for silent thinking.
  - A closing ordered checklist ("before you answer, verify 1…6") turned out to be far more reliably obeyed than the same rules stated in prose earlier in the prompt. Rules that keep leaking should be moved into it rather than restated in place.
  - Don't use a real test-case path as a few-shot example: that exact input then just gets the example's answer parroted back, which hides whether the prompt generalises.
  - Round 5 — two real findings and one wall:
    - **`max_tokens` was 200 and was truncating replies mid-JSON**, which is why "unparseable model output" hit the fallback repeatably on specific paths rather than randomly. Raised to 1024 (a ceiling, not a spend — real replies are ~40 tokens) and the path that failed 3/3 then passed 3/3. Some fraction of *all* real users were silently getting the fallback card for this reason alone, unrelated to prompt quality.
    - **Quoting forbidden phrases inside the prompt backfires.** The model emitted "the warmest option" — a string that existed in the prompt *only* as an example of a banned claim. Describe forbidden things as categories; never give the exact wording, or it becomes available vocabulary.
    - **Prompt engineering on Haiku has stopped converging for this task.** Across five rounds the same violations keep returning after being explicitly banned: house templates producing near-identical lines for different paths, comparative geographic/size claims, and single-city unblended demonyms. Fixes hold for a round, then reappear. The prompt is not obviously wrong any more; the model appears to be at its constraint-following ceiling for a task with this many simultaneous rules plus a creative bar. Next step is a Sonnet A/B (`ANTHROPIC_MODEL` env var) — the earlier reason for rejecting it (one JSON parse failure) is now moot, since the parser tolerates preamble and `max_tokens` no longer truncates.
  - Round 6 — **the biggest lesson of the lot: stop asking the prompt to do things code can do.** Three failures that survived every phrasing of every instruction were fixed immediately by moving them out of the prompt:
    - *Counting.* The model conflates total cities with cities-after-the-origin, so a 4-city path became "four capitals in a row". No amount of "recount carefully" fixed it. Now `pathFacts()` computes total cities, moves, cities-after-origin, repeat visits, whether they ended where they started, and longest/shortest stay, and passes them in a `<counts>` block. Counting errors stopped. The derived facts double as *material* — a repeat city or a conspicuously short stay is exactly the specific detail that keeps lines from being generic.
    - *Gendered pronouns and invented durations.* Both are decidable by regex, so `lineFaults()` checks the output and retries once with the specific fault named. The retry is only accepted if it actually fixes the problem, so a duller-but-clean second attempt can't displace a good first one.
    - *Non-blended identities.* Two independent failure modes: not demonym-*shaped* ("the vallorcelona", two place names fused), and shaped fine but not a *blend* ("the cypriot" for someone living in Paris). `looksLikeDemonym()` checks both — a valid identity needs a demonym ending AND must share a fragment with the current city, since fusing origin with destination is the whole joke.
    - Rule of thumb going forward: if a constraint is decidable in code, decide it in code and retry. Reserve the prompt for the part that genuinely needs judgement — whether the line is funny.
  - Round 6 also corrected two of my own over-corrections, both caught by Sofia. Comparative claims between places are **fine** and are good joke material — only *temperature ordering* is genuinely unreliable (the model reverses it), plus sea/coast claims. And "three capitals" for Athens/London/Barcelona was **true**, since Barcelona is the capital of Catalonia. Cheerful hyperbole and opinionated character claims ("asia's most chaotic city", Warsaw as "stubborn") are wanted, not risks — they're what makes a line feel knowledgeable and sharp rather than flat.
  - Round 7 (watched a real tester use the site end to end, ~10 generations) — the fix that mattered was **rotating an assigned angle per card, chosen in code** (`angleFor()`). The sameness was never caused by one bad instruction; it came from handing every card the same broad menu and letting the model resolve it the same way each time. Angles are weighted by repetition in the list, and only ones the path supports are eligible (the return joke needs a repeat city, the duration joke needs years). "City character" is weighted highest because it is what both best-received lines did — Warsaw as gloomy, Hanoi as chaotic — a real quality of a place being something the card cannot show.
    - Also fixed: lines that testers **could not parse** ("proving it wasn't enough", "5 moves in 15") now have an explicit first-read requirement. A joke needing decoding has already failed, publicly, on someone's story.
    - Also fixed: **politics/conflict is off-limits.** Moscow→Kyiv paths were producing "a country that stopped existing" and "one that won't stop arguing". Someone listing where they have lived is often the person that history happened to.
    - **Known open issues, not yet solved:**
      - Moscow→Kyiv reproducibly ships `the moskvian` — all three attempts fail the blend check, so the least-bad is shipped and logged. Short/awkward city names make some blends genuinely hard; `the kyevscovite` proves it is possible, just not reliable.
      - A new template is emerging: "the city that never stops ___" appeared across three unrelated paths. Emergent sameness seems to be a recurring cost of any fixed instruction set — worth re-checking every round rather than assuming a fix is permanent.
      - Word count creeps past the ~14 limit on some outputs; not currently enforced in code, and it could be.
  - Key lesson, reconfirmed each round: **positive worked examples beat prohibition lists.** Banning a specific phrase just produces a new equivalent; naming the general principle and adding a few-shot example of the failure case actually moves the output. The fact-invention ban specifically needed to be the *principle* ("don't assert real-world facts about the cities you don't reliably know") rather than a list of categories — climate and language were both missed the first time because only direction/distance/continent-count were named.
  - Not a bug, by design: the identity typically blends only 2 cities (usually birth + current) even on long paths — matches the spec's own canonical example ("the moscelonian" drops London). The route below already lists every stop; the identity's job is an evocative nickname, not a manifest.

## Open design call — homepage first screen

The example card and the "make yours" CTA compete for the same first screen, and there is no setting that satisfies both on a short phone. Measured: hero (120px) + caption + a legible card + CTA needs ~700px of *visible* viewport, and Safari's URL bar plus toolbar take ~110px off the nominal height, so an iPhone SE has ~553px to work with. Shrinking the card to fit made it 142×253 — an illegible thumbnail, which defeats the reason it's there. A real tester stalled on this screen, tried tapping the example card as if it were the input, and only found the button by chance.

Current state is a compromise: the card is capped against `100dvh` but with a 380px floor, so it stays legible and the CTA drops below the fold on the shortest screens. The caption "an example — yours below" helps only if people read it, which the same tester's behaviour suggests they don't.

Four ways out, none free — worth deciding deliberately rather than by tuning pixels:
1. **Card always fits** — CTA guaranteed visible, card becomes a thumbnail on short phones.
2. **CTA above the example card** — both visible at full size, but people can start before seeing what they'll get, losing the example's persuasive work.
3. **Sticky CTA that appears only once the button scrolls out of view** — no compromise on card size or discoverability; costs a little JS and reads slightly more "app-like".
4. **Accept it and rely on scroll instinct** — cheapest, and the observed failure is a sample of one; more friend tests would say whether it generalises.

## Later / v2 (not v1 scope)

Ideas from Sofia's boyfriend after testing the site (his framing, kept as raised — none of it is v1 scope, and the stated plan is to launch the original idea first, get it genuinely funny, and only branch if it takes off):

- **Merch, starting with a t-shirt.** The card is already a print-ready graphic at 1080×1920, so the artwork problem is mostly solved. Print-on-demand (Printful and similar) needs no inventory. Note the identity word is the actual appeal here, not the route — a shirt that just says "the moscelonian" is a better object than one carrying the whole card.
- **A rotating monthly theme.** Every month the lines draw on a different dimension — food from those cities one month, nightlife another, and so on. This is the strongest idea in this list for the metric that matters: it gives an existing user a reason to come back and re-generate, and a reason to share again, which one-shot novelty tools normally can't do. It also fits the architecture as it already stands, since `angleFor()` already picks a per-card angle in code — a monthly theme is that same mechanism with the pool swapped on a date. Cheap to try.
- **Let people attach a life event to each stop** — got married, had a baby, started a company. Would give generation genuinely new material rather than more ways to rephrase the route, which is the recurring failure mode. Cost: more form friction, on a form where field clarity is already the weak point.
- **Scan Instagram/Facebook for those life events automatically.** Same benefit, no typing. But it needs OAuth against Meta's platform, app review, and a privacy policy, and it means handling personal data the project deliberately avoids touching today (see the content-log note above). The manual version gets most of the value for a fraction of the cost and risk — worth building that first and only revisiting this if people actually fill the manual one in.
- **A trips version rather than a moves version** — cities visited, possibly time-boxed ("your 2026"). Meaningfully widens the audience, since plenty of people have never moved city but almost everyone travels. Closest thing here to a genuine second product rather than a feature, and it would need its own card design (a route implies sequence and residence; a trip list doesn't).
- **Lightweight feedback channel.** Not prominent, just present for the minority who want to send something. Cheapest version with no infrastructure is a discreet footer link to a hosted form (Tally, Google Forms) — deliberately *not* a mailto: with a personal address, since that publishes it to scrapers on a page intended to go viral. Needs one decision from Sofia (which destination) and is then a one-line change.
- **Name.** "cityblend" tested well phonetically with a non-native speaker; "blend" was the part that didn't immediately read as meaningful to him. "city blender" was floated and got a shrug. Sofia still prefers cityblend, and the domain plan assumes it. The clarity gap is better closed by the subhead than by renaming — the name only has to be memorable and sayable, and it is.

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
