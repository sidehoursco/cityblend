/* THROWAWAY. Delete this file when the prompt experiment is finished.
 *
 * Why it exists: rewriting the generator's prompt means running dozens of
 * candidate prompts against real paths and comparing the output. Doing that
 * from a laptop needs the Anthropic key on the laptop; doing it by editing
 * api/generate.js needs a deploy per revision. This is the third option — the
 * prompt travels in the REQUEST BODY, so it deploys once and then iterates as
 * fast as a local script can type.
 *
 * Three things keep it from being an open proxy on someone else's API bill:
 *
 *   1. It refuses on the production host, the same rule that keeps model
 *      overrides away from cityblend.app. An experiment must not be ABLE to
 *      reach production — on 4 Aug one did, and the site served a fallback card
 *      for ten hours overnight.
 *   2. It requires the STATS_KEY as a header, and fails closed if that variable
 *      is missing. Deliberately the same secret rather than a new one: adding a
 *      variable in Vercel needs a redeploy to take effect, and the thing being
 *      guarded here (spend) is strictly less sensitive than what that key
 *      already guards (every visitor's submissions).
 *   3. It counts against the same global daily spend cap as real traffic, so a
 *      runaway loop in a test script hits the same ceiling everything else does.
 *
 * It writes nothing to the content log and nothing to the per-scope counters,
 * so no amount of experimenting shows up as demand on the stats page.
 */

const PRODUCTION_HOST = process.env.PRODUCTION_HOST || 'cityblend.app';
const GLOBAL_DAILY_LIMIT = Number(process.env.GLOBAL_DAILY_LIMIT || 500);
// A ceiling, not a budget: thinking models need headroom, but nothing here has
// any reason to emit more than a slate of short lines.
const MAX_TOKENS_CEILING = 4096;

const MODEL_ALIASES = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-5',
  opus: 'claude-opus-5',
};

async function redisPipeline(commands) {
  const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL
    || process.env.UPSTASH_REDIS_REST_URL
    || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN
    || process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('missing Redis env vars');
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis pipeline failed: ${res.status}`);
  return res.json();
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

module.exports = async function handler(req, res) {
  const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  // Rule one. Not a 403 — on the live host this endpoint simply does not exist.
  if (host === PRODUCTION_HOST) return res.status(404).send('Not found');

  const key = process.env.STATS_KEY;
  if (!key || req.headers['x-lab-key'] !== key) return res.status(404).send('Not found');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = await readJsonBody(req);
  const system = typeof body.system === 'string' ? body.system : '';
  const user = typeof body.user === 'string' ? body.user : '';
  if (!system || !user) return res.status(400).json({ error: 'system and user are both required' });

  const model = MODEL_ALIASES[String(body.model || 'haiku').toLowerCase()];
  if (!model) return res.status(400).json({ error: `unknown model alias: ${body.model}` });

  // Shared with real traffic on purpose: this exists to cap spend, and an
  // experimental call costs exactly what a real one does.
  try {
    const dayBucket = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const globalKey = `rl:global:${dayBucket}`;
    const r = await redisPipeline([['INCR', globalKey], ['EXPIRE', globalKey, '86400']]);
    if (Number(r[0]?.result || 0) > GLOBAL_DAILY_LIMIT) {
      return res.status(429).json({ error: 'global daily cap reached' });
    }
  } catch (err) {
    return res.status(500).json({ error: `rate limit check failed: ${err.message}` });
  }

  const requestBody = {
    model,
    max_tokens: Math.min(Number(body.max_tokens) || 2048, MAX_TOKENS_CEILING),
    system,
    messages: [{ role: 'user', content: user }],
  };

  /* Effort, and why it is the only cost lever worth having here.
   *
   * On the thinking models about 80% of the bill is output tokens, and most of
   * those are thinking rather than the four short lines we actually keep. The
   * old way to cap that was `thinking.budget_tokens`, which is removed on the
   * current models and returns a 400 — `output_config.effort` replaces it.
   *
   * Passed through rather than fixed so the sweep can measure what each level
   * costs and whether the cheap ones are good enough, instead of guessing. */
  if (body.effort) {
    requestBody.output_config = { effort: String(body.effort) };
  }
  // Thinking off is accepted only at effort `high` or below on Opus 5; above
  // that it is a 400. Sent verbatim so the sweep sees the real error rather
  // than a silently rewritten request.
  if (body.thinking) {
    requestBody.thinking = body.thinking;
  }
  // Only Haiku still accepts it; newer models reject the field outright rather
  // than ignoring it, so it cannot be set unconditionally.
  if (model === MODEL_ALIASES.haiku && body.temperature != null) {
    requestBody.temperature = Number(body.temperature);
  }

  const started = Date.now();
  try {
    /* Fast mode. Same model, up to ~2.5x the output tokens per second, at
     * double the per-token price. It exists here because latency is the one
     * cost that can't be capped after the fact — a visitor staring at a
     * spinner leaves, and no budget setting brings them back. Whether 2x the
     * token price is worth halving the wait is a real trade, so it gets
     * measured rather than assumed. Opus only, and Claude API only. */
    const headers = {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
    if (body.speed === 'fast') {
      requestBody.speed = 'fast';
      headers['anthropic-beta'] = 'fast-mode-2026-02-01';
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    const json = await upstream.json();
    if (!upstream.ok) return res.status(502).json({ error: 'anthropic error', status: upstream.status, detail: json });

    // The FIRST text block. Thinking models put other block types ahead of the
    // prose, and assuming content[0] was what made Sonnet look useless for a
    // whole day when the real fault was one line of parsing.
    const block = (json.content || []).find((b) => b && b.type === 'text' && typeof b.text === 'string');
    return res.status(200).json({
      model,
      ms: Date.now() - started,
      stop_reason: json.stop_reason,
      blocks: (json.content || []).map((b) => b && b.type),
      usage: json.usage,
      text: block ? block.text : '',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
