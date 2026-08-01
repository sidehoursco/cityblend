/* Private stats page. Not linked from anywhere — open it directly:
 *
 *     https://cityblend.app/api/stats?key=<STATS_KEY>
 *
 * Fails closed: if STATS_KEY isn't set in the environment, this 404s rather
 * than serving. An endpoint that silently becomes public because a variable is
 * missing is worse than one that stops working, and this reads real people's
 * submissions.
 *
 * Renders HTML rather than JSON because the whole point is to read it — raw
 * JSON in a phone browser is not something anyone will actually do daily.
 *
 * POST with ?reset=all|generations|feedback wipes the logs — used to clear
 * development noise so the first real numbers start from zero.
 */

const CONTENT_LOG_KEY = 'log:generations';
const FEEDBACK_KEY = 'log:feedback';
const SHOW_GENERATIONS = 200;
const SHOW_FEEDBACK = 100;

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

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseList(result) {
  const items = Array.isArray(result?.result) ? result.result : [];
  return items.map((raw) => {
    try { return JSON.parse(raw); } catch (_) { return null; }
  }).filter(Boolean);
}

function sameDay(iso, ref) {
  return String(iso || '').slice(0, 10) === ref;
}

module.exports = async function handler(req, res) {
  const key = process.env.STATS_KEY;
  const provided = (req.query && req.query.key) || '';
  if (!key || provided !== key) {
    return res.status(404).send('Not found');
  }

  /* Wiping the logs, for clearing development noise before launch so the
   * first real numbers aren't polluted by our own testing.
   *
   * POST-only and requires an explicit ?reset= value. A destructive action on
   * GET is a trap: prefetchers, link previews and "open all my tabs" would
   * fire it, and the URL carries the key, so it would only take one shared
   * screenshot of the address bar to lose the data. */
  if (req.method === 'POST') {
    const target = (req.query && req.query.reset) || '';
    const keys = target === 'all' ? [CONTENT_LOG_KEY, FEEDBACK_KEY]
      : target === 'generations' ? [CONTENT_LOG_KEY]
        : target === 'feedback' ? [FEEDBACK_KEY]
          : null;
    if (!keys) {
      return res.status(400).json({ error: 'reset must be one of: all, generations, feedback' });
    }
    try {
      const before = await redisPipeline(keys.map((k) => ['LLEN', k]));
      const removed = before.map((r, i) => `${keys[i]}: ${Number(r?.result || 0)}`);
      await redisPipeline(keys.map((k) => ['DEL', k]));
      return res.status(200).json({ ok: true, cleared: removed });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  let generations = [];
  let feedback = [];
  let totalGenerations = 0;
  let totalFeedback = 0;
  try {
    const results = await redisPipeline([
      ['LRANGE', CONTENT_LOG_KEY, '0', String(SHOW_GENERATIONS - 1)],
      ['LRANGE', FEEDBACK_KEY, '0', String(SHOW_FEEDBACK - 1)],
      ['LLEN', CONTENT_LOG_KEY],
      ['LLEN', FEEDBACK_KEY],
    ]);
    generations = parseList(results[0]);
    feedback = parseList(results[1]);
    totalGenerations = Number(results[2]?.result || 0);
    totalFeedback = Number(results[3]?.result || 0);
  } catch (err) {
    return res.status(500).send(`stats unavailable: ${esc(err.message)}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const live = generations.filter((g) => g.production);
  const liveToday = live.filter((g) => sameDay(g.at, today));
  const withRetries = live.filter((g) => (g.retries || 0) > 0).length;
  const withFaults = live.filter((g) => (g.unresolvedFaults || 0) > 0).length;
  // Rough spend indicator: ~$0.0023 per API call, and a retry is a second call.
  const calls = live.reduce((sum, g) => sum + 1 + (g.retries || 0), 0);
  const estSpend = (calls * 0.002323).toFixed(2);

  const cityCounts = {};
  live.forEach((g) => (g.path || []).forEach((c) => {
    const k = String(c).trim().toLowerCase();
    if (k) cityCounts[k] = (cityCounts[k] || 0) + 1;
  }));
  const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const pathLengths = {};
  live.forEach((g) => {
    const n = (g.path || []).length;
    pathLengths[n] = (pathLengths[n] || 0) + 1;
  });

  const rows = generations.map((g) => `<tr class="${g.production ? '' : 'test'}">
      <td class="when">${esc((g.at || '').replace('T', ' ').slice(0, 16))}${g.production ? '' : ' <span class="tag">test</span>'}</td>
      <td><b>${esc(g.identity)}</b><div class="line">${esc(g.line)}</div></td>
      <td class="path">${esc((g.path || []).join(' → '))}</td>
      <td class="num">${g.retries ? `${g.retries}×` : ''}${g.unresolvedFaults ? ' ⚠' : ''}</td>
    </tr>`).join('');

  const fbRows = feedback.map((f) => `<tr>
      <td class="when">${esc((f.at || '').replace('T', ' ').slice(0, 16))}</td>
      <td>${esc(f.message)}${f.contact ? `<div class="line">↩ ${esc(f.contact)}</div>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="2" class="empty">nothing yet</td></tr>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Never let this be cached or indexed — it contains other people's submissions.
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  return res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>cityblend stats</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 "Helvetica Neue", Helvetica, Arial, sans-serif; margin: 0; padding: 20px; max-width: 1000px; }
  h1 { font-size: 1.3rem; margin: 0 0 4px; }
  h2 { font-size: 1rem; margin: 28px 0 8px; }
  .sub { color: #6B7078; margin: 0 0 20px; font-size: 0.85rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .stat { border: 1px solid #8883; border-radius: 10px; padding: 12px; }
  .stat b { display: block; font-size: 1.5rem; letter-spacing: -0.02em; }
  .stat span { font-size: 0.75rem; color: #6B7078; text-transform: uppercase; letter-spacing: 0.05em; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  td, th { border-bottom: 1px solid #8883; padding: 7px 8px; vertical-align: top; text-align: left; }
  .when { white-space: nowrap; color: #6B7078; font-size: 0.75rem; width: 1%; }
  .num { text-align: right; white-space: nowrap; color: #6B7078; }
  .path { color: #6B7078; font-size: 0.8rem; }
  .line { color: #6B7078; margin-top: 2px; }
  tr.test { opacity: 0.45; }
  .tag { font-size: 0.65rem; border: 1px solid currentColor; border-radius: 3px; padding: 0 3px; }
  .empty { color: #6B7078; font-style: italic; }
  .pill { display: inline-block; border: 1px solid #8883; border-radius: 999px; padding: 2px 9px; margin: 0 4px 4px 0; font-size: 0.8rem; }
</style></head><body>
<h1>cityblend stats</h1>
<p class="sub">Live traffic only in the numbers below — ${esc(String(generations.length - live.length))} test generations are excluded (shown faded in the table). Log holds ${totalGenerations} entries, newest first.</p>

<div class="cards">
  <div class="stat"><b>${live.length}</b><span>live cards</span></div>
  <div class="stat"><b>${liveToday.length}</b><span>today</span></div>
  <div class="stat"><b>${totalFeedback}</b><span>feedback</span></div>
  <div class="stat"><b>${withRetries}</b><span>needed a retry</span></div>
  <div class="stat"><b>${withFaults}</b><span>shipped flawed</span></div>
  <div class="stat"><b>$${estSpend}</b><span>est. api spend</span></div>
</div>

<h2>Most-entered cities</h2>
<div>${topCities.map(([c, n]) => `<span class="pill">${esc(c)} <b>${n}</b></span>`).join('') || '<span class="empty">nothing yet</span>'}</div>

<h2>Path lengths</h2>
<div>${Object.entries(pathLengths).sort((a, b) => a[0] - b[0]).map(([n, c]) => `<span class="pill">${esc(n)} stops <b>${c}</b></span>`).join('') || '<span class="empty">nothing yet</span>'}</div>

<h2>Feedback</h2>
<table>${fbRows}</table>

<h2>Recent generations</h2>
<table>${rows || '<tr><td class="empty">nothing yet</td></tr>'}</table>
</body></html>`);
};
