const MAX_CITIES = 8;

const makeYoursBtn = document.getElementById('make-yours-btn');
const formSection = document.getElementById('form-section');
const betweenList = document.getElementById('between-cities-list');
const addCityBtn = document.getElementById('add-city-btn');
const capNote = document.getElementById('cap-note');
const rowTemplate = document.getElementById('between-city-row-template');
const form = document.getElementById('blend-form');
const formStatus = document.getElementById('form-status');
const submitBtn = document.getElementById('submit-btn');

const resultSection = document.getElementById('result-section');
const resultCard = document.getElementById('result-card');
const resultHandle = document.getElementById('result-handle');
const resultCount = document.getElementById('result-count');
const resultIdentity = document.getElementById('result-identity');
const resultLine = document.getElementById('result-line');
const resultRoute = document.getElementById('result-route');
const regenerateBtn = document.getElementById('regenerate-btn');
const remainingNote = document.getElementById('remaining-note');
const blending = document.getElementById('blending');
const blendingText = document.getElementById('blending-text');
const saveBtn = document.getElementById('save-btn');
const resultImage = document.getElementById('result-image');
const saveHint = document.getElementById('save-hint');
const saveFallback = document.getElementById('save-fallback');
const saveFallbackLead = document.getElementById('save-fallback-lead');
const saveFallbackSteps = document.getElementById('save-fallback-steps');
const saveFallbackAlt = document.getElementById('save-fallback-alt');
const copyLinkBtn = document.getElementById('copy-link-btn');

/* Which card treatment to draw. ?theme=bright makes the card the person's own
 * colour instead of near-black.
 *
 * Behind a parameter rather than switched outright because this is a taste
 * decision, not a correctness one, and the honest way to settle it is to look
 * at both on a phone with a real card in them. Whichever wins becomes the
 * default and this reader goes away. */
const CARD_THEME = /[?&]theme=field\b/.test(location.search) ? 'field' : 'default';

// Everything the exported PNG needs, kept from the last successful generation.
let lastCard = null;
// The PNG is rendered as soon as a card exists, not on button press. Two
// reasons: navigator.share() needs transient user activation, which an await
// inside the click handler can burn; and having a real <img> on the page is
// what makes press-and-hold / right-click save an actual image.
let lastFile = null;
let lastImageUrl = null;

// Every browser on iOS runs WebKit — Apple requires it — so Chrome on an
// iPhone inherits Safari's broken `download` attribute. Detect the platform,
// not the browser.
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// The single most important environment this app runs in, and the one it was
// silently broken in: everyone who taps a link sticker on an Instagram story
// lands in Instagram's own in-app webview, never in Safari or Chrome.
//
// That webview does NOT honour <a download>. It treats the click as a
// navigation to the blob: URL, can't render it, and replaces the page with a
// full-screen "can't load page" error carrying the Instagram logo — after the
// card has already been generated and paid for. Reported by a tester within an
// hour of the first story going out.
//
// So in here we must never navigate to a blob: URL. The rendered PNG is
// already on the page as a real <img>, and press-and-hold saves it natively,
// which is the one mechanism that does work in these webviews.
// ?inapp=1 forces this on. Not a debug leftover — this branch is otherwise
// only reachable by opening the site from inside a real Instagram story, which
// makes the failure invisible during normal testing. That is exactly how it
// shipped broken.
const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|FBIOS/i.test(navigator.userAgent || '')
  || /[?&]inapp=1\b/.test(location.search);

// iOS and Android in-app webviews fail differently, and the way out differs
// too. On iOS the share sheet is usually available, and press-and-hold on an
// image reliably offers "Save to Photos". On Android there is neither a share
// sheet nor a working download, and long-press may not offer to save at all —
// so Android needs a real escape hatch, not just a gesture suggestion.
const IS_ANDROID = /Android/i.test(navigator.userAgent || '')
  || /[?&]android=1\b/.test(location.search);

// Transit lines have colours; so does each person's route. Curated rather
// than generated, so a hash can never land on a muddy or clashing hue.
const LINE_COLORS = [
  '#F2B33D', '#00A9B8', '#FF6B5B', '#9B85FF', '#4ECB71',
  '#FF74B8', '#C9E265', '#6FB4FF', '#FF9233',
];

// Derived from the whole path, not the current city — in an expat network
// current city converges (everyone lands in the same place) while the full
// path diverges. Deterministic, so regenerating keeps the same colour.
function lineColorFor(path) {
  const key = path.join('|').toLowerCase();
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return LINE_COLORS[h % LINE_COLORS.length];
}

/* Hand-picked, not generated on the fly — this card is the whole pitch to
 * someone arriving cold from a shared story, so it can't be left to a model
 * having an average day. Each line here was reviewed and kept; the generator
 * produces plenty that aren't good enough for the front page.
 *
 * The set is deliberately spread across path lengths, and deliberately leads
 * with short paths as often as long ones: most visitors have lived in two or
 * three cities, and "barely qualifies" answers the main reason someone
 * wouldn't bother trying it ("my path is boring"). `id` is what gets recorded
 * for conversion-by-example, so keep ids stable even if wording is tweaked. */
const EXAMPLE_CARDS = [
  {
    id: 'hanoi-warsaw',
    handle: 'linh',
    identity: 'the hanarsawian',
    line: "swapped one capital's chaos for another's gloom and called it a lateral move",
    path: ['Hanoi', 'Warsaw'],
    years: [null, null],
  },
  {
    id: 'terrassa-barcelona',
    handle: 'pau',
    identity: 'barely qualifies',
    line: 'moved 30km and still filled out this form',
    path: ['Terrassa', 'Barcelona'],
    years: [null, null],
  },
  {
    id: 'moscow-london-barcelona',
    handle: 'sofia',
    identity: 'the moscelonian',
    line: 'spent five years in london learning to queue, moved to barcelona to forget',
    path: ['Moscow', 'London', 'Barcelona'],
    years: [null, 5, 10],
  },
  {
    // The long-path slot: five stops with years, so the rotation shows at least
    // one card where the transit line itself is the spectacle. The line works
    // because it picks the single odd detail out of the route — Porto is the
    // one-year stay among threes and sixes — rather than summarising it.
    id: 'lima-lisbon',
    handle: 'nico',
    identity: 'the limabonese',
    line: 'spent one year in porto and never mentions it',
    path: ['Lima', 'Madrid', 'Berlin', 'Porto', 'Lisbon'],
    years: [null, 3, 6, 1, null],
  },
];

/* Mirrors identityFitScale() from card-image.js onto the DOM card, so the
 * preview and the exported PNG shrink a too-long identity by the same amount.
 * Without this the on-page card breaks "the leonescondense" mid-word and
 * strands the final letter on its own line, while the PNG quietly does the
 * right thing — the preview would then lie about the thing being shared. */
function setIdentityScale(card, identity, stopCount) {
  const over = Math.max(0, stopCount - 2);
  // usable width is 84cqw (100 minus 8cqw padding each side); the base font is
  // this many cqw, so their ratio is the width available in font-size units
  // IDENT_BASE_CQW comes from card-image.js so this cannot drift from the export.
  const baseFontCqw = Math.max(6, IDENT_BASE_CQW - over * 0.28);
  const probe = document.createElement('canvas').getContext('2d');
  card.style.setProperty('--ident-scale', identityFitScale(probe, identity, 84 / baseFontCqw).toFixed(3));
}

function renderExampleCard() {
  const card = document.getElementById('example-card');
  if (!card) return;
  const pick = EXAMPLE_CARDS[Math.floor(Math.random() * EXAMPLE_CARDS.length)];

  card.dataset.example = pick.id;
  card.style.setProperty('--n', String(pick.path.length));
  card.style.setProperty('--line', lineColorFor(pick.path));
  document.getElementById('example-handle').textContent = `@${pick.handle}`;
  document.getElementById('example-count').textContent = String(pick.path.length);
  document.getElementById('example-identity').textContent = pick.identity;
  setIdentityScale(card, pick.identity, pick.path.length);
  document.getElementById('example-line').textContent = pick.line;
  buildRoute(document.getElementById('example-route'), pick.path, pick.years);
}

let lastPayload = null;

/* The rest of the slate the server already generated and validated, plus which
 * one is currently on screen.
 *
 * Rerolling used to cost an API call and return the same joke reworded — one
 * person got nine cards carrying one identity, eight of them opening with the
 * same word, and posted none of them. The server now writes five different
 * jokes in a single call, so a reroll is an array index: instantly different,
 * free, and it doesn't eat the hourly allowance. */
let alternates = [];
let lineIndex = 0;
// Ties this card to whatever happens to it next. A share used to be a bare
// counter with no idea which card it came from, which is why no share figure
// quoted during launch week was worth anything.
let lastCardId = null;

/* Fire-and-forget funnel counters. sendBeacon where available so the request
 * survives the page being backgrounded — which is exactly what happens on the
 * event that matters most, since navigator.share() hands control to another
 * app mid-flight and a normal fetch can be cancelled in the handover. */
function track(type, extra) {
  const body = JSON.stringify(Object.assign({ type }, extra || {}));
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
      return;
    }
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch (_) { /* analytics must never break the app */ }
}

const stickyCta = document.getElementById('sticky-cta');
const stickyMakeYoursBtn = document.getElementById('sticky-make-yours');
let formRevealed = false;

// silent: used when the form is opened by restoring a URL rather than by
// someone deciding to start. Counting that as a form-open would double-count
// one person who simply changed browser mid-flow.
function revealForm(options) {
  const silent = options === true;
  if (!formRevealed && !silent) track('form_open');
  formSection.hidden = false;
  makeYoursBtn.hidden = true;
  formRevealed = true;
  stickyCta.classList.remove('is-visible');
  if (!silent) formSection.scrollIntoView({ behavior: 'smooth' });
}

makeYoursBtn.addEventListener('click', () => revealForm());
stickyMakeYoursBtn.addEventListener('click', () => revealForm());

/* ---- carrying the form across a browser switch -------------------------
 * Android's Instagram browser cannot save an image by any route, so the only
 * real fix is to leave it — and Instagram's own "open in Chrome" reopens THE
 * CURRENT URL. So if the URL already describes what was typed, the hand-off
 * carries it for free: no copy-paste, no re-typing, no second guess at what
 * their cities were.
 *
 * Deliberately the INPUTS, not the finished card. Encoding the generated
 * identity and line would let anyone craft a URL that renders arbitrary text
 * on a cityblend-branded card, straight past the content blocklist. Carrying
 * only what they typed means the card still has to come from the server, with
 * every check intact. The cost is one more generation after the switch, which
 * is about a fifth of a cent and, since they never managed to save the first
 * card, nothing they'll miss. */
const CARRY_KEYS = ['h', 'b', 'n', 'c', 'y'];

function writeStateToUrl(payload) {
  const params = new URLSearchParams(location.search);
  CARRY_KEYS.forEach((k) => params.delete(k));
  if (payload.handle) params.set('h', payload.handle);
  if (payload.birthCity) params.set('b', payload.birthCity);
  if (payload.currentCity) params.set('n', payload.currentCity);
  const between = payload.betweenCities.filter((row) => row.city && row.city.trim());
  if (between.length) {
    params.set('c', between.map((row) => row.city).join('|'));
    if (between.some((row) => row.years)) {
      params.set('y', between.map((row) => row.years || '').join('|'));
    }
  }
  const qs = params.toString();
  // replaceState, not pushState: this is a record of the current state, not a
  // navigation, and back should still leave the site rather than walk through
  // every card someone generated.
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function prefillFromUrl() {
  const p = new URLSearchParams(location.search);
  if (!p.get('b') && !p.get('n')) return false;
  document.getElementById('handle').value = (p.get('h') || '').slice(0, 30);
  document.getElementById('birth-city').value = (p.get('b') || '').slice(0, 40);
  document.getElementById('current-city').value = (p.get('n') || '').slice(0, 40);
  const cities = (p.get('c') || '').split('|').filter((c) => c.trim());
  const years = (p.get('y') || '').split('|');
  cities.slice(0, MAX_CITIES - 2).forEach((city, i) => {
    addBetweenCityRow();
    const rows = betweenList.querySelectorAll('.between-city-row');
    const row = rows[rows.length - 1];
    if (!row) return;
    row.querySelector('.between-city-input').value = city.slice(0, 40);
    const yrs = String(years[i] || '').replace(/\D/g, '').slice(0, 2);
    if (yrs) row.querySelector('.between-city-years').value = yrs;
  });
  return true;
}

/* The example card can't shrink enough to keep the CTA above the fold on a
 * short phone without becoming an illegible thumbnail, and a tester who
 * couldn't see a button assumed the example card WAS the input. So rather than
 * compromise the card, the CTA follows: it shows whenever the real button is
 * off screen, and never once the form is open — a duplicate CTA pointing at a
 * form you're already looking at is just clutter.
 *
 * Measured from getBoundingClientRect on scroll/resize rather than via
 * IntersectionObserver, for two reasons. It needs a correct answer
 * synchronously on first paint — the main case is the button starting below the
 * fold, where waiting for an async callback means the page briefly offers no
 * visible action at all. And IO callbacks are suspended while a document is
 * hidden, which made the behaviour untestable and would silently do nothing in
 * a backgrounded tab. rAF-throttled, so scrolling still costs one measurement
 * per frame at most. */
function syncStickyCta() {
  if (formRevealed) {
    stickyCta.classList.remove('is-visible');
    return;
  }
  const box = makeYoursBtn.getBoundingClientRect();
  const onScreen = box.top < window.innerHeight && box.bottom > 0;
  stickyCta.classList.toggle('is-visible', !onScreen);
}

let stickyTick = false;
function queueStickySync() {
  if (stickyTick) return;
  stickyTick = true;
  requestAnimationFrame(() => {
    stickyTick = false;
    syncStickyCta();
  });
}

window.addEventListener('scroll', queueStickySync, { passive: true });
window.addEventListener('resize', queueStickySync);

function betweenRowCount() {
  return betweenList.querySelectorAll('.between-city-row').length;
}

function totalCityCount() {
  // birth city + current city + however many "between" rows are filled in
  return 2 + betweenRowCount();
}

function updateCapUI() {
  const total = totalCityCount();
  const atCap = total >= MAX_CITIES;
  addCityBtn.disabled = atCap;
  capNote.textContent = atCap
    ? `you've hit the ${MAX_CITIES}-city cap`
    : `${total} of ${MAX_CITIES} cities used`;
}

function addBetweenCityRow() {
  if (totalCityCount() >= MAX_CITIES) return;
  const row = rowTemplate.content.firstElementChild.cloneNode(true);
  row.querySelector('.remove-city-btn').addEventListener('click', () => {
    row.remove();
    updateCapUI();
  });
  betweenList.appendChild(row);
  updateCapUI();
}

addCityBtn.addEventListener('click', addBetweenCityRow);

function collectPayload() {
  const handle = document.getElementById('handle').value;
  const birthCity = document.getElementById('birth-city').value;
  const currentCity = document.getElementById('current-city').value;
  const betweenCities = Array.from(betweenList.querySelectorAll('.between-city-row')).map((row) => ({
    city: row.querySelector('.between-city-input').value,
    years: row.querySelector('.between-city-years').value || null,
  }));
  return { handle, birthCity, currentCity, betweenCities };
}

// One vertical route replaces the old dot-row-plus-text-list pair: the city
// names sit on their own dots, which is self-explanatory, fits 8 stops down
// the tall axis, and gives the optional years somewhere to live.
function buildRoute(container, path, years) {
  /* Cities the route visits more than once. Consecutive repeats are merged
   * server-side, so anything counted here is a real leaving-and-coming-back. */
  const visits = path.reduce((acc, c) => {
    const k = String(c).trim().toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  container.textContent = '';
  path.forEach((cityName, i) => {
    const isNow = i === path.length - 1;
    const row = document.createElement('li');
    if (isNow) row.className = 'is-now';
    if (visits[String(cityName).trim().toLowerCase()] > 1) row.classList.add('is-interchange');

    const city = document.createElement('span');
    city.className = 'city';
    // shared with the canvas renderer so the preview can't drift from the export
    city.textContent = formatCity(cityName);
    row.appendChild(city);

    let metaText = '';
    if (isNow) metaText = 'now';
    else if (i === 0) metaText = 'origin';
    const yrs = years && years[i];
    if (yrs) metaText = metaText ? `${yrs} yrs · ${metaText}` : `${yrs} yrs`;

    if (metaText) {
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = metaText;
      row.appendChild(meta);
    }
    container.appendChild(row);
  });
}

/* Status text that changes while waiting.
 *
 * Timed, not real progress — the API returns once and there is nothing
 * partial to report, so pretending to a percentage would be a lie. What the
 * changes are actually for is proof of life: text that moves says the page is
 * working, text that sits still says it has died, and at nine seconds people
 * decide which of those they are looking at.
 *
 * The middle line names one of their own cities. It costs nothing and it is
 * the moment the wait stops feeling generic — it is visibly working on THEIR
 * route, which buys more patience than any spinner. */
let blendingTimers = [];
/* When the current request started, or null when nothing is in flight.
 *
 * This is the whole abandon measurement: if the page is hidden or closed while
 * a card is still generating, that person waited and gave up, and without a
 * beacon they leave no trace at all — indistinguishable from someone who got a
 * card and didn't like it. Since the card takes ~9 seconds now, telling those
 * two apart is the difference between a latency problem and a quality one. */
let requestStartedAt = null;

function stopBlending() {
  blendingTimers.forEach(clearTimeout);
  blendingTimers = [];
  blending.hidden = true;
}

function startBlending(payload) {
  const cities = [payload.birthCity, ...(payload.betweenCities || []).map((c) => c.city), payload.currentCity]
    .map((c) => String(c || '').trim())
    .filter(Boolean);
  // Not the current city: the one before it is the more surprising choice, and
  // the point is to show we read the whole route rather than just the last box.
  const pick = cities.length > 2 ? cities[cities.length - 2] : cities[0];
  const steps = [
    [0, 'reading your route'],
    [2200, pick ? `thinking about ${pick.toLowerCase()}` : 'thinking about your cities'],
    [5200, 'writing a few different versions'],
    [8600, 'picking the best one'],
    [13000, 'almost there'],
  ];
  stopBlending();
  blending.hidden = false;
  blendingTimers = steps.map(([ms, text]) => setTimeout(() => { blendingText.textContent = text; }, ms));
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  regenerateBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'blending...' : 'generate my blend';
  regenerateBtn.textContent = isLoading ? 'blending...' : 'regenerate';
  if (!isLoading) stopBlending();
}

// isRegenerate is passed through to the server purely so the content log can
// tell a first card apart from a reroll. Without it the funnel counts both as
// "generated", which made "shared or saved" read as a percentage of rolls
// rather than of people.
async function generate(payload, isRegenerate) {
  setLoading(true);
  startBlending(payload);
  requestStartedAt = Date.now();
  formStatus.hidden = true;

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, regenerated: isRegenerate === true }),
    });
    const data = await response.json();

    if (!response.ok) {
      formStatus.hidden = false;
      formStatus.textContent = data.error || 'something went wrong, try again.';
      if (typeof data.remaining === 'number' && typeof data.limit === 'number') {
        remainingNote.textContent = `${data.remaining} of ${data.limit} left this hour`;
      }
      return;
    }

    lastPayload = payload;
    alternates = Array.isArray(data.alternates) ? data.alternates.slice() : [];
    lineIndex = 0;
    lastCardId = data.cardId || null;
    // Put what they typed in the URL now, so that whatever happens next — a
    // browser switch, a reload, a shared link — starts from here.
    writeStateToUrl(payload);
    lastCard = {
      handle: payload.handle.startsWith('@') ? payload.handle : `@${payload.handle}`,
      identity: data.identity,
      line: data.line,
      path: data.path,
      years: data.years,
      color: lineColorFor(data.path),
      // Carried into the PNG so the export matches the preview exactly. If they
      // disagreed, the thing someone chose to share would not be the thing that
      // got shared.
      theme: CARD_THEME,
    };
    // a fresh generation invalidates any previously rendered image
    resetImage();

    resultHandle.textContent = payload.handle.startsWith('@') ? payload.handle : `@${payload.handle}`;
    resultIdentity.textContent = data.identity;
    setIdentityScale(resultCard, data.identity, data.path.length);
    resultLine.textContent = data.line;
    resultCount.textContent = data.path.length;
    // mirrors the canvas renderer, so preview and export agree
    resultCard.querySelector('.c-badge i').textContent = data.path.length === 1 ? 'stop' : 'stops';
    buildRoute(resultRoute, data.path, data.years);
    // spacing compresses off --n; the line colour is the person's own
    resultCard.style.setProperty('--n', data.path.length);
    resultCard.style.setProperty('--line', lastCard.color);
    /* The same ghost lines as the export, from the same geometry, drawn as an
     * SVG behind the card. The viewBox is exactly the card's 9:16, so the two
     * cannot disagree about where a line sits. */
    const ghost = ghostFor(data.path);
    const old = resultCard.querySelector('.c-ghost');
    if (old) old.remove();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'c-ghost');
    svg.setAttribute('viewBox', '0 0 100 177.78');
    svg.setAttribute('aria-hidden', 'true');
    ghost.lines.forEach((pts) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      el.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
      svg.appendChild(el);
    });
    ghost.stops.forEach(([gx, gy]) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      el.setAttribute('cx', gx); el.setAttribute('cy', gy); el.setAttribute('r', '1.6');
      el.setAttribute('class', 'c-ghost-stop');
      svg.appendChild(el);
    });
    resultCard.prepend(svg);

    resultCard.classList.toggle('theme-field', CARD_THEME === 'field');
    /* The field ends just above the route, measured from the rendered card
     * rather than assumed: a two-line identity or a three-line joke moves that
     * boundary, and a fixed height would slice through the text. Deferred a
     * frame so the browser has laid the card out before anything is measured. */
    if (CARD_THEME === 'field') {
      requestAnimationFrame(() => {
        const route = resultCard.querySelector('.route');
        const top = route.getBoundingClientRect().top - resultCard.getBoundingClientRect().top;
        const gap = parseFloat(getComputedStyle(route).marginTop) || 0;
        resultCard.style.setProperty('--field-h', `${Math.round(top - gap * 0.55)}px`);
      });
    }
    remainingNote.textContent = `${data.remaining} of ${data.limit} left this hour`;

    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth' });
    prepareImage();
  } catch (err) {
    formStatus.hidden = false;
    formStatus.textContent = 'network error, try again.';
  } finally {
    requestStartedAt = null;
    setLoading(false);
  }
}

/* visibilitychange, not beforeunload: on mobile — which is nearly all of this
 * app's traffic — closing a tab or switching apps often fires no unload event
 * at all, and beforeunload is unreliable on iOS in particular. Hiding the page
 * is the event that actually happens. sendBeacon inside track() is what makes
 * it survive the page going away. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || requestStartedAt == null) return;
  const waited = Date.now() - requestStartedAt;
  // Cleared so a second hide (app switch and back and away again) can't count
  // the same person twice.
  requestStartedAt = null;
  track('abandon', { ms: waited });
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  generate(collectPayload());
});

/* Swaps the line for the next one already in hand. Only the line changes — the
 * demonym, the route and the colour are properties of the path, not of the
 * joke, and re-rendering them would make a free reroll look like a slow one. */
function showAlternate() {
  const next = alternates.shift();
  lineIndex += 1;
  lastCard.line = next;
  resultLine.textContent = next;
  // The rendered PNG is now stale — it still has the old line baked in.
  resetImage();
  prepareImage();
  // Counted, because a reroll that never reaches the server would otherwise be
  // invisible: the reroll rate is the clearest read we have on whether the
  // first card was good enough, and it is the number this release exists to
  // move. lineIndex travels with the share so we know which one they kept.
  track('regenerate', { cardId: lastCardId, lineIndex });
}

regenerateBtn.addEventListener('click', () => {
  if (!lastPayload) return;
  // Only call the API once the pre-generated slate is used up.
  if (alternates.length) {
    showAlternate();
    return;
  }
  generate(lastPayload, true);
});

// Probed once with a throwaway file: navigator.canShare only reports honestly
// when handed the kind of payload we actually intend to send.
const CAN_SHARE_FILES = (() => {
  try {
    const probe = new File([new Blob([''], { type: 'image/png' })], 'p.png', { type: 'image/png' });
    return !!(navigator.canShare && navigator.canShare({ files: [probe] }));
  } catch (err) {
    return false;
  }
})();

// "share" sounds finished the moment it's tapped, so a hint telling you to do
// something *more* reads as a contradiction. Two fixes: the arrow signals the
// button opens something rather than concluding it, and the hint is descriptive
// (where it can go) rather than imperative (what to do next), so the two stop
// fighting. Platform-agnostic on purpose — the sheet shows a dozen apps, and
// the spec never intended Instagram-only.
const HINT_HOLD = IS_IOS
  ? 'press and hold the card, then choose Save to Photos'
  : IN_APP_BROWSER
    ? 'press and hold the card to save it'
    : 'right-click the card to save it';

// Inside an in-app browser with no share sheet there is no download to offer,
// so the hint has to lead with the mechanism that actually works rather than
// describing a button that can't do what it says.
const NO_DOWNLOAD = IN_APP_BROWSER && !CAN_SHARE_FILES;

// Names saving as well as sending. The share-sheet route is the only one iOS
// has — <a download> doesn't work there, which is why this branch exists — so
// someone who just wants the picture and doesn't know a share sheet contains
// "Save Image" had nothing telling them the button was for them too.
const HINT_BEFORE = CAN_SHARE_FILES
  ? 'instagram, whatsapp, or save to photos'
  : NO_DOWNLOAD
    ? HINT_HOLD
    : 'or right-click the card to save it';
const HINT_AFTER = CAN_SHARE_FILES
  ? 'now add it to your story'
  : 'saved — now add it to your story';

// "download my card" is a promise this browser can't keep; "save my card" is
// true of press-and-hold too.
saveBtn.textContent = CAN_SHARE_FILES ? 'share my card →'
  : NO_DOWNLOAD ? 'save my card'
    : 'download my card';

/* Two platforms, two different truths — and saying the wrong one is worse than
 * saying nothing.
 *
 * iOS: press-and-hold on the image genuinely offers "Save to Photos", so that's
 * the one-gesture answer and leaving is the fallback.
 *
 * Android: it does not. The structural reason is that a long-press image menu
 * in an Android WebView is drawn by the host app, not the page — Instagram
 * doesn't implement one, so there is nothing for the page to trigger, and no
 * web API left to try either. One tester also reported press-and-hold doing
 * nothing in Instagram's browser. So Android is told the truth directly and
 * sent to Chrome first, rather than being handed a gesture that will probably
 * fail and make the whole thing feel broken.
 *
 * "open in Chrome" reopens the current URL, which now carries what they typed,
 * so nothing is lost by leaving. */
/* The "your cities come with you" promise was attached to the wrong route.
 * It relied on Instagram's "open in Chrome" reopening the URL as the page
 * currently has it, after history.replaceState — and a tester on Android
 * reported landing in Chrome with an empty form, with the fix demonstrably
 * live at the time. So Instagram appears to hand over the URL it originally
 * loaded, not the current one, and that promise was false where it mattered.
 *
 * The copy-link button does not depend on any of that: it copies
 * location.href, params and all. So the promise moves to the route that can
 * actually keep it, and the menu route is described without one. Better to
 * offer a slightly longer path that works than a short one that quietly
 * loses someone's six cities. */
/* Confirmed on a real Android phone rather than assumed this time. Instagram's
 * "open in Chrome" reopens the URL it originally loaded — the story link,
 * fbclid and all — and throws away everything the page did afterwards, so the
 * form always arrives empty. Its own "copy link" captures the live URL with
 * the carried cities intact, and pasting that into Chrome restores the form.
 *
 * So copying is the route that works and the menu is the one that costs you
 * your typing. Earlier versions had these the wrong way round. */
if (IS_ANDROID) {
  saveFallbackLead.textContent = "instagram's browser can't save images — you'll need chrome for that bit.";
  saveFallbackSteps.textContent = 'copy this link and paste it into chrome. it keeps your cities:';
  saveFallbackAlt.textContent = 'instagram\'s ⋮ menu has "open in Chrome" too, but it arrives with an empty form.';
} else {
  saveFallbackLead.textContent = 'press and hold the card above, then choose Save to Photos.';
  saveFallbackSteps.textContent = 'not working? copy this link and paste it into your browser:';
  saveFallbackAlt.textContent = 'the ••• menu can open it too, but it arrives with an empty form.';
}

// Clipboard as the last resort: if they can't find the menu, they can paste
// the address anywhere. navigator.clipboard is https-only, which this is, but
// in-app webviews are exactly where it tends to be missing — hence the
// execCommand fallback rather than trusting one API.
copyLinkBtn.addEventListener('click', async () => {
  // The current URL, not the bare domain: it carries what they typed, so
  // pasting it into Chrome lands them on their own filled-in form.
  const url = location.href;
  let ok = false;
  try {
    await navigator.clipboard.writeText(url);
    ok = true;
  } catch (_) {
    try {
      const scratch = document.createElement('textarea');
      scratch.value = url;
      scratch.setAttribute('readonly', '');
      scratch.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(scratch);
      scratch.select();
      scratch.setSelectionRange(0, url.length);
      ok = document.execCommand('copy');
      scratch.remove();
    } catch (_err) {
      ok = false;
    }
  }
  // If both failed, show the address so it can at least be typed or selected
  // by hand — never leave the button looking like it did nothing.
  copyLinkBtn.textContent = ok ? 'copied — paste it in your browser' : 'cityblend.app';
});

function resetImage() {
  if (lastImageUrl) URL.revokeObjectURL(lastImageUrl);
  lastImageUrl = null;
  lastFile = null;
  resultImage.hidden = true;
  resultImage.removeAttribute('src');
  resultCard.hidden = false;
  saveHint.hidden = true;
  saveFallback.hidden = true;
}

// Renders the PNG up front and swaps it in for the DOM card, so what's on
// screen is literally the file that gets saved.
async function prepareImage() {
  if (!lastCard) return;
  try {
    const blob = await renderCardPNG(lastCard);
    lastFile = new File([blob], 'cityblend.png', { type: 'image/png' });
    lastImageUrl = URL.createObjectURL(blob);
    resultImage.addEventListener('load', () => {
      resultImage.hidden = false;
      resultCard.hidden = true;
      // The image decodes asynchronously, so this can land AFTER the save
      // button has already opened the fallback panel — which would put the
      // same press-and-hold instruction on screen twice, once quietly and
      // once loudly. The panel is the fuller version, so it wins.
      if (saveFallback.hidden) {
        saveHint.textContent = HINT_BEFORE;
        saveHint.classList.remove('save-hint--done');
        saveHint.hidden = false;
      }
    }, { once: true });
    resultImage.src = lastImageUrl;
  } catch (err) {
    // the DOM card stays visible; the save button will retry the render
    lastFile = null;
  }
}

// There is no way to hand an image straight to Instagram Stories from the web —
// the instagram-stories:// scheme needs native app code. The share sheet is the
// closest available: the user taps here, then taps Instagram in the sheet.
async function saveCard() {
  if (!lastCard) return;

  let file = lastFile;
  if (!file) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'making your image...';
    try {
      const blob = await renderCardPNG(lastCard);
      file = new File([blob], 'cityblend.png', { type: 'image/png' });
      lastFile = file;
      if (lastImageUrl) URL.revokeObjectURL(lastImageUrl);
      lastImageUrl = URL.createObjectURL(blob);
    } catch (err) {
      formStatus.hidden = false;
      formStatus.textContent = "couldn't make the image — try again.";
      return;
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = CAN_SHARE_FILES ? 'share my card →'
        : NO_DOWNLOAD ? 'save my card'
          : 'download my card';
    }
  }

  if (CAN_SHARE_FILES) {
    try {
      await navigator.share({ files: [file] });
      // only after the sheet resolves — firing before it would count dismissals
      track('share', { cardId: lastCardId, lineIndex });
      nudgeToInstagram();
      return;
    } catch (err) {
      // dismissing the sheet isn't a failure — leave the guidance as it was
      if (err && err.name === 'AbortError') return;
      // anything else: surface press-and-hold, which always works
      saveHint.textContent = HINT_HOLD;
      saveHint.classList.remove('save-hint--done');
      saveHint.hidden = false;
      return;
    }
  }

  // In Instagram's / Facebook's webview this click would navigate to the blob:
  // URL and blow the page away with a "can't load page" error, losing the card
  // the person just made. Point them at press-and-hold instead, which works.
  if (NO_DOWNLOAD) {
    saveHint.hidden = true;
    saveFallback.hidden = false;
    // The panel is below the button that was just tapped, and on a phone the
    // card fills the screen — without this it can open entirely off-screen,
    // which is indistinguishable from the "nothing happens" it exists to fix.
    saveFallback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Still counted. It's a tap, not a confirmed save — but so is the download
    // path below, which also can't know whether the file was kept. Leaving it
    // untracked would make the save rate look worst for Instagram traffic,
    // which is most of the traffic.
    track('download', { cardId: lastCardId, lineIndex });
    return;
  }

  const a = document.createElement('a');
  a.href = lastImageUrl;
  a.download = 'cityblend.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // NOT revoked here: revoking synchronously after click cancels the download.
  // The URL is released on the next generation instead.
  track('download', { cardId: lastCardId, lineIndex });
  nudgeToInstagram();
}

// Saving is not the goal — posting is. Without this people save the image and
// stop, because nothing told them there was a next step.
function nudgeToInstagram() {
  saveHint.textContent = HINT_AFTER;
  saveHint.classList.add('save-hint--done');
  saveHint.hidden = false;
}

saveBtn.addEventListener('click', saveCard);

renderExampleCard();
/* Referrer host only — never the full URL, which can carry search terms or
 * private path segments. This is the number that answers whether cityblend
 * travelled beyond the people Sofia personally asked. */
track('view', { ref: (() => {
  try { return document.referrer ? new URL(document.referrer).hostname : 'direct'; }
  catch (_) { return 'direct'; }
})() });
/* Hand the page to Chrome, for Android users stuck in Instagram's webview.
 *
 * An Android intent: URL asks the OS to open the address in a named app.
 * S.browser_fallback_url is part of the intent spec: if com.android.chrome
 * isn't installed, Android opens that URL instead of showing an error, so
 * someone on Samsung Internet or Firefox gets a no-op rather than a failure
 * page. The visible "or tap ⋮" line covers the remaining case where Instagram
 * blocks the intent outright — which it may, and which changes between app
 * versions, so this can never be the only route offered.
 *
 * fbclid is dropped on the way through: it's Meta's click tracker, appended to
 * the link when it came out of Instagram, and there's no reason to carry it
 * into the browser or into anything the person later copies. */
if (IS_ANDROID && IN_APP_BROWSER) {
  const target = new URL(location.href);
  target.searchParams.delete('fbclid');
  const fallback = encodeURIComponent(target.toString());
  document.getElementById('open-chrome-btn').href = 'intent://'
    + target.host + target.pathname + target.search
    + '#Intent;scheme=https;package=com.android.chrome'
    + `;S.browser_fallback_url=${fallback};end`;
  document.getElementById('inapp-notice').hidden = false;
}

// after the example card is sized, since its height decides where the CTA sits
syncStickyCta();
updateCapUI();

// If the URL carries what someone already typed — which is how a card survives
// being handed from Instagram's browser to Chrome — restore it and open the
// form, so they land on their own half-finished work rather than a blank page
// they have to fill in again.
if (prefillFromUrl()) {
  revealForm(true);
  updateCapUI();
}

/* ---- feedback ------------------------------------------------------------
   Posts to /api/feedback, which stores it in the Redis instance the app
   already uses. Deliberately not a link to an external form: sending someone
   off-site loses most of the people who click, and this is the audience worth
   hearing from. */
const feedbackToggle = document.getElementById('feedback-toggle');
const feedbackPanel = document.getElementById('feedback-panel');
const feedbackMessage = document.getElementById('feedback-message');
const feedbackContact = document.getElementById('feedback-contact');
const feedbackSend = document.getElementById('feedback-send');
const feedbackStatus = document.getElementById('feedback-status');

feedbackToggle.addEventListener('click', () => {
  const opening = feedbackPanel.hidden;
  feedbackPanel.hidden = !opening;
  if (opening) feedbackMessage.focus();
});

feedbackSend.addEventListener('click', async () => {
  const message = feedbackMessage.value.trim();
  if (!message) {
    feedbackStatus.textContent = 'write something first.';
    feedbackStatus.hidden = false;
    return;
  }

  feedbackSend.disabled = true;
  feedbackSend.textContent = 'sending...';
  feedbackStatus.hidden = true;

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, contact: feedbackContact.value.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // Collapse the inputs rather than leaving a filled form implying it
      // might not have sent.
      feedbackMessage.value = '';
      feedbackContact.value = '';
      feedbackMessage.hidden = true;
      feedbackContact.hidden = true;
      feedbackSend.hidden = true;
      feedbackStatus.textContent = 'thank you — genuinely read.';
    } else {
      feedbackStatus.textContent = data.error || 'could not send, try again.';
    }
  } catch (err) {
    feedbackStatus.textContent = 'could not send, try again.';
  } finally {
    feedbackStatus.hidden = false;
    feedbackSend.disabled = false;
    feedbackSend.textContent = 'send';
  }
});
