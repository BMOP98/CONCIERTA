"""Smoke tests for a running local CONCIERTA stack. Run: python scripts/smoke_test.py"""
import json,urllib.request
urls=['http://localhost:8001/health','http://localhost:8002/health','http://localhost:8003/health','http://localhost:8002/scenario','http://localhost:8002/events']
for url in urls:
 try:
  with urllib.request.urlopen(url,timeout=5) as res:
   data=json.load(res);assert res.status==200
   if url.endswith('/scenario'):
    assert len(data)==1 and len(data[0]['Sections'])==5
    assert sum(s['capacity'] for s in data[0]['Sections'])==data[0]['capacity']
   if url.endswith('/events'):assert len(data)>=4
   print('OK',url)
 except Exception as e:
  print('FAIL',url,repr(e));raise SystemExit(1)
print('Smoke tests terminados correctamente')
