const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  step: 1,
  symptoms: [],
  severity: '',
  duration: 2,
  patient: { age: null, gender: 'female', pregnancyStatus: 'not applicable', existingConditions: '' },
  library: [],
};

const fallbackSymptoms = ['headache', 'fatigue', 'nausea', 'cough', 'fever', 'dizziness', 'shortness of breath', 'weakness', 'vomiting', 'chest tightness', 'sore throat', 'abdominal pain'].map((feature, index) => ({ feature, frequency: 12 - index }));
const formatSymptom = (value) => value.split(' ').map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
const getSymbol = (value) => value.includes('pain') ? '◒' : value.includes('breath') || value.includes('cough') ? '⌁' : value.includes('head') ? '◍' : value.includes('fatigue') || value.includes('weak') ? '∿' : value.includes('nausea') || value.includes('vomit') ? '◌' : '✦';
const scrollToTarget = (selector) => { const target = $(selector); if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

$$('[data-scroll-target]').forEach((button) => button.addEventListener('click', () => scrollToTarget(button.dataset.scrollTarget)));

const renderSymptoms = (query = '') => {
  const grid = $('#symptom-grid');
  const normalizedQuery = query.trim().toLowerCase();
  const pool = normalizedQuery ? state.library.filter(({ feature }) => feature.includes(normalizedQuery)) : state.library.slice(0, 24);
  grid.innerHTML = '';
  if (!pool.length) {
    const empty = document.createElement('p');
    empty.className = 'symptom-status';
    empty.textContent = 'No matching dataset symptom found. Try a shorter search.';
    grid.append(empty);
    return;
  }
  pool.slice(0, normalizedQuery ? 42 : 24).forEach(({ feature }) => {
    const button = document.createElement('button');
    button.className = 'symptom-chip';
    button.type = 'button';
    button.dataset.symptom = feature;
    button.setAttribute('aria-pressed', String(state.symptoms.includes(feature)));
    if (state.symptoms.includes(feature)) button.classList.add('selected');
    const icon = document.createElement('span');
    icon.textContent = getSymbol(feature);
    button.append(icon, document.createTextNode(` ${formatSymptom(feature)}`));
    grid.append(button);
  });
};

const loadSymptomLibrary = async () => {
  try {
    const response = await fetch('/api/symptoms');
    if (!response.ok) throw new Error('Symptom library unavailable');
    const data = await response.json();
    state.library = data.symptoms || fallbackSymptoms;
    $('#symptom-status')?.remove();
    renderSymptoms();
  } catch {
    state.library = fallbackSymptoms;
    const status = $('#symptom-status');
    if (status) status.textContent = 'Showing common symptoms while the dataset library reconnects.';
    renderSymptoms();
  }
};

const getPatientDetails = () => {
  syncPregnancyField();
  const rawAge = Number($('#patient-age').value);
  state.patient = {
    age: Number.isFinite(rawAge) && rawAge >= 0 && rawAge <= 120 ? Math.round(rawAge) : null,
    gender: $('#patient-gender').value,
    pregnancyStatus: $('#patient-pregnancy').value,
    existingConditions: $('#patient-conditions').value.trim(),
  };
  return state.patient;
};

const syncPregnancyField = () => {
  const gender = $('#patient-gender');
  const pregnancy = $('#patient-pregnancy');
  const note = $('#pregnancy-lock-note');
  if (!gender || !pregnancy) return;
  const isMale = gender.value === 'male';
  if (isMale) pregnancy.value = 'not pregnant';
  pregnancy.disabled = isMale;
  pregnancy.setAttribute('aria-disabled', String(isMale));
  if (note) note.hidden = !isMale;
};

const canContinueFromStepOne = () => {
  const patient = getPatientDetails();
  return Number.isFinite(patient.age) && state.symptoms.length > 0;
};

const updateStep = (nextStep) => {
  state.step = nextStep;
  $$('.intake-panel').forEach((panel, index) => panel.classList.toggle('is-hidden', index + 1 !== nextStep));
  $('#step-index').textContent = String(nextStep).padStart(2, '0');
  $('#intake-progress-bar').style.width = `${nextStep * 33.333}%`;
  $$('.progress-dots i').forEach((dot, index) => dot.classList.toggle('active', index < nextStep));
  $('#back-button').classList.toggle('is-hidden', nextStep === 1);
  $('#intake-title').textContent = ['Patient details & symptoms', 'How does it feel today?', 'A little more context'][nextStep - 1];
  const next = $('#next-button');
  next.disabled = nextStep === 1 ? !canContinueFromStepOne() : nextStep === 2 ? !state.severity : false;
  next.innerHTML = nextStep === 3 ? 'See my signal <span aria-hidden="true">→</span>' : 'Continue <span aria-hidden="true">→</span>';
  $('#selected-hint').textContent = nextStep === 1 ? (state.symptoms.length && Number.isFinite(state.patient.age) ? `${state.symptoms.length} selected · Patient context captured` : 'Add age and choose at least one symptom to continue') : nextStep === 2 ? (state.severity ? `${state.severity} intensity selected` : 'Choose the intensity that feels right') : 'You can skip anything that doesn’t feel relevant';
};

$('#symptom-grid').addEventListener('click', (event) => {
  const chip = event.target.closest('.symptom-chip');
  if (!chip) return;
  const symptom = chip.dataset.symptom;
  state.symptoms = state.symptoms.includes(symptom) ? state.symptoms.filter((item) => item !== symptom) : [...state.symptoms, symptom];
  renderSymptoms($('#symptom-search').value);
  updateStep(1);
});
$('#symptom-search').addEventListener('input', (event) => renderSymptoms(event.target.value));
const refreshPatientForm = (event) => { if (event.target?.id === 'patient-gender') syncPregnancyField(); updateStep(state.step); };
['#patient-age', '#patient-gender', '#patient-pregnancy', '#patient-conditions'].forEach((selector) => {
  const field = $(selector);
  field.addEventListener('input', refreshPatientForm);
  field.addEventListener('change', refreshPatientForm);
});
syncPregnancyField();

$$('.severity-option').forEach((option) => option.addEventListener('click', () => {
  $$('.severity-option').forEach((item) => item.classList.remove('selected'));
  option.classList.add('selected');
  state.severity = option.dataset.severity;
  updateStep(2);
}));

$('#duration-range').addEventListener('input', (event) => {
  state.duration = Number(event.target.value);
  $('#duration-value').textContent = `${state.duration} day${state.duration === 1 ? '' : 's'}`;
});

const animateAnalysis = () => new Promise((resolve) => {
  const bar = $('#loading-progress-bar');
  const message = $('#loading-message');
  const messages = ['Sorting symptoms into useful context…', 'Comparing common patterns…', 'Writing a clearer next step…'];
  let progress = 0;
  bar.style.width = '0%';
  const timer = setInterval(() => {
    progress += 4;
    bar.style.width = `${Math.min(progress, 100)}%`;
    if (progress === 32) message.textContent = messages[1];
    if (progress === 64) message.textContent = messages[2];
    if (progress >= 100) { clearInterval(timer); resolve(); }
  }, 70);
});

const runAnalysis = async () => {
  const section = $('#analysis-section');
  section.classList.remove('is-hidden');
  $('#analysis-loading').classList.remove('is-hidden');
  $('#results-view').classList.add('is-hidden');
  scrollToTarget('#analysis-section');
  const payload = {
    symptoms: state.symptoms,
    severity: state.severity,
    duration: state.duration,
    patient: getPatientDetails(),
    anythingElse: $('#detail-input').value,
  };
  try {
    const [response] = await Promise.all([
      fetch('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
      animateAnalysis(),
    ]);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to score this check-in.');
    showResults(data);
  } catch (error) {
    $('#analysis-loading').classList.add('is-hidden');
    $('#results-view').classList.remove('is-hidden');
    $('#result-disease').textContent = 'We could not complete the model check';
    $('#result-confidence').textContent = '—';
    $('#result-explanation').textContent = error.message || 'Please try again with at least one dataset symptom.';
  }
};

$('#next-button').addEventListener('click', () => { if (state.step < 3) updateStep(state.step + 1); else runAnalysis(); });
$('#back-button').addEventListener('click', () => updateStep(Math.max(1, state.step - 1)));

const addPill = (root, text) => { const pill = document.createElement('span'); pill.textContent = formatSymptom(text); root.append(pill); };
const makeTextElement = (tag, className, text) => { const element = document.createElement(tag); element.className = className; element.textContent = text; return element; };
const renderDrugRecommendations = (recommendations) => {
  const grid = $('.drug-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (!recommendations?.length) {
    const card = makeTextElement('article', 'drug-card drug-card-muted', '');
    const caution = makeTextElement('div', 'drug-caution', '');
    caution.append(makeTextElement('span', '', '!'), document.createTextNode(' Reviews are not a substitute for safety or efficacy evidence.'));
    card.append(makeTextElement('div', 'drug-card-top', 'REVIEW INDEX'), makeTextElement('h4', '', 'No aligned review record yet'), makeTextElement('p', '', 'The uploaded review dataset has no close condition match for this possible pattern. A clinician or pharmacist can guide the next step.'), caution);
    grid.append(card);
    return;
  }
  recommendations.forEach((item) => {
    const card = makeTextElement('article', 'drug-card', '');
    const top = makeTextElement('div', 'drug-card-top', '');
    top.append(makeTextElement('span', 'drug-symbol', 'Rx'), makeTextElement('span', 'drug-type', 'REVIEW-INFORMED SIGNAL'));
    card.append(top, makeTextElement('h4', '', item.label));
    card.append(makeTextElement('p', '', `${item.conditionLabel} · ${item.averageRating}/10 average rating from ${item.reviewCount.toLocaleString()} review${item.reviewCount === 1 ? '' : 's'}. This is educational context, not a treatment recommendation.`));
    const caution = makeTextElement('div', 'drug-caution', '');
    caution.append(makeTextElement('span', '', '!'), document.createTextNode(` Matched to ${item.matchedPattern} · review evidence score ${item.evidenceScore}/10`));
    card.append(caution);
    const sideEffectPanel = makeTextElement('div', 'side-effect-panel', '');
    sideEffectPanel.setAttribute('aria-label', 'Drug side-effects reference');
    sideEffectPanel.append(makeTextElement('div', 'side-effect-title', 'SIDE EFFECTS TO REVIEW · VERIFY OFFICIAL LABEL'));
    const sideEffectText = item.sideEffects?.sideEffects || 'No matched side-effects record was found. Check the official label with a pharmacist.';
    const sideEffectList = document.createElement('ul');
    const sideEffectItems = sideEffectText.split(';').map((part) => part.trim()).filter(Boolean).slice(0, 3);
    (sideEffectItems.length ? sideEffectItems : [sideEffectText]).forEach((part) => sideEffectList.append(makeTextElement('li', '', part.length > 220 ? `${part.slice(0, 217)}…` : part)));
    sideEffectPanel.append(sideEffectList);
    if (item.sideEffects) {
      const meta = makeTextElement('small', 'side-effect-meta', `${item.sideEffects.rxOtc || 'Prescription status not listed'}${item.sideEffects.pregnancyCategory ? ` · Pregnancy category ${item.sideEffects.pregnancyCategory}` : ''}`);
      sideEffectPanel.append(meta);
      if (item.sideEffects.drugLink) { const source = document.createElement('a'); source.className = 'side-effect-source'; source.href = item.sideEffects.drugLink; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Open source reference ↗'; sideEffectPanel.append(source); }
    }
    card.append(sideEffectPanel);
    card.append(makeTextElement('button', 'drug-link', 'Discuss with a clinician ↗'));
    grid.append(card);
  });
};
const showResults = (data) => {
  $('#analysis-loading').classList.add('is-hidden');
  $('#results-view').classList.remove('is-hidden');
  const prediction = data.prediction;
  $('#result-disease').textContent = prediction.label;
  $('#result-confidence').textContent = prediction.probability;
  $('#result-confidence-bar').style.width = `${Math.max(4, Math.min(100, prediction.probability))}%`;
  $('#result-explanation').textContent = prediction.explanation;
  $('#explainability-method').textContent = data.model?.explainability || 'Local feature impact';
  const pills = $('#input-pills');
  pills.innerHTML = '';
  (data.recognizedSymptoms || state.symptoms).forEach((symptom) => addPill(pills, symptom));
  if (data.ignoredSymptoms?.length) { const ignored = document.createElement('small'); ignored.className = 'ignored-inputs'; ignored.textContent = `${data.ignoredSymptoms.length} note${data.ignoredSymptoms.length === 1 ? '' : 's'} not in the dataset feature list`; pills.append(ignored); }
  const patient = data.patient || state.patient;
  $('#patient-summary').textContent = `Patient context · age ${patient.age ?? 'not provided'} · ${patient.gender || 'gender not provided'}`;
  const alternatives = $('#alternative-predictions');
  alternatives.innerHTML = '';
  (prediction.alternatives || []).forEach((item) => { const row = document.createElement('div'); row.className = 'alternative-row'; const label = document.createElement('span'); label.textContent = item.label; const probability = document.createElement('strong'); probability.textContent = `${item.probability}%`; row.append(label, probability); alternatives.append(row); });
  const impacts = $('#feature-impact-list');
  impacts.innerHTML = '';
  (data.featureImpacts || []).forEach((item) => { const row = document.createElement('div'); row.className = 'feature-impact-item'; const label = document.createElement('span'); label.textContent = formatSymptom(item.symptom); const value = document.createElement('strong'); value.textContent = `${item.impact >= 0 ? '+' : ''}${item.impact}%`; row.append(label, value); impacts.append(row); });
  renderDrugRecommendations(data.drugRecommendations);
  const questions = data.llm?.questions || [];
  $('#clinician-question').textContent = `“${questions[0] || 'What else could explain these symptoms, and what should I watch for?'}”`;
  $('#stack-meta').textContent = `${(data.model?.trainedRows || 0).toLocaleString()} rows · ${(data.drugEvidence?.sourceRows || 0).toLocaleString()} reviews indexed${data.llm?.enabled ? ' · LLM summary on' : ''}`;
};

$('#restart-button').addEventListener('click', () => {
  state.step = 1; state.symptoms = []; state.severity = ''; state.duration = 2; state.patient = { age: null, gender: 'prefer not to say', pregnancyStatus: 'not applicable', existingConditions: '' };
  $$('.symptom-chip, .severity-option').forEach((item) => item.classList.remove('selected'));
  $('#patient-age').value = ''; $('#patient-gender').value = 'female'; $('#patient-pregnancy').value = 'not applicable'; $('#patient-conditions').value = '';
  syncPregnancyField();
  $('#detail-input').value = ''; $('#symptom-search').value = ''; $('#duration-range').value = 2; $('#duration-value').textContent = '2 days';
  $('#analysis-section').classList.add('is-hidden'); renderSymptoms(); updateStep(1); scrollToTarget('#check-in');
});

const revealObserver = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); } }); }, { threshold: .13 });
$$('.reveal').forEach((item) => revealObserver.observe(item));

loadSymptomLibrary();
updateStep(1);
