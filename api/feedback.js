/* Feedback, stored in the Redis instance the app already uses.
 *
 * Deliberately not a link to Google Forms or Tally: sending someone off-site
 * loses most of the people who click, needs another account, and looks
 * unfinished on a page whose whole job is to feel like a designed thing. This
 * is one textarea and one POST.
 *
 * No auth and no rate-limit tie-in beyond a light per-IP cap, because the
 * barrier to leaving feedback should be as close to zero as possible — the
 * people who bother are the ones worth hearing from.
 */

const MAX_MESSAGE_LEN = 2000;
const MAX_CONTACT_LEN = 120;
const FEEDBACK_KEY = 'log:feedback';
const FEEDBACK_MAX = 500;
// Per-IP hourly cap purely to stop a script filling the list; generous enough
// that nobody with something to say will ever meet it.
const FEEDBACK_HOURLY_LIMIT = 10;

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
  const message = String(body.message || '').trim().slice(0, MAX_MESSAGE_LEN);
  // Optional: lets someone ask for a reply without it being required to send.
  const contact = String(body.contact || '').trim().slice(0, MAX_CONTACT_LEN);

  if (!message) return res.status(400).json({ error: 'say something first' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress
    || 'unknown';
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const rateKey = `rl:fb:${ip}:${hourBucket}`;

  try {
    const results = await redisPipeline([
      ['INCR', rateKey],
      ['EXPIRE', rateKey, '3600'],
    ]);
    if (Number(results[0]?.result || 0) > FEEDBACK_HOURLY_LIMIT) {
      return res.status(429).json({ error: 'thanks — that\'s plenty for now' });
    }

    await redisPipeline([
      ['LPUSH', FEEDBACK_KEY, JSON.stringify({
        at: new Date().toISOString(),
        host: req.headers.host || null,
        message,
        contact: contact || null,
      })],
      ['LTRIM', FEEDBACK_KEY, '0', String(FEEDBACK_MAX - 1)],
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('feedback write failed:', err.message);
    // Don't make the sender feel their message vanished into a stack trace.
    return res.status(500).json({ error: 'could not send — try again later' });
  }
};
