# Health Check AI disease prediction model card

## What is trained and running

The uploaded `Final_Augmented_dataset_Diseases_and_Symptoms.csv` is a binary disease/symptom matrix with **246,945 rows, 773 disease labels, and 377 symptom features**. The included `train_model.py` streams that file and trains a presence-only, Laplace-smoothed Multinomial Naive Bayes model. The resulting compact artifact is `data/disease-model.json` and is served through `POST /api/predict`.

Age, gender, pregnancy status, and known conditions are collected as patient context in the UI. The uploaded CSV has no age, gender, outcome, or longitudinal fields, so those details are not used as learned predictors. They are returned in the check-in summary and can be used by the optional language layer to write safer context.

## Explainability

The prediction response includes local feature impact by removing each selected symptom and measuring the change in the top disease probability. This is a deterministic **SHAP/LIME-style local ablation** explanation for the current model, not a claim that the external SHAP or LIME packages are installed.

## Requested advanced modules

| Module | Status | Reason |
| --- | --- | --- |
| Dataset ML baseline | Active | Trained directly from the uploaded matrix. |
| LLM | Active when managed LLM credentials are present | `gpt-5-mini` writes a short, safety-constrained explanation and clinician questions; it does not produce the disease score. A deterministic fallback is used if unavailable. |
| SHAP/LIME | Active as local feature ablation | Appropriate for explaining the compact baseline without fabricating a library result. |
| XGBoost | Adapter-ready, not used in the live score | The runtime has no trained XGBoost artifact. A calibrated gradient-boosted ensemble requires a separate training/evaluation step. |
| BioBERT / ClinicalBERT | Not used | The uploaded data has binary symptom columns and no clinical narrative text. Transformer inference would be unsupported by the current training data. |
| Reinforcement learning | Not used | Disease prediction has no action, reward, or longitudinal feedback labels here; adding RL would be methodologically and clinically unsafe without them. |

## Safety boundaries

## Drug-review evidence layer

The supplied `drug_review_test(main).csv` contains **46,108 reviews, 2,283 drugs, and 652 conditions**. `train_drug_reviews.py` aggregates each drug/condition pair using review count, average rating, useful-count volume, and Bayesian shrinkage toward the global mean. The API matches the model's possible-pattern labels to review conditions using exact, substring, and token-overlap similarity, then returns up to four review-informed educational signals.

These are **not efficacy, safety, or prescription recommendations**. Patient reviews are observational and self-reported. The UI labels them as review-informed signals and directs the user to a clinician or pharmacist. If no condition match exists, the UI does not invent a drug recommendation.

## Side-effects reference layer

The supplied `drugs_side_effects_drugs_com.csv` contains 2,931 medication reference rows. `train_drug_side_effects.py` keeps the drug name, generic name, classes, Rx/OTC flag, pregnancy category, side-effects text, and source links in `data/drug-side-effects-model.json`. Each review-matched medication card now shows a short side-effects panel directly below the evidence card and links back to the reference source when available. The panel is a reference prompt only; users should verify the official label with a clinician or pharmacist.

Results are possible patterns, not diagnoses or prescriptions. Medication cards are general educational prompts only. Severe or life-threatening symptoms should be directed to local emergency services. A production clinical deployment would require prospective validation, calibration, subgroup fairness testing, privacy review, clinician oversight, and regulatory review before use in care.
