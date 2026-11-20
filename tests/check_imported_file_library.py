"""Original PDF inventory is derived read-only and respects live management scopes."""
import hashlib
import json
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store


def main():
    seeds=json.loads(Path('data/documents.json').read_text(encoding='utf-8-sig'))
    hashes={d['file']['href']:hashlib.sha256(Path(d['file']['href']).read_bytes()).hexdigest() for d in seeds}
    config=replace(settings,admin_identity_claim='sub',system_admin_ids=('ROOT',))
    with TemporaryDirectory() as directory, patch.object(store,'directory',Path(directory)), patch('backend.main.settings',config):
        def login(identity):
            c=TestClient(app)
            c.cookies.set('medresearch_session',signed_session_cookie(sessions.create({'name':identity},{'sub':identity})))
            c.headers['x-csrf-token']=c.get('/api/manage').json().get('csrf','')
            return c
        root=login('ROOT')
        for identity,role,units in [('BIO','unit_admin',['biobank']),('AI','unit_admin',['ai-center']),('SITE','site_admin',[])]:
            assert root.put('/api/manage/grants',json=dict(identity=identity,role=role,units=units,active=True,revision=None)).status_code==200
        bio,ai,site,ordinary=map(login,['BIO','AI','SITE','ORDINARY'])
        assert TestClient(app).get('/api/manage/files').status_code==401
        assert ordinary.get('/api/manage/files').status_code==403
        state_before=(Path(directory)/'state.json').read_bytes()
        paths_before=set(Path(directory).iterdir())
        response=bio.get('/api/manage/files')
        assert response.status_code==200 and response.headers['cache-control']=='no-store'
        items=response.json()['items']
        assert len(items)==len({f['id'] for f in items})==len({f['url'] for f in items})==9
        by_url={f['url']:f for f in items}
        for seed in seeds:
            item=by_url[seed['file']['href']]
            assert item['source']=='imported' and item['unit']=='biobank'
            assert item['original_name']==Path(item['url']).name and item['size']==Path(item['url']).stat().st_size
            assert item['source_url']==seed['source_url'] and item['source_checked_at']==seed['source_checked_at']
            assert item['source_note']==seed['source_note']
            assert item['uploaded_at']==''
            uses=[u for u in item['usages'] if u['kind']=='documents']
            assert len(uses)==1 and uses[0]['id']==seed['id'] and uses[0]['relation']=='reference'
            assert TestClient(app).get('/'+item['url']).content==Path(item['url']).read_bytes()
        assert not ai.get('/api/manage/files').json()['items']
        assert ai.get('/api/manage/files?unit=biobank').status_code==403
        assert len(root.get('/api/manage/files').json()['items'])==len(site.get('/api/manage/files?unit=biobank').json()['items'])==9
        assert not bio.get('/api/manage/files?unit=biobank&include_imported=false').json()['items']
        assert (Path(directory)/'state.json').read_bytes()==state_before
        assert set(Path(directory).iterdir())==paths_before and not store.read()['files']
        # Correspondence comes from current records, not frozen seed titles or statuses.
        entry=next(e for e in bio.get('/api/manage/content/documents').json()['items'] if e['value']['id']=='biobank-consent')
        endpoint='/api/manage/content/documents/biobank-consent'
        saved=bio.put(endpoint,json={**entry,'value':{**entry['value'],'title':'更新文件名稱','status':'archived'}})
        assert saved.status_code==200,saved.text
        item=next(f for f in bio.get('/api/manage/files').json()['items'] if f['url']==entry['value']['file']['href'])
        assert item['usages'][0]['title']=='更新文件名稱' and item['usages'][0]['status']=='archived'
        href=bio.post('/api/manage/files/biobank',content=b'%PDF-1.4\nreplacement',headers={'content-type':'application/pdf'}).json()['url']
        changed=bio.put(endpoint,json={**saved.json(),'value':{**saved.json()['value'],'file':{'href':href},'status':'published'}})
        assert changed.status_code==200,changed.text
        combined=bio.get('/api/manage/files').json()['items']
        assert len(combined)==10 and len(store.read()['files'])==1
        original=next(f for f in combined if f['url']==entry['value']['file']['href'])
        assert original['usages'][0]['relation']=='original_source'
        uploaded=next(f for f in combined if f['url']==href)
        assert uploaded['source']=='uploaded' and uploaded['usages'][0]['relation']=='reference'
        assert len(bio.get('/api/manage/files?include_imported=false').json()['items'])==1
        assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest()==digest for path,digest in hashes.items())
        grant=next(g for g in root.get('/api/manage/grants').json()['items'] if g['identity']=='BIO')
        assert root.put('/api/manage/grants',json={**grant,'active':False}).status_code==200
        assert bio.get('/api/manage/files').status_code==403
    print('PASS imported file library: nine original PDFs, source/current document mapping, role scopes, no writes/copies, replacement provenance, uploads and immediate revocation')


if __name__=='__main__':
    main()
