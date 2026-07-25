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

let lastPayload = null;

makeYoursBtn.addEventListener('click', () => {
  formSection.hidden = false;
  makeYoursBtn.hidden = true;
  formSection.scrollIntoView({ behavior: 'smooth' });
});

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

// Posting is the point, so the guidance leads with it. Press-and-hold is a
// fallback and stays out of the way unless the share sheet actually fails.
const HINT_BEFORE = CAN_SHARE_FILES
  ? 'then pick Instagram to add it to your story'
  : 'or right-click the card to save it';
const HINT_AFTER = CAN_SHARE_FILES
  ? 'saved — now add it to your story on Instagram'
  : 'saved — now open Instagram and add it to your story';
const HINT_HOLD = IS_IOS
  ? 'press and hold the card, then choose Save to Photos'
  : 'right-click the card to save it';

saveBtn.textContent = CAN_SHARE_FILES ? 'share my card' : 'download my card';

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
      saveBtn.textContent = CAN_SHARE_FILES ? 'share my card' : 'download my card';
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

updateCapUI();
