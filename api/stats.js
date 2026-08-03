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
 * POST with ?reset=all|generations|feedback|counters wipes the logs — used to clear
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

/* Timestamps are stored as UTC ISO strings (the serverless function has no
 * idea where anyone is) but this page has exactly one reader, in Barcelona.
 * Showing raw UTC meant every time on the page was two hours behind the clock
 * on the wall, which makes "did that happen before or after I posted the
 * story?" needlessly hard to answer. Formatted for the reader, not the server.
 *
 * Hardcoded rather than detected: this page is single-user and private, and a
 * fixed zone is honest about that. It handles CET/CEST automatically. If the
 * reader ever moves, this is the one line to change. */
const DISPLAY_TZ = 'Europe/Madrid';

const STAMP_FMT = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

function localStamp(iso) {
  const d = new Date(iso);
  // Fall back to the raw string rather than printing "Invalid Date" if an
  // older log entry ever has a shape this doesn't parse.
  if (!iso || Number.isNaN(d.getTime())) {
    return String(iso || '').replace('T', ' ').slice(0, 16);
  }
  const p = {};
  for (const part of STAMP_FMT.formatToParts(d)) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

function localDay(iso) {
  return localStamp(iso).slice(0, 10);
}

function sameDay(iso, ref) {
  return localDay(iso) === ref;
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
    // Counter keys are enumerated rather than wildcard-scanned: the set is
    // small and known, and a SCAN-and-delete over a shared Redis is a blunter
    // instrument than this needs.
    const today = new Date().toISOString().slice(0, 10);
    const counterKeys = [];
    ['prod', 'test'].forEach((scope) => {
      ['view', 'form_open', 'share', 'download', 'regenerate'].forEach((type) => {
        counterKeys.push(`stat:${scope}:${type}:total`);
        counterKeys.push(`stat:${scope}:${type}:${today}`);
      });
      // The referrer hash has to be listed explicitly. It was missed when this
      // was first written because the loop above only enumerates the funnel
      // event types, and referrers aren't one of them — they're a single hash
      // per scope, written by HINCRBY in api/event.js. The effect was that
      // every "reset all" silently left the referrer table intact while
      // reporting success, so it accumulated across every wipe (78 visits'
      // worth before this was spotted). DEL works on a hash the same as on a
      // counter, so it just needs to be in the list.
      counterKeys.push(`stat:${scope}:referrers`);
    });

    const keys = target === 'all' ? [CONTENT_LOG_KEY, FEEDBACK_KEY, ...counterKeys]
      : target === 'generations' ? [CONTENT_LOG_KEY]
        : target === 'feedback' ? [FEEDBACK_KEY]
          : target === 'counters' ? counterKeys
            : null;
    if (!keys) {
      return res.status(400).json({ error: 'reset must be one of: all, generations, feedback, counters' });
    }
    try {
      const listKeys = keys.filter((k) => k.startsWith('log:'));
      const before = listKeys.length ? await redisPipeline(listKeys.map((k) => ['LLEN', k])) : [];
      const removed = before.map((r, i) => `${listKeys[i]}: ${Number(r?.result || 0)}`);
      await redisPipeline(keys.map((k) => ['DEL', k]));
      return res.status(200).json({ ok: true, cleared: removed, keysDeleted: keys.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  let generations = [];
  let feedback = [];
  let totalGenerations = 0;
  let totalFeedback = 0;
  const counters = { views: 0, formOpens: 0, shares: 0, downloads: 0 };
  const referrers = {};
  try {
    const results = await redisPipeline([
      ['LRANGE', CONTENT_LOG_KEY, '0', String(SHOW_GENERATIONS - 1)],
      ['LRANGE', FEEDBACK_KEY, '0', String(SHOW_FEEDBACK - 1)],
      ['LLEN', CONTENT_LOG_KEY],
      ['LLEN', FEEDBACK_KEY],
      ['GET', 'stat:prod:view:total'],
      ['GET', 'stat:prod:form_open:total'],
      ['GET', 'stat:prod:share:total'],
      ['GET', 'stat:prod:download:total'],
      ['HGETALL', 'stat:prod:referrers'],
    ]);
    generations = parseList(results[0]);
    feedback = parseList(results[1]);
    totalGenerations = Number(results[2]?.result || 0);
    totalFeedback = Number(results[3]?.result || 0);
    counters.views = Number(results[4]?.result || 0);
    counters.formOpens = Number(results[5]?.result || 0);
    counters.shares = Number(results[6]?.result || 0);
    counters.downloads = Number(results[7]?.result || 0);
    // HGETALL comes back as a flat [field, value, field, value, ...] array
    const flat = Array.isArray(results[8]?.result) ? results[8].result : [];
    for (let i = 0; i < flat.length; i += 2) referrers[flat[i]] = Number(flat[i + 1] || 0);
  } catch (err) {
    return res.status(500).send(`stats unavailable: ${esc(err.message)}`);
  }

  // Local, not UTC: "cards today" should roll over at the reader's midnight,
  // not at 02:00 their time. Deliberately NOT the same `today` as the reset
  // block above — that one keys Redis counters written by api/event.js in UTC
  // and must stay UTC or it would delete the wrong day's key.
  const today = localDay(new Date().toISOString());
  const live = generations.filter((g) => g.production);
  const liveToday = live.filter((g) => sameDay(g.at, today));
  const withRetries = live.filter((g) => (g.retries || 0) > 0).length;
  const withFaults = live.filter((g) => (g.unresolvedFaults || 0) > 0).length;
  // Rough spend indicator: ~$0.0023 per API call, and a retry is a second call.
  const calls = live.reduce((sum, g) => sum + 1 + (g.retries || 0), 0);
  const estSpend = (calls * 0.002323).toFixed(2);

  /* The funnel is the whole point of v1: the question is not how many cards
   * were made but whether anyone shared one without being asked. Percentages
   * are against the step above, so each number answers "how many of the people
   * who got this far went on to the next thing". */
  const saved = counters.shares + counters.downloads;
  const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');

  /* First cards and rerolls counted apart. Lumping them made the funnel read
   * as nonsense — "generated" outran "opened form" (53 vs 39) because one
   * person pressing regenerate four times looked like four more people, and
   * "shared or saved" was then divided by rolls instead of by people. The
   * first-card number is the one that belongs in the funnel; rerolls are a
   * quality signal, which is a different question. Log entries written before
   * this shipped have no flag, so they count as first cards. */
  const rerolls = live.filter((g) => g.regenerated === true).length;
  const firstCards = live.length - rerolls;
  const rerollRate = pct(rerolls, live.length);

  // Which validator is actually firing. "18 shipped flawed" said there was a
  // problem and nothing about where, which is not enough to act on.
  const faultCounts = {};
  live.forEach((g) => (g.faultKinds || []).forEach((k) => {
    const key = String(k).trim();
    if (key) faultCounts[key] = (faultCounts[key] || 0) + 1;
  }));
  const topFault = Object.entries(faultCounts).sort((a, b) => b[1] - a[1])[0] || null;

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
      <td class="when">${esc(localStamp(g.at))}${g.production ? '' : ' <span class="tag">test</span>'}${g.handle ? `<div class="who">@${esc(g.handle)}</div>` : ''}</td>
      <td><b>${esc(g.identity)}</b><div class="line">${esc(g.line)}</div></td>
      <td class="path">${esc((g.path || []).join(' → '))}</td>
      <td class="num">${g.retries ? `${g.retries}×` : ''}${g.unresolvedFaults ? ' ⚠' : ''}</td>
    </tr>`).join('');

  const fbRows = feedback.map((f) => `<tr>
      <td class="when">${esc(localStamp(f.at))}</td>
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
  /* The fault tile holds a sentence, not a number. At the tile's 1.5rem it
     filled half the row and shouted louder than the figures around it. */
  .stat b.text { font-size: 0.95rem; line-height: 1.3; font-weight: 600; }
  /* Handle sits under the timestamp: it was already logged and never shown,
     which meant no way to tell whose card a bad line landed on. */
  .who { color: #8a8f98; font-size: 0.8rem; margin-top: 2px; }
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

<h2>Funnel</h2>
<div class="cards">
  <div class="stat"><b>${counters.views}</b><span>visits</span></div>
  <div class="stat"><b>${counters.formOpens}</b><span>opened form · ${pct(counters.formOpens, counters.views)}</span></div>
  <div class="stat"><b>${firstCards}</b><span>got a card · ${pct(firstCards, counters.formOpens)}</span></div>
  <div class="stat"><b>${saved}</b><span>shared or saved · ${pct(saved, firstCards)}</span></div>
</div>

<h2>Health</h2>
<div class="cards">
  <div class="stat"><b>${liveToday.length}</b><span>cards today</span></div>
  <div class="stat"><b>${totalFeedback}</b><span>feedback</span></div>
  <div class="stat"><b>${rerolls}</b><span>rerolls · ${rerollRate} of all cards</span></div>
  <div class="stat"><b>${withRetries}</b><span>needed a retry</span></div>
  <div class="stat"><b>${withFaults}</b><span>shipped flawed · ${pct(withFaults, live.length)}</span></div>
  <div class="stat"><b class="text">${topFault ? esc(topFault[0]) : '—'}</b><span>${topFault ? `most common fault (${topFault[1]}×)` : 'no faults recorded'}</span></div>
  <div class="stat"><b>$${estSpend}</b><span>est. api spend</span></div>
</div>

<h2>Where they came from</h2>
<div>${Object.entries(referrers).sort((a, b) => b[1] - a[1]).slice(0, 15)
  .map(([r, n]) => `<span class="pill">${esc(r)} <b>${n}</b></span>`).join('') || '<span class="empty">nothing yet</span>'}</div>

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
