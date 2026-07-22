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
const resultHandle = document.getElementById('result-handle');
const resultIdentity = document.getElementById('result-identity');
const resultLine = document.getElementById('result-line');
const resultTimeline = document.getElementById('result-timeline');
const resultPath = document.getElementById('result-path');
const regenerateBtn = document.getElementById('regenerate-btn');
const remainingNote = document.getElementById('remaining-note');

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

function buildTimeline(container, pathLength) {
  container.innerHTML = '';
  for (let i = 0; i < pathLength; i++) {
    if (i > 0) {
      const line = document.createElement('div');
      line.className = 'line';
      container.appendChild(line);
    }
    const dot = document.createElement('div');
    dot.className = i === pathLength - 1 ? 'dot dot-current' : 'dot';
    container.appendChild(dot);
  }
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
      if (typeof data.remaining === 'number') {
        remainingNote.textContent = `${data.remaining} of 3 left this hour`;
      }
      return;
    }

    lastPayload = payload;
    resultHandle.textContent = payload.handle.startsWith('@') ? payload.handle : `@${payload.handle}`;
    resultIdentity.textContent = data.identity;
    resultLine.textContent = data.line;
    resultPath.textContent = data.path.join(' → ');
    buildTimeline(resultTimeline, data.path.length);
    remainingNote.textContent = `${data.remaining} of 3 left this hour`;

    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: 'smooth' });
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

updateCapUI();
