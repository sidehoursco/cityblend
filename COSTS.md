# cityblend — costs

Real-money spend on this project. Free-tier infra (Vercel hosting, Upstash Redis free tier, GitHub) isn't listed since it costs nothing at this scale — see spec.md's cost estimate for why.

## Recurring

| Started | Item | Amount | Notes |
|---|---|---|---|
| 2026-07-22 | Claude Pro subscription | €21.78/mo | Used for building cityblend via Claude Code/chat — if also used for other things, consider it a shared cost rather than fully attributed here |

## One-time / as-needed

| Date | Item | Amount | Notes |
|---|---|---|---|
| 2026-07-22 | Anthropic API credits top-up | €5.33 | console.anthropic.com — powers the /api/generate call, minimum top-up amount, actual usage will be a small fraction of this |

## Upcoming (not yet spent)

- Domain registration (cityblend.app) — ~€10-15/yr

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
