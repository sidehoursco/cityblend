/* Counters for the funnel steps that happen in the browser and therefore can't
 * be inferred server-side.
 *
 * The one question v1 exists to answer is whether anyone besides Sofia
 * generated a card and *shared* it without being asked. Generations are already
 * captured server-side by the content log, but sharing happens entirely in the
 * client — navigator.share(), or a download — so without this the headline
 * metric is unmeasurable.
 *
 * Plain counters, not a log: nothing here identifies anyone, so there is no
 * reason to keep rows. Daily keys expire after 45 days; totals persist.
 */

const ALLOWED = ['view', 'form_open', 'share', 'download', 'regenerate'];
const DAY_TTL = 60 * 60 * 24 * 45;
const PRODUCTION_HOST = process.env.PRODUCTION_HOST || 'cityblend.app';

async function redisPipeline(commands) {
  const url = process.env.UPSTASH_REDIS_REST_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('redis env vars missing');

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis pipeline failed: ${res.status}`);
  return res.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const type = String(body.type || '');
  if (!ALLOWED.includes(type)) return res.status(400).json({ error: 'unknown event' });

  // Test-host traffic is counted separately so trying things out never shows up
  // as real demand — the same split the rate limiter and stats page use.
  const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  const scope = host === PRODUCTION_HOST ? 'prod' : 'test';
  const day = new Date().toISOString().slice(0, 10);

  const commands = [
    ['INCR', `stat:${scope}:${type}:total`],
    ['INCR', `stat:${scope}:${type}:${day}`],
    ['EXPIRE', `stat:${scope}:${type}:${day}`, String(DAY_TTL)],
  ];

  /* Referrer host, counted in a hash rather than as a key per source so the
   * keyspace can't be grown by anyone sending junk. Sanitised to a short
   * hostname; anything that doesn't look like one is bucketed as "other". */
  if (type === 'view') {
    const raw = String(body.ref || 'direct').toLowerCase().slice(0, 80);
    const ref = /^[a-z0-9.-]+$/.test(raw) ? raw.replace(/^www\./, '') : 'other';
    commands.push(['HINCRBY', `stat:${scope}:referrers`, ref, '1']);
  }

  /* Shares and downloads, logged rather than only counted.
   *
   * The header comment above says plain counters are enough because nothing
   * here identifies anyone. That was true and is no longer sufficient: a bare
   * count can say 40 people shared and nothing about WHAT they shared, so
   * every share figure quoted during launch week was anecdote dressed as data,
   * and the question the app exists to answer — do better lines get shared
   * more — was unanswerable.
   *
   * The card id fixes that without collecting anything new about the person:
   * it's an opaque token minted server-side, and it joins to the content log
   * entry that already exists, which is where the model, the line and the path
   * live. lineIndex is how many times they rerolled before keeping this one.
   *
   * Rolling window, same as the content log — this is a working measurement,
   * not an archive. */
  if ((type === 'share' || type === 'download') && body.cardId) {
    const cardId = String(body.cardId).slice(0, 32).replace(/[^a-z0-9]/gi, '');
    const idx = Number(body.lineIndex);
    if (cardId) {
      commands.push(['LPUSH', `log:${scope}:shares`, JSON.stringify({
        at: new Date().toISOString(),
        type,
        cardId,
        lineIndex: Number.isFinite(idx) && idx >= 0 ? Math.min(idx, 50) : 0,
      })]);
      commands.push(['LTRIM', `log:${scope}:shares`, '0', '999']);
    }
  }

  try {
    await redisPipeline(commands);
  } catch (err) {
    // Never let a counter failure surface to someone mid-share.
    console.error('event write failed (non-fatal):', err.message);
  }

  // 204 regardless: this is fire-and-forget from the client's perspective, and
  // there is nothing useful it could do with an error.
  return res.status(204).end();
};
