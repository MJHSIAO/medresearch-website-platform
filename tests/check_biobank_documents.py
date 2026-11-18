"""Biobank's nine legacy PDFs become managed records without losing old URLs."""
import copy
import json
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.store import Store
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store


def main():
    seeds=json.loads(Path('data/documents.json').read_text(encoding='utf-8-sig'))
    imported=[d for d in seeds if d.get('original_file_href')]
    assert len(imported)==9 and len({d['id'] for d in imported})==9
    assert sum(not d['document_date'] for d in imported)==6
    unit=next(u for u in json.loads(Path('data/units.json').read_text(encoding='utf-8-sig')) if u['id']=='biobank')
    for d in imported:
        path=Path(d['file']['href'])
        assert path.read_bytes().startswith(b'%PDF-') and path.stat().st_size==d['file']['size']
        assert d['file']['href']==d['original_file_href'] and not d['is_demo']
    with TemporaryDirectory() as directory:
        isolated=Store(directory,'data')
        isolated.upgrade_biobank_documents()
        assert not (Path(directory)/'state.json').exists()
        state=isolated.read()
        legacy_unit=copy.deepcopy(unit)
        section=next(s for s in legacy_unit['special_sections'] if s['id']=='biobank-forms')
        section['intro']='保留自訂說明'
        section['items']=['保留自訂提醒']
        section['links']=[{'label':d['title'],'href':d['original_file_href'],'note':d['source_note'],'source_url':d['source_url']} for d in imported]
        section['links'][1]['note']='保留自訂說明：'+section['links'][1]['note']
        section['links'].append({'label':'保留額外入口','href':'#biobank-flow'})
        existing=copy.deepcopy(imported[0]);existing.update(id='managed-custom-consent',title='保留既有文件名稱',status='archived')
        state['content']['units']=[legacy_unit]
        unrelated=copy.deepcopy(seeds[0]);unrelated.update(id='keep-other-unit',owner_unit_id='ai-center',file={'href':'media/'+'f'*32+'.pdf'})
        state['content']['documents']=[existing,unrelated]
        state['history']=[{'example':'keep'}];state['grants']={'example':{'active':True}};state['files']={'old':{'example':'keep'}}
        original=copy.deepcopy(state);isolated._write(state)
        before=(Path(directory)/'state.json').read_bytes()
        isolated.upgrade_biobank_documents();updated=isolated.read()
        assert (Path(directory)/'state.before-biobank-documents-2026-11-18.json').read_bytes()==before
        docs=updated['content']['documents']
        assert len(docs)==10 and docs[:2]==original['content']['documents']
        assert sum(d['file']['href']==imported[0]['file']['href'] for d in docs)==1
        assert next(d for d in docs if d['id']==imported[1]['id'])['summary'].startswith('保留自訂說明')
        section=next(s for s in updated['content']['units'][0]['special_sections'] if s['id']=='biobank-forms')
        assert section['intro']=='保留自訂說明' and section['items']==['保留自訂提醒']
        assert [l['href'] for l in section['links']]==['#biobank-flow','#unit-documents']
        for key in ('history','grants','files','audit'):
            assert updated[key]==original[key]
        assert updated['content']['units'][0]['special_sections'][:3]==legacy_unit['special_sections'][:3]
        # Restart does not resurrect a deliberately removed record or undo edits.
        updated['content']['documents'].pop();isolated._write(updated)
        isolated.upgrade_biobank_documents();assert isolated.read()==updated
    config=replace(settings,admin_identity_claim='sub',system_admin_ids=('ROOT',))
    with TemporaryDirectory() as directory, patch.object(store,'directory',Path(directory)), patch('backend.main.settings',config):
        def login(identity):
            c=TestClient(app);sid=sessions.create({'name':identity},{'sub':identity})
            c.cookies.set('medresearch_session',signed_session_cookie(sid))
            c.headers['x-csrf-token']=c.get('/api/manage').json().get('csrf','');return c
        root=login('ROOT');anon=TestClient(app)
        for name,unit_id in [('BIO','biobank'),('AI','ai-center')]:
            assert root.put('/api/manage/grants',json={'identity':name,'role':'unit_admin','units':[unit_id],'active':True,'revision':None}).status_code==200
        bio,ai=login('BIO'),login('AI')
        entries=bio.get('/api/manage/content/documents').json()['items']
        assert len(entries)==9 and not ai.get('/api/manage/content/documents').json()['items']
        for d in imported:
            assert anon.get('/'+d['original_file_href']).content==Path(d['original_file_href']).read_bytes()
            response=anon.get('/api/documents/'+d['id']+'/download')
            assert response.status_code==200 and response.headers['content-type']=='application/pdf'
            assert response.content==Path(d['file']['href']).read_bytes()
        entry=next(e for e in entries if e['value']['id']=='biobank-usage-plan')
        endpoint='/api/manage/content/documents/biobank-usage-plan'
        assert ai.put(endpoint,json=entry).status_code==403
        changed={**entry,'value':{**entry['value'],'title':'後台更新名稱','source_note':'不應覆寫','source_url':'https://invalid.example/changed'}}
        saved=bio.put(endpoint,json=changed);assert saved.status_code==200,saved.text
        saved=saved.json()
        assert saved['value']['document_date']=='' and saved['value']['source_note']==entry['value']['source_note']
        assert saved['value']['source_url']==entry['value']['source_url']
        assert next(d for d in anon.get('/data/documents.json').json() if d['id']=='biobank-usage-plan')['title']=='後台更新名稱'
        assert bio.put(endpoint,json={**saved,'value':{**saved['value'],'visibility':'internal'}}).status_code==422
        archived=bio.put(endpoint,json={**saved,'value':{**saved['value'],'status':'archived'}}).json()
        assert anon.get('/api/documents/biobank-usage-plan/download').status_code==404
        assert anon.get('/'+entry['value']['original_file_href']).status_code==200
        assert not any(d['id']=='biobank-usage-plan' for d in anon.get('/data/documents.json').json())
        # Replacement and history restoration retain original URLs and provenance.
        href=bio.post('/api/manage/files/biobank',content=b'%PDF-1.4\nreplacement',headers={'content-type':'application/pdf'}).json()['url']
        replacement=bio.put(endpoint,json={**archived,'value':{**archived['value'],'file':{'href':href},'status':'published'}})
        assert replacement.status_code==200,replacement.text
        restored=bio.put(endpoint,json={'value':entry['value'],'revision':replacement.json()['revision']})
        assert restored.status_code==200,restored.text
        assert restored.json()['value']['file']==entry['value']['file']
        assert anon.get('/api/documents/biobank-usage-plan/download?inline=true').status_code==200
        assert bio.get('/api/manage/history/documents/biobank-usage-plan').json()['items']
    print('PASS biobank documents: nine real PDFs, original URLs, unknown dates, additive backup/idempotent import, custom records/notes, no duplicate files, scoped edits, provenance, archive, replacement and history restore')


if __name__=='__main__':
    main()
