# Health Check AI — Outcomes

## Animated landing experience
- [x] The website introduces an AI-assisted disease predictor and drug recommendation workflow in an olive green visual theme.
- [x] The landing experience includes smooth transitions, micro-interactions, hover states, and loading animations.

## Guided symptom entry
- [x] Users can select symptoms, choose severity, set duration, and add relevant health details.
- [x] Controls are keyboard-friendly and provide visible focus states.
- [x] The gender selector contains exactly Female, Male, and Other, and selecting Male locks pregnancy status to Not pregnant with a visible locked-state note.

## Analysis state and safety framing
- [x] The analysis state communicates progress without implying diagnostic certainty.
- [x] A prominent medical disclaimer and emergency-care guidance remain visible throughout high-risk interactions.

## Prediction and medication results
- [x] The results view presents possible conditions, confidence indicators, and plain-language explanations.
- [x] Drug recommendation cards show intended use, common cautions, and a prompt to consult a licensed clinician.

## Responsive accessibility
- [x] The interface is responsive across desktop and mobile layouts, uses readable contrast, and supports reduced motion.

## Dataset-backed prediction
- [x] The uploaded disease/symptom CSV is used to train a compact model with 246,945 rows, 773 disease labels, and 377 symptom features.
- [x] The check-in asks for age, gender, pregnancy status, and known conditions while preserving the existing “Anything else you’d like to add?” field.
- [x] The results view returns dataset-backed possible patterns, alternative patterns, local feature impacts, and a safety disclaimer.
- [x] The LLM is limited to plain-language safety framing and clinician questions; it does not produce the disease score or a prescription.

## Review-informed drug context
- [x] The provided drug-review CSV is aggregated into condition/drug evidence with 46,108 reviews, 2,283 drugs, and 652 conditions.
- [x] Results match possible disease patterns to review conditions and show up to four review-informed educational signals with rating and review-count context.
- [x] The interface explicitly states that reviews are not safety, efficacy, or prescription evidence and falls back without inventing a drug match.

## Side-effects reference context
- [x] The provided side-effects CSV is indexed into a compact lookup artifact with medication names, generic names, Rx/OTC status, pregnancy category, side-effects text, and source links.
- [x] Each matched medication card shows a side-effects panel immediately after the review-informed recommendation.
- [x] Side-effects are presented as reference information with official-source links and clinician/pharmacist review prompts, not as a dosage or treatment instruction.
