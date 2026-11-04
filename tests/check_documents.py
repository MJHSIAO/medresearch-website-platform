"""Document lifecycle and attachment authorization using real API and isolated storage."""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store


def main():
    config = replace(settings, admin_identity_claim='sub', system_admin_ids=('TEST_ROOT',))
    with TemporaryDirectory() as directory, patch.object(store, 'directory', Path(directory)), patch('backend.main.settings', config):
        def client(identity):
            c = TestClient(app, follow_redirects=False)
            sid = sessions.create({'name': identity}, {'sub': identity})
            c.cookies.set('medresearch_session', signed_session_cookie(sid))
            return c
        root = client('TEST_ROOT')
        root.headers['x-csrf-token'] = root.get('/api/manage').json()['csrf']
        for identity, role, units in [('UNIT_A','unit_admin',['ai-center']),('UNIT_B','unit_admin',['core-laboratory']),('DEPT','site_admin',[])]:
            assert root.put('/api/manage/grants', json=dict(identity=identity,role=role,units=units,active=True,revision=None)).status_code == 200
        a,b,dept = client('UNIT_A'),client('UNIT_B'),client('DEPT')
        for c in (a,b,dept):
            overview=c.get('/api/manage').json()
            assert 'documents' in overview['kinds']
            c.headers['x-csrf-token']=overview['csrf']
        anon=TestClient(app)
        ordinary=client('ORDINARY')
        assert anon.get('/api/manage/content/documents').status_code==401
        assert ordinary.get('/api/manage/content/documents').status_code==403
        samples=anon.get('/data/documents.json').json()
        assert len(samples)==6 and all(d['is_demo'] for d in samples)
        for d in samples:
            assert anon.get('/'+d['file']['href']).status_code==200
        payload=dict(value=dict(title='測試文件',summary='測試說明',version='1.0',category='申請表單',visibility='public',status='draft',file={},is_demo=False),revision=None,unit='ai-center')
        endpoint='/api/manage/content/documents/test-doc'
        assert a.put(endpoint,json={**payload,'unit':'core-laboratory'}).status_code==403
        assert a.put(endpoint,json=payload,headers={'x-csrf-token':'forged'}).status_code==403
        assert a.put(endpoint,json=payload,headers={'origin':'https://evil.test'}).status_code==403
        draft=a.put(endpoint,json=payload)
        assert draft.status_code==200,draft.text
        draft=draft.json()
        assert 'test-doc' not in anon.get('/data/documents.json').text
        assert b.put(endpoint,json=draft).status_code==403
        assert 'test-doc' not in b.get('/api/manage/content/documents').text
        def change(entry,**fields):
            return {**entry,'value':{**entry['value'],**fields}}
        assert a.put(endpoint,json=change(draft,status='published')).status_code==422
        assert a.put(endpoint,json=change(draft,visibility='internal')).status_code==422
        for href in ['javascript:alert(1)','https://evil.test/file.pdf','media/%2e%2e/secret','assets/documents/demo/research-form.html']:
            assert a.put(endpoint,json=change(draft,file={'href':href})).status_code==422
        foreign=b.post('/api/manage/files/core-laboratory',content=b'%PDF-1.4\nother',headers={'content-type':'application/pdf'}).json()['url']
        assert a.put(endpoint,json=change(draft,file={'href':foreign})).status_code==403
        upload=a.post('/api/manage/files/ai-center',content=b'%PDF-1.4\ndocument',headers={'content-type':'application/pdf','x-file-name':'document.pdf'})
        assert upload.status_code==200
        href=upload.json()['url']
        assert anon.get('/'+href).status_code==401
        saved=a.put(endpoint,json=change(draft,file={'href':href,'name':'forged','size':99999},status='published',owner_unit_id='core-laboratory'))
        assert saved.status_code==200,saved.text
        published=saved.json()
        assert published['value']['owner_unit_id']=='ai-center'
        assert published['value']['file']['name']=='document.pdf'
        assert published['value']['file']['size']==len(b'%PDF-1.4\ndocument')
        assert 'test-doc' in anon.get('/data/documents.json').text
        assert anon.get('/'+href).status_code==200
        assert anon.get('/'+href+'?inline=true').headers['content-disposition'].startswith('inline;')
        assert anon.get('/'+href+'?inline=true').headers['content-security-policy'] == "default-src 'none'; frame-ancestors 'self'"
        assert anon.get('/'+href).headers['content-disposition'].startswith('attachment;')
        assert 'sandbox' in anon.get('/'+href).headers['content-security-policy']
        assert a.put(endpoint,json=draft).status_code==409
        archived=a.put(endpoint,json=change(published,status='archived')).json()
        assert 'test-doc' not in anon.get('/data/documents.json').text
        assert anon.get('/'+href+'?inline=true').status_code==401
        assert ordinary.get('/'+href).status_code==403
        assert b.get('/'+href).status_code==403
        assert a.get('/'+href).status_code==200
        assert a.get('/api/manage/history/documents/test-doc').json()['items']
        assert not b.get('/api/manage/history/documents/test-doc').json()['items']
        assert a.put(endpoint,json=change(archived,status='published')).status_code==200
        # Existing JSON state survives reconstructing the store, and existing news stays intact.
        from backend.store import Store
        reloaded=Store(directory,store.source)
        assert any(d['id']=='test-doc' for d in reloaded.collection(reloaded.read(),'documents'))
        assert anon.get('/data/news.json').status_code==200
        sample=next(x for x in root.get('/api/manage/content/documents').json()['items'] if x['value']['id']=='research-form')
        assert root.put('/api/manage/content/documents/research-form',json=change(sample,is_demo=False)).json()['value']['is_demo'] is True
        assert len(dept.get('/api/manage/content/documents').json()['items'])==7
    print('PASS documents: samples, draft/publish/archive/restore, immutable owners, scope/CSRF, upload metadata, private/inline downloads, history and persistence')


if __name__=='__main__':
    main()
