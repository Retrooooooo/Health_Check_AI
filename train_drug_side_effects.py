#!/usr/bin/env python3
"""Build a compact drug-name to side-effects reference index."""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

csv.field_size_limit(sys.maxsize)
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/home/ubuntu/upload/drugs_side_effects_drugs_com.csv')
OUTPUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('data/drug-side-effects-model.json')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

clean = lambda value: re.sub(r'\s+', ' ', (value or '').strip())
rows = []
seen = set()
with SOURCE.open('r', newline='', encoding='utf-8-sig') as handle:
    reader = csv.DictReader(handle)
    for row in reader:
        drug = clean(row.get('drug_name'))
        condition = clean(row.get('medical_condition'))
        if not drug:
            continue
        key = (drug.lower(), clean(row.get('generic_name')).lower(), condition.lower())
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            'drugName': drug,
            'condition': condition,
            'sideEffects': clean(row.get('side_effects'))[:1400],
            'genericName': clean(row.get('generic_name')),
            'drugClasses': clean(row.get('drug_classes')),
            'brandNames': clean(row.get('brand_names')),
            'rxOtc': clean(row.get('rx_otc')),
            'pregnancyCategory': clean(row.get('pregnancy_category')),
            'drugLink': clean(row.get('drug_link')),
            'medicalConditionUrl': clean(row.get('medical_condition_url')),
        })

model = {
    'version': 1,
    'algorithm': 'reference lookup by drug/generic/brand name',
    'sourceRows': len(rows),
    'drugs': rows,
}
with OUTPUT.open('w', encoding='utf-8') as handle:
    json.dump(model, handle, separators=(',', ':'))
print(json.dumps({'source': str(SOURCE), 'output': str(OUTPUT), 'rows': len(rows), 'modelBytes': OUTPUT.stat().st_size}, indent=2))
