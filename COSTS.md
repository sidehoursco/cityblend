# cityblend — costs

Real-money spend on this project. Free-tier infra (Vercel hosting, Upstash Redis free tier, GitHub) isn't listed since it costs nothing at this scale — see spec.md's cost estimate for why.

## Recurring

| Started | Item | Amount | Notes |
|---|---|---|---|
| 2026-07-22 | Claude Pro subscription | €21.78/mo | Used for building cityblend via Claude Code/chat — if also used for other things, consider it a shared cost rather than fully attributed here |

## One-time / as-needed

| Date | Item | Amount | Notes |
|---|---|---|---|
| 2026-07-22 | Anthropic API credits top-up | €5.33 | console.anthropic.com (account: syuvilova@gmail.com) — powers the /api/generate call, minimum top-up amount |
| 2026-07-31 | Domain: cityblend.app, first year | $9.99 + tax | Bought through Vercel (at-cost, cheaper than Cloudflare's $14.20 for year one). Renews $15.00/yr, auto-renew on |

## Auto top-up (enabled 2026-07-31)

Anthropic auto-reload is on: when the credit balance falls below **$5**, the card is charged **$5**. This removes the hard wall the prepaid balance used to provide, so the real ceiling on spend is now `GLOBAL_DAILY_LIMIT` in `api/generate.js` — currently the code default of 500 generations/day, i.e. **~$2.32/day worst case**. Lower that env var if a lower ceiling is ever wanted; the credit balance is no longer the brake.

Reference point: **$0.70 spent between 22 and 31 July**, covering all development — many rounds of prompt iteration and hundreds of test generations. Real usage is far below the theoretical worst case.

## Upcoming (not yet spent)

- Domain renewal — $15.00/yr from 2027-07-31

## Per-card generation cost

One card = one API call. The system prompt is ~2,076 tokens (it carries the voice rules and 8 worked examples), the user block is tiny, and replies are ~45 tokens. So cost is almost entirely input, which matters for the two levers below.

| Model | Per card | 1,000 cards | 10,000 cards | What the current €5.33 credit buys |
|---|---|---|---|---|
| Haiku 4.5 (current) | $0.0023 | $2.32 | $23.23 | ~2,300 cards |
| Sonnet | $0.0070 | $6.97 | $69.69 | ~765 cards |

**Correction: the per-card figures above are the no-retry case.** The generator now retries up to twice when output trips a decidable fault (gendered pronoun, invented duration, continent claim, non-blended or rude identity), and each retry is another billed call. So a card costs between 1x and 3x the figure above. Most cards don't retry, but the ceiling is what matters for budgeting.

**Your actual worst-case exposure**, with `GLOBAL_DAILY_LIMIT` at its default of 500 and no override set in Vercel:

| | Per day | Per month if saturated every day |
|---|---|---|
| 500 generations, no retries | $1.16 | ~$35 |
| 500 generations, all retrying twice | $3.48 | ~$105 |

Realistically, at 50 generations/day it's $0.12–$0.35/day, and the €5.33 of credit covers roughly six weeks at that rate. The daily cap is the thing that makes the worst case knowable at all — it's the reason a bad day costs single-digit dollars rather than being unbounded.

Two things worth knowing before assuming Sonnet is expensive:

- **Prompt caching.** The system prompt is byte-identical on every call, which is the ideal case for it — cached input reads are billed at a large discount, so most of the per-card cost above is avoidable. Worth wiring up before ruling Sonnet out on price.
- **The `HOURLY_LIMIT` / `GLOBAL_DAILY_LIMIT` caps already bound the worst case.** At the launch limit of 3/hour per person and 500/day globally, even Sonnet tops out around $3.50/day of API spend, and that only if the daily cap is actually saturated.
