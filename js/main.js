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
const saveBtn = document.getElementById('save-btn');
const resultImage = document.getElementById('result-image');
const saveHint = document.getElementById('save-hint');

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
  const baseFontCqw = Math.max(6, 11.5 - over * 0.28);
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

const stickyCta = document.getElementById('sticky-cta');
const stickyMakeYoursBtn = document.getElementById('sticky-make-yours');
let formRevealed = false;

function revealForm() {
  formSection.hidden = false;
  makeYoursBtn.hidden = true;
  formRevealed = true;
  stickyCta.classList.remove('is-visible');
  formSection.scrollIntoView({ behavior: 'smooth' });
}

makeYoursBtn.addEventListener('click', revealForm);
stickyMakeYoursBtn.addEventListener('click', revealForm);

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
  container.textContent = '';
  path.forEach((cityName, i) => {
    const isNow = i === path.length - 1;
    const row = document.createElement('li');
    if (isNow) row.className = 'is-now';

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

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  regenerateBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'blending...' : 'generate my blend';
  regenerateBtn.textContent = isLoading ? 'blending...' : 'regenerate';
}

async function generate(payload) {
  setLoading(true);
  formStatus.hidden = true;

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    lastCard = {
      handle: payload.handle.startsWith('@') ? payload.handle : `@${payload.handle}`,
      identity: data.identity,
      line: data.line,
      path: data.path,
      years: data.years,
      color: lineColorFor(data.path),
    };
    // a fresh generation invalidates any previously rendered image
    resetImage();

    resultHandle.textContent = payload.handle.startsWith('@') ? payload.handle : `@${payload.handle}`;
    resultIdentity.textContent = data.identity;
    setIdentityScale(resultCard, data.identity, data.path.length);
    resultLine.textContent = data.line;
    resultCount.textContent = data.path.length;
    buildRoute(resultRoute, data.path, data.years);
    // spacing compresses off --n; the line colour is the person's own
    resultCard.style.setProperty('--n', data.path.length);
    resultCard.style.setProperty('--line', lastCard.color);
    remainingNote.textContent = `${data.remaining} of ${data.limit} left this hour`;

    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth' });
    prepareImage();
  } catch (err) {
    formStatus.hidden = false;
    formStatus.textContent = 'network error, try again.';
  } finally {
    setLoading(false);
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  generate(collectPayload());
});

regenerateBtn.addEventListener('click', () => {
  if (lastPayload) generate(lastPayload);
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
const HINT_BEFORE = CAN_SHARE_FILES
  ? 'instagram, whatsapp, wherever'
  : 'or right-click the card to save it';
const HINT_AFTER = CAN_SHARE_FILES
  ? 'now add it to your story'
  : 'saved — now add it to your story';
const HINT_HOLD = IS_IOS
  ? 'press and hold the card, then choose Save to Photos'
  : 'right-click the card to save it';

saveBtn.textContent = CAN_SHARE_FILES ? 'share my card →' : 'download my card';

function resetImage() {
  if (lastImageUrl) URL.revokeObjectURL(lastImageUrl);
  lastImageUrl = null;
  lastFile = null;
  resultImage.hidden = true;
  resultImage.removeAttribute('src');
  resultCard.hidden = false;
  saveHint.hidden = true;
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
      saveHint.textContent = HINT_BEFORE;
      saveHint.classList.remove('save-hint--done');
      saveHint.hidden = false;
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
      saveBtn.textContent = CAN_SHARE_FILES ? 'share my card →' : 'download my card';
    }
  }

  if (CAN_SHARE_FILES) {
    try {
      await navigator.share({ files: [file] });
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

  const a = document.createElement('a');
  a.href = lastImageUrl;
  a.download = 'cityblend.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // NOT revoked here: revoking synchronously after click cancels the download.
  // The URL is released on the next generation instead.
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
// after the example card is sized, since its height decides where the CTA sits
syncStickyCta();
updateCapUI();

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
