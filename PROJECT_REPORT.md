# Health Check AI — Short Project Report

## 1. Project overview

**Health Check AI** is an olive-green, animated web application that helps users organize symptoms, view possible disease patterns, and prepare questions for a licensed clinician. It is designed as an educational decision-support prototype, not as a diagnostic or prescribing system.

The application combines:

- Guided patient information and symptom entry
- Dataset-backed disease-pattern prediction
- Local feature-impact explanations
- Review-informed medication context
- Side-effects reference information
- Optional large-language-model summaries and clinician questions
- Persistent safety messaging and emergency-care guidance

## 2. Application architecture

| Layer | Implementation |
| --- | --- |
| Frontend | Semantic HTML, CSS animations, responsive layout, and browser JavaScript |
| Runtime | Lightweight Node.js HTTP server |
| Disease API | `GET /api/symptoms` and `POST /api/predict` |
| Disease artifact | `data/disease-model.json` |
| Drug-review artifact | `data/drug-review-model.json` |
| Side-effects artifact | `data/drug-side-effects-model.json` |
| Language layer | Managed `gpt-5-mini` call for educational explanation only, with deterministic fallback |

## 3. Data sources

### Disease and symptom dataset

The uploaded disease/symptom matrix contains:

- **246,945 rows**
- **773 disease labels**
- **377 binary symptom features**

Age, gender, pregnancy status, and known conditions are collected by the interface as patient context. They are not learned predictors because those fields are not present in the training matrix.

### Drug-review dataset

The uploaded review dataset contains:

- **46,108 reviews**
- **2,283 drugs**
- **652 conditions**

The review data is aggregated by drug and condition using rating, review count, useful-count volume, and Bayesian shrinkage toward the global mean.

### Side-effects reference dataset

The uploaded side-effects reference dataset contains **2,931 medication records**. The application indexes drug names, generic names, drug classes, Rx/OTC status, pregnancy category, side-effects text, and source links.

## 4. Methods and models

### Disease-pattern model

The live disease model is a **presence-only Multinomial Naive Bayes classifier with Laplace smoothing**. Selected symptoms are converted into feature indices, scored against disease priors and symptom likelihoods, and ranked using a softmax transformation.

The result is presented as a **possible pattern** with a match score. It is not treated as a confirmed diagnosis.

### Explainability method

For each selected symptom, the API removes that symptom and recomputes the top-pattern probability. The change is returned as a local feature impact. This is a deterministic **SHAP/LIME-style ablation explanation** for the current model.

### Drug evidence ranking

Drug-review recommendations are not generated as prescriptions. The application:

1. Matches predicted disease-pattern labels to review conditions using exact, substring, and token-overlap similarity.
2. Ranks drugs by review count, average rating, useful-count volume, and Bayesian-shrunk evidence score.
3. Returns up to four review-informed educational signals.
4. Displays review volume and condition matching so users can judge how much evidence is represented.

### Side-effects lookup

Each matched drug is looked up by drug name, generic name, or brand name. The results card displays a short side-effects excerpt, Rx/OTC status, pregnancy category when available, and a reference link. The information is explicitly labeled as something to verify with a clinician or pharmacist.

### LLM explanation layer

When managed LLM access is available, `gpt-5-mini` writes a short safety-constrained explanation and clinician questions. It does **not** produce the disease score, select the medication, provide dosage, or prescribe treatment. A deterministic explanation is used when the LLM is unavailable.

### Requested advanced modules

BioBERT/ClinicalBERT, XGBoost, and reinforcement learning are not active in the live score:

- The disease dataset contains binary symptom columns, not clinical narrative text for BioBERT/ClinicalBERT.
- No trained XGBoost artifact or calibration evaluation is included.
- The dataset has no action, reward, or longitudinal feedback labels for reinforcement learning.

These modules should only be added after suitable data, training, validation, and clinical review are available.

## 5. User procedure

1. Open the Health Check AI application.
2. Enter the patient’s age and optional context such as gender, pregnancy status, and known conditions.
3. Search and select symptoms from the uploaded dataset library.
4. Add optional free-text context in **“Anything else you’d like to add?”**.
5. Select symptom intensity and duration.
6. Review the possible disease patterns and local symptom impacts.
7. Review any matched drug-review signals and the side-effects reference panel.
8. Use the suggested clinician questions in a professional care conversation.
9. Seek emergency help immediately for severe or life-threatening symptoms.

## 6. Reproducibility procedure

From the project directory:

```bash
python3 train_model.py /path/to/Final_Augmented_dataset_Diseases_and_Symptoms.csv data/disease-model.json
python3 train_drug_reviews.py "/path/to/drug_review_test(main).csv" data/drug-review-model.json
python3 train_drug_side_effects.py "/path/to/drugs_side_effects_drugs_com.csv" data/drug-side-effects-model.json
npm start
```

The server listens on the configured preview port and exposes the prediction API used by the browser interface.

## 7. Safety and limitations

Health Check AI is an educational prototype. Patient reviews are self-reported and do not establish medication safety or efficacy. The disease model has not been prospectively validated or clinically calibrated. Results can be incomplete, incorrect, or biased by the source data.

The application must not be used to self-diagnose, select medication, determine dosage, or delay emergency care. A production clinical deployment would require prospective validation, calibration, subgroup fairness analysis, privacy review, clinician oversight, and applicable regulatory review.
