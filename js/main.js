const MAX_CITIES = 8;

const makeYoursBtn = document.getElementById('make-yours-btn');
const formSection = document.getElementById('form-section');
const betweenList = document.getElementById('between-cities-list');
const addCityBtn = document.getElementById('add-city-btn');
const capNote = document.getElementById('cap-note');
const rowTemplate = document.getElementById('between-city-row-template');
const form = document.getElementById('blend-form');
const formStatus = document.getElementById('form-status');

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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  formStatus.hidden = false;
  formStatus.textContent = 'card generation is coming in week 2 — form is just a shell for now.';
});

updateCapUI();
