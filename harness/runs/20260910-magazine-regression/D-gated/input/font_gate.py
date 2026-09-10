"""Experimental v3 font-size gate. Checks actual PPTX, never the builder registry.
Numeric prerequisite only: semantic roles, layout and source fidelity require review.
"""
import json
import subprocess
import sys
from pathlib import Path

src, report = map(Path, sys.argv[1:3])
inventory = report.with_suffix('.inventory.json')
subprocess.run([sys.executable, str(Path(__file__).with_name('inspect_pptx.py')),
                str(src), str(inventory)], check=True)
data = json.loads(inventory.read_text(encoding='utf-8'))
# V3 role sizes; 13 is the experimentally fixed page-number role, matching baseline.
allowed = [13, 15, 17, 21, 25, 48, 58]
issues = []
for page in data['pages']:
    for obj in page['textObjects']:
        for run in obj['runs']:
            if not run['text'].strip():
                continue
            size = run['designSize']
            if size is None or not any(abs(size - n) < .05 for n in allowed):
                issues.append({'slide': page['slide'], 'object': obj['identity'],
                               'text': run['text'], 'actualDesignSize': size,
                               'reason': 'No explicit size resolved' if size is None else 'Outside frozen v3 size palette'})
out = {'status': 'fail' if issues else 'pass', 'sha256': data['sha256'],
       'allowedDesignSizes': allowed, 'issues': issues,
       'limits': 'Not a role, font-family, semantic, geometry or visual pass. Master-inherited unresolved values need explicit resolution.'}
report.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'fontGate': out['status'], 'issues': len(issues)}))
sys.exit(1 if issues else 0)
