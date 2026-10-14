import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 3000);
const modelPath = join(root, 'data', 'disease-model.json');
const drugModelPath = join(root, 'data', 'drug-review-model.json');
const sideEffectModelPath = join(root, 'data', 'drug-side-effects-model.json');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const model = JSON.parse(await readFile(modelPath, 'utf8'));
const drugModel = JSON.parse(await readFile(drugModelPath, 'utf8'));
const sideEffectModel = JSON.parse(await readFile(sideEffectModelPath, 'utf8'));

const titleCase = (value) => value.split(' ').map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(' ');
const cleanText = (value, max = 800) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const softmax = (scores) => { const max = Math.max(...scores); const exps = scores.map((score) => Math.exp(Math.max(-60, score - max))); const total = exps.reduce((sum, value) => sum + value, 0) || 1; return exps.map((value) => value / total); };
const scoreModel = (featureIndices) => model.logPriors.map((prior, diseaseIndex) => prior + featureIndices.reduce((sum, featureIndex) => sum + model.logLikelihoods[diseaseIndex][featureIndex], 0));
const probabilitiesFor = (featureIndices) => softmax(scoreModel(featureIndices));

const resolveFeatureIndices = (symptoms) => {
  const recognized = [];
  const ignored = [];
  const indices = [];
  for (const raw of Array.isArray(symptoms) ? symptoms : []) {
    const value = cleanText(raw, 120).toLowerCase();
    const index = model.featureIndex[value];
    if (Number.isInteger(index)) {
      if (!indices.includes(index)) { indices.push(index); recognized.push(value); }
    } else if (value && !ignored.includes(value)) ignored.push(value);
  }
  return { indices, recognized, ignored };
};

const buildFeatureImpacts = (indices, topDiseaseIndex, fullProbabilities) => indices.map((featureIndex) => {
  const without = indices.filter((index) => index !== featureIndex);
  const withoutProbability = probabilitiesFor(without)[topDiseaseIndex];
  const delta = fullProbabilities[topDiseaseIndex] - withoutProbability;
  return { symptom: model.features[featureIndex], impact: Number((delta * 100).toFixed(1)), direction: delta >= 0 ? 'supports' : 'weakens' };
}).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

const stopWords = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'due', 'to', 'with', 'or', 'in', 'on', 'as', 'unspecified', 'other']);
const tokenSet = (value) => new Set(cleanText(value, 180).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((token) => token && !stopWords.has(token)));
const phraseSimilarity = (left, right) => {
  const a = cleanText(left, 180).toLowerCase();
  const b = cleanText(right, 180).toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const leftTokens = tokenSet(a);
  const rightTokens = tokenSet(b);
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  return intersection / union;
};

const buildDrugRecommendations = (patterns) => {
  const matchedConditions = [];
  patterns.forEach((pattern, patternIndex) => {
    drugModel.conditions.forEach((condition) => {
      const similarity = phraseSimilarity(pattern, condition.condition);
      if (similarity >= 0.4) matchedConditions.push({ condition, similarity: similarity * (patternIndex === 0 ? 1 : 0.78), pattern });
    });
  });
  matchedConditions.sort((a, b) => b.similarity - a.similarity || b.condition.reviewCount - a.condition.reviewCount);
  const recommendations = [];
  const seenDrugs = new Set();
  for (const match of matchedConditions) {
    for (const drug of match.condition.drugs) {
      const key = drug.drug.toLowerCase();
      if (seenDrugs.has(key)) continue;
      seenDrugs.add(key);
      recommendations.push({
        drug: drug.drug,
        label: drug.label,
        condition: match.condition.condition,
        conditionLabel: match.condition.label,
        matchedPattern: titleCase(match.pattern),
        matchScore: Math.round(match.similarity * 100),
        averageRating: drug.averageRating,
        reviewCount: drug.reviewCount,
        usefulCount: drug.usefulCount,
        evidenceScore: drug.evidenceScore,
      });
      if (recommendations.length >= 4) return recommendations;
    }
  }
  return recommendations;
};

const normalizeDrugKey = (value) => cleanText(value, 180).toLowerCase().replace(/[^a-z0-9]+/g, '');
const sideEffectAliases = (record) => [record.drugName, record.genericName, ...(record.brandNames || '').split(/[,;|]/)].map(normalizeDrugKey).filter(Boolean);
const findSideEffectRecord = (drugName) => {
  const target = normalizeDrugKey(drugName);
  if (!target) return null;
  const exact = sideEffectModel.drugs.find((record) => sideEffectAliases(record).includes(target));
  if (exact) return exact;
  let best = { score: 0, record: null };
  for (const record of sideEffectModel.drugs) {
    for (const alias of sideEffectAliases(record)) {
      const score = phraseSimilarity(drugName, alias);
      if (score > best.score) best = { score, record };
    }
  }
  return best.score >= 0.75 ? best.record : null;
};
const attachSideEffects = (recommendations) => recommendations.map((recommendation) => {
  const record = findSideEffectRecord(recommendation.drug);
  return { ...recommendation, sideEffects: record ? { drugName: record.drugName, genericName: record.genericName, sideEffects: record.sideEffects, drugClasses: record.drugClasses, rxOtc: record.rxOtc, pregnancyCategory: record.pregnancyCategory, drugLink: record.drugLink, medicalConditionUrl: record.medicalConditionUrl } : null };
});

const deterministicSummary = (topDisease, recognized, patient) => {
  const symptoms = recognized.slice(0, 3).map(titleCase).join(', ');
  const ageText = Number.isFinite(patient.age) ? ` for a ${patient.age}-year-old patient` : '';
  return `The dataset-trained model found the strongest symptom pattern for ${titleCase(topDisease)}${ageText}. It considered ${symptoms || 'the selected symptoms'}; this is a possibility to discuss with a licensed clinician, not a diagnosis.`;
};

const askManagedLlmForSummary = async ({ topDisease, alternatives, recognized, patient, narrative }) => {
  const baseUrl = process.env.BUILT_IN_FORGE_API_URL;
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const prompt = ['Write a concise, safety-first educational summary for a symptom prediction UI.', 'Never diagnose, prescribe, recommend dosage, or imply certainty. Use the phrase possible pattern, never most likely, you have, or any definitive diagnosis language. Encourage a licensed clinician. Do not recommend a medication.', `Dataset model top possible pattern: ${topDisease}.`, `Other possible patterns: ${alternatives.join(', ') || 'none available'}.`, `Recognized symptoms: ${recognized.join(', ') || 'none'}.`, `Patient context: age=${patient.age ?? 'not provided'}, gender=${patient.gender || 'not provided'}.`, narrative ? `Patient note: ${narrative}` : '', 'Return JSON with summary (one or two sentences), questions (array of two clinician questions), and warning (one sentence).'].filter(Boolean).join('\n');
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5-mini', messages: [{ role: 'system', content: 'You are a careful health-information writing assistant. Do not provide medical diagnosis or treatment.' }, { role: 'user', content: prompt }], max_completion_tokens: 300, reasoning: { effort: 'minimal' }, response_format: { type: 'json_schema', json_schema: { name: 'safe_health_summary', strict: true, schema: { type: 'object', properties: { summary: { type: 'string' }, questions: { type: 'array', items: { type: 'string' } }, warning: { type: 'string' } }, required: ['summary', 'questions', 'warning'], additionalProperties: false } } } }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (!parsed.summary || !Array.isArray(parsed.questions) || !parsed.warning) return null;
    return { summary: cleanText(parsed.summary, 500), questions: parsed.questions.slice(0, 3).map((item) => cleanText(item, 220)), warning: cleanText(parsed.warning, 300) };
  } catch { return null; }
};

const predict = async (payload) => {
  const { indices, recognized, ignored } = resolveFeatureIndices(payload.symptoms);
  if (!indices.length) { const error = new Error('Select at least one symptom from the uploaded dataset symptom library.'); error.statusCode = 422; throw error; }
  const patient = payload.patient && typeof payload.patient === 'object' ? payload.patient : {};
  const age = Number(patient.age);
  const safePatient = { age: Number.isFinite(age) && age >= 0 && age <= 120 ? Math.round(age) : null, gender: cleanText(patient.gender, 60), pregnancyStatus: cleanText(patient.pregnancyStatus, 80), existingConditions: cleanText(patient.existingConditions, 240) };
  const probabilities = probabilitiesFor(indices);
  const ranking = probabilities.map((probability, diseaseIndex) => ({ diseaseIndex, probability })).sort((a, b) => b.probability - a.probability).slice(0, 5);
  const top = ranking[0];
  const alternatives = ranking.slice(1, 4);
  const patterns = ranking.slice(0, 4).map((item) => model.labels[item.diseaseIndex]);
  const llmSummary = await askManagedLlmForSummary({ topDisease: patterns[0], alternatives: patterns.slice(1), recognized, patient: safePatient, narrative: cleanText(payload.anythingElse, 500) });
  const localSummary = deterministicSummary(patterns[0], recognized, safePatient);
  return {
    prediction: { disease: patterns[0], label: titleCase(patterns[0]), probability: Number((top.probability * 100).toFixed(1)), explanation: llmSummary?.summary || localSummary, alternatives: alternatives.map((item) => ({ disease: model.labels[item.diseaseIndex], label: titleCase(model.labels[item.diseaseIndex]), probability: Number((item.probability * 100).toFixed(1)) })) },
    patient: safePatient,
    recognizedSymptoms: recognized,
    ignoredSymptoms: ignored,
    featureImpacts: buildFeatureImpacts(indices, top.diseaseIndex, probabilities).slice(0, 8),
    drugRecommendations: attachSideEffects(buildDrugRecommendations(patterns)),
    drugEvidence: { algorithm: drugModel.algorithm, sourceRows: drugModel.sourceRows, drugCount: drugModel.drugCount, conditionCount: drugModel.conditionCount, globalMeanRating: drugModel.globalMeanRating },
    sideEffectEvidence: { algorithm: sideEffectModel.algorithm, sourceRows: sideEffectModel.sourceRows },
    llm: llmSummary ? { enabled: true, model: 'gpt-5-mini', questions: llmSummary.questions, warning: llmSummary.warning } : { enabled: false, model: null, questions: ['What else could explain these symptoms?', 'What changes should prompt me to seek care sooner?'], warning: 'This output is educational context only and should be reviewed with a licensed clinician.' },
    model: { algorithm: model.algorithm, trainedRows: model.trainedRows, diseaseCount: model.diseaseCount, featureCount: model.featureCount, explainability: 'SHAP/LIME-style local feature ablation', advancedModules: { xgboost: { status: 'adapter-ready', note: 'Requires a separately trained gradient-boosted artifact for calibrated ensemble scoring.' }, biobertClinicalbert: { status: 'not-used', note: 'The uploaded CSV contains binary symptom columns, not clinical narrative text.' }, reinforcementLearning: { status: 'not-used', note: 'Disease prediction has no action/reward/longitudinal feedback labels in this dataset.' } } },
    disclaimer: 'Possible pattern only — not a diagnosis, prescription, or substitute for professional medical advice.',
  };
};

const sendJson = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
const readBody = async (req) => { let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 100000) throw new Error('Request too large'); } return JSON.parse(body || '{}'); };
const handleApi = async (req, res, requestPath) => {
  if (req.method === 'GET' && requestPath === '/api/symptoms') { const symptoms = model.features.map((feature, index) => ({ feature, frequency: model.featurePositiveCounts[index] })).sort((a, b) => b.frequency - a.frequency); return sendJson(res, 200, { symptoms, trainedRows: model.trainedRows, featureCount: model.featureCount }); }
  if (req.method === 'POST' && requestPath === '/api/predict') { try { return sendJson(res, 200, await predict(await readBody(req))); } catch (error) { return sendJson(res, error.statusCode || 400, { error: error.message || 'Unable to score this check-in.' }); } }
  return sendJson(res, 404, { error: 'API route not found' });
};

const server = http.createServer(async (req, res) => {
  const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (requestPath.startsWith('/api/')) return handleApi(req, res, requestPath);
  const requested = requestPath === '/' ? '/index.html' : requestPath;
  const safePath = normalize(requested).replace(/^\.\.(\/|\\)/, '');
  const filePath = safePath.startsWith('/manus-routes.json') ? join(root, 'public', 'manus-routes.json') : join(root, safePath);
  try { const body = await readFile(filePath); res.writeHead(200, { 'Content-Type': types[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(body); } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Health Check AI ML runtime listening on ${port} with ${model.trainedRows} training rows and ${drugModel.sourceRows} drug reviews`));
