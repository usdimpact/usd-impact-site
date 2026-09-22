"""Separate catalog DDL statements in the test loader; preserve schema snapshots."""
from pathlib import Path
import ast, hashlib, json
p=Path('packet/pilot.py')
s=p.read_text()
old="return '\\n'.join(data[name+'.sql'] for name in order)"
new="return '\\n;\\n'.join(data[name+'.sql'] for name in order)"
if s.count(old)!=1:
    raise RuntimeError('SCHEMA_LOADER_SHAPE_CHANGED')
before=hashlib.sha256(s.encode()).hexdigest()
s=s.replace(old,new)
ast.parse(s)
p.write_text(s)
m=Path('evidence/full-schema-harness-provenance.json')
d=json.loads(m.read_text())
d['priorDerivedPilotSha256']=before
d['derivedPilotSha256']=hashlib.sha256(s.encode()).hexdigest()
d['loaderCorrection']='Separate pg_get_functiondef catalog outputs with statement delimiters; source function bodies and application modules unchanged.'
m.write_text(json.dumps(d,indent=2)+'\n')
print('CATALOG_DDL_SEPARATORS_FIXED')
