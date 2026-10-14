#!/usr/bin/env python3
"""Aggregate the supplied drug reviews into a compact condition/drug evidence index."""
from __future__ import annotations

import csv
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

csv.field_size_limit(sys.maxsize)
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/home/ubuntu/upload/drug_review_test(main).csv')
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('data/drug-review-model.json')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

clean = lambda value: re.sub(r'\s+', ' ', (value or '').strip().lower())
aggregates = defaultdict(lambda: defaultdict(lambda: {'count': 0, 'rating_sum': 0.0, 'useful_sum': 0}))
condition_counts = defaultdict(int)
ratings = []
row_count = 0

with SOURCE.open('r', newline='', encoding='utf-8-sig') as handle:
    reader = csv.DictReader(handle)
    for row in reader:
        condition = clean(row.get('condition'))
        drug = clean(row.get('drugName'))
        if not condition or not drug:
            continue
        try:
            rating = float(row.get('rating', ''))
        except (TypeError, ValueError):
            continue
        try:
            useful = max(0, int(float(row.get('usefulCount', '0'))))
        except (TypeError, ValueError):
            useful = 0
        entry = aggregates[condition][drug]
        entry['count'] += 1
        entry['rating_sum'] += rating
        entry['useful_sum'] += useful
        condition_counts[condition] += 1
        ratings.append(rating)
        row_count += 1

global_mean = sum(ratings) / len(ratings) if ratings else 0.0
prior_strength = 8
conditions = []
for condition, drugs in aggregates.items():
    ranked = []
    for drug, stats in drugs.items():
        count = stats['count']
        average = stats['rating_sum'] / count
        # Bayesian shrinkage keeps one-review drugs from dominating.
        evidence_score = (count / (count + prior_strength)) * average + (prior_strength / (count + prior_strength)) * global_mean
        ranked.append({
            'drug': drug,
            'label': drug.title(),
            'reviewCount': count,
            'averageRating': round(average, 2),
            'usefulCount': stats['useful_sum'],
            'evidenceScore': round(evidence_score, 3),
        })
    ranked.sort(key=lambda item: (item['evidenceScore'], item['reviewCount'], item['usefulCount']), reverse=True)
    conditions.append({
        'condition': condition,
        'label': condition.title(),
        'reviewCount': condition_counts[condition],
        'drugs': ranked[:6],
    })
conditions.sort(key=lambda item: item['reviewCount'], reverse=True)

model = {
    'version': 1,
    'algorithm': 'Bayesian-shrunk review evidence aggregation',
    'sourceRows': row_count,
    'drugCount': len({drug for drugs in aggregates.values() for drug in drugs}),
    'conditionCount': len(conditions),
    'globalMeanRating': round(global_mean, 3),
    'conditions': conditions,
}
with OUTPUT.open('w', encoding='utf-8') as handle:
    json.dump(model, handle, separators=(',', ':'))
print(json.dumps({
    'source': str(SOURCE),
    'output': str(OUTPUT),
    'rows': row_count,
    'drugs': model['drugCount'],
    'conditions': model['conditionCount'],
    'globalMeanRating': model['globalMeanRating'],
    'modelBytes': OUTPUT.stat().st_size,
}, indent=2))
