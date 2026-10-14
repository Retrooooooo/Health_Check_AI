#!/usr/bin/env python3
"""Train a compact presence-only Multinomial Naive Bayes model from the uploaded matrix."""
from __future__ import annotations

import csv
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

csv.field_size_limit(sys.maxsize)

SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/home/ubuntu/upload/Final_Augmented_dataset_Diseases_and_Symptoms.csv')
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('data/disease-model.json')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

with SOURCE.open('r', newline='', encoding='utf-8-sig') as handle:
    reader = csv.reader(handle)
    raw_header = next(reader)
    feature_names = [cell.strip().lower() for cell in raw_header[1:]]
    feature_positive = [0] * len(feature_names)
    class_rows: dict[str, int] = defaultdict(int)
    class_positive: dict[str, list[int]] = {}
    row_count = 0
    for row in reader:
        if not row:
            continue
        label = row[0].strip().lower()
        if not label:
            continue
        if label not in class_positive:
            class_positive[label] = [0] * len(feature_names)
        class_rows[label] += 1
        counts = class_positive[label]
        for index, value in enumerate(row[1:]):
            if value.strip().lower() in {'1', '1.0', 'true', 'yes'}:
                counts[index] += 1
                feature_positive[index] += 1
        row_count += 1
        if row_count % 50000 == 0:
            print(f'processed {row_count} rows', flush=True)

labels = sorted(class_rows)
label_index = {label: index for index, label in enumerate(labels)}
feature_index = {name: index for index, name in enumerate(feature_names)}
class_sizes = [class_rows[label] for label in labels]
total_rows = sum(class_sizes)

# Presence-only likelihoods: missing symptoms are not treated as negative evidence.
# Laplace smoothing prevents zero-probability scores for sparse symptom combinations.
log_priors = [math.log(size / total_rows) for size in class_sizes]
log_likelihoods = []
for label in labels:
    size = class_rows[label]
    row = class_positive[label]
    log_likelihoods.append([round(math.log((positive + 1) / (size + 2)), 8) for positive in row])

model = {
    'version': 1,
    'algorithm': 'presence-only Multinomial Naive Bayes with Laplace smoothing',
    'trainedRows': total_rows,
    'diseaseCount': len(labels),
    'featureCount': len(feature_names),
    'labels': labels,
    'classSizes': class_sizes,
    'logPriors': [round(value, 8) for value in log_priors],
    'features': feature_names,
    'featureIndex': feature_index,
    'featurePositiveCounts': feature_positive,
    'logLikelihoods': log_likelihoods,
}

with OUTPUT.open('w', encoding='utf-8') as handle:
    json.dump(model, handle, separators=(',', ':'))

print(json.dumps({
    'source': str(SOURCE),
    'output': str(OUTPUT),
    'rows': total_rows,
    'diseases': len(labels),
    'features': len(feature_names),
    'modelBytes': OUTPUT.stat().st_size,
}, indent=2))
