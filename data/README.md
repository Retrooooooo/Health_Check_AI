# Dataset-backed model artifact

The model artifact in this directory was trained from the user-provided file:

`/home/ubuntu/upload/Final_Augmented_dataset_Diseases_and_Symptoms.csv`

The raw CSV is intentionally not copied into the browser bundle. Use the included script to reproduce the artifact when the source file is available:

```bash
python3 train_model.py /path/to/Final_Augmented_dataset_Diseases_and_Symptoms.csv data/disease-model.json
```

Current training summary: 246,945 rows, 773 disease labels, 377 binary symptom features. See the repository-level `MODEL_CARD.md` for algorithm scope, explainability, and advanced-module status.

The medication evidence artifact was aggregated from:

`/home/ubuntu/upload/drug_review_test(main).csv`

Reproduce it with:

```bash
python3 train_drug_reviews.py "/path/to/drug_review_test(main).csv" data/drug-review-model.json
```

Current review summary: 46,108 reviews, 2,283 drugs, 652 conditions. The UI uses this artifact only for review-informed educational context.

The side-effects reference artifact was built from:

`/home/ubuntu/upload/drugs_side_effects_drugs_com.csv`

Reproduce it with:

```bash
python3 train_drug_side_effects.py "/path/to/drugs_side_effects_drugs_com.csv" data/drug-side-effects-model.json
```

Current side-effects reference summary: 2,931 rows. The UI shows a short side-effects excerpt below matched drug evidence cards and links to the source record when available.
