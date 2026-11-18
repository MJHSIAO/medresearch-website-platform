"""Real API checks for order, scoped deletion, persistence and linked identities."""
import copy
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store
from backend.store import Store


def main():
    config=replace(settings,admin_identity_claim='sub',system_admin_ids=('EXAMPLE_ROOT',))
    with TemporaryDirectory() as directory, patch.object(store,'directory',Path(directory)), patch('backend.main.settings',config):
        def login(identity):
            client=TestClient(app)
            sid=sessions.create({'name':identity},{'sub':identity})
            client.cookies.set('medresearch_session',signed_session_cookie(sid))
            response=client.get('/api/manage')
            if response.status_code==200: client.headers['x-csrf-token']=response.json()['csrf']
            return client
        root=login('EXAMPLE_ROOT')
        state=store.read()
        state['grants']={
            'EXAMPLE_UNIT':{'role':'unit_admin','units':['ai-center'],'active':True},
            'EXAMPLE_MULTI':{'role':'unit_admin','units':['ai-center','core-laboratory'],'active':True},
            'EXAMPLE_SITE':{'role':'site_admin','units':[],'active':True},
            'EXAMPLE_SYSTEM':{'role':'system_admin','units':[],'active':True}}
        state['content']['people']=[]
        store._write(state)
        unit,site,ordinary=login('EXAMPLE_UNIT'),login('EXAMPLE_SITE'),login('EXAMPLE_ORDINARY')
        def create(identifier,name,owner='ai-center',identity=''):
            payload={'value':{'name':name,'title':'測試職務','bio':'虛構資料','visibility':'public','account_identity':identity},'unit':owner,'revision':None}
            response=root.put('/api/manage/content/people/'+identifier,json=payload)
            assert response.status_code==200,response.text
            return response.json()
        a=create('example-a','測試甲',identity='EXAMPLE_MULTI')
        b=create('example-b','測試乙')
        c=create('example-c','測試丙')
        foreign=create('example-core','測試丁','core-laboratory','EXAMPLE_MULTI')
        foreign_before=copy.deepcopy(next(p for p in store.collection(store.read(),'people') if p['id']=='example-core'))
        public=TestClient(app)
        assert 'account_identity' not in public.get('/data/people.json').text
        assert unit.get('/api/manage/people/order/core-laboratory').status_code==403
        assert ordinary.get('/api/manage/people/order/ai-center').status_code==403
        endpoint='/api/manage/people/order/ai-center'
        data=unit.get(endpoint).json()
        ids=[entry['value']['id'] for entry in data['items']]
        for invalid in [ids[:-1],ids+[ids[0]],ids[:-1]+['example-core'],[True],None]:
            assert unit.put(endpoint,json={'ids':invalid,'revision':data['revision']}).status_code==422
        assert root.put(endpoint,json={'ids':ids[::-1],'revision':data['revision']},headers={'x-csrf-token':'invalid'}).status_code==403
        assert root.put(endpoint,json={'ids':ids[::-1],'revision':data['revision']},headers={'origin':'https://untrusted.example'}).status_code==403
        result=unit.put(endpoint,json={'ids':ids[::-1],'revision':data['revision']})
        assert result.status_code==200,result.text
        assert next(p for p in store.collection(store.read(),'people') if p['id']=='example-core')==foreign_before
        assert [p['id'] for p in public.get('/data/people.json').json() if p['unit_id']=='ai-center']==ids[::-1]
        ai=next(u for u in public.get('/data/units.json').json() if u['id']=='ai-center')
        assert [p.split()[-1] for p in ai['members']]==['測試丙','測試乙','測試甲']
        persisted=Store(directory,store.source).collection(store.read(),'people')
        assert next(p for p in persisted if p['id']=='example-c')['display_order']==0
        assert unit.put(endpoint,json={'ids':ids,'revision':data['revision']}).status_code==409
        assert root.put('/api/manage/content/people/example-b',json={'value':{'display_order':-1},'revision':next(i['revision'] for i in result.json()['items'] if i['value']['id']=='example-b')}).status_code==422
        assert unit.put('/api/manage/content/people/example-b',json={'value':{'account_identity':'EXAMPLE_UNIT'},'revision':next(i['revision'] for i in result.json()['items'] if i['value']['id']=='example-b')}).status_code==403
        assert unit.get('/api/manage/people/example-core/delete-preview').status_code==403
        assert unit.request('DELETE','/api/manage/people/example-core',json={'revision':foreign['revision']}).status_code==403
        # Preview is read-only; subsequent edits invalidate its deletion token.
        path='/api/manage/people/example-b'
        preview=unit.get(path+'/delete-preview').json()
        assert any(p['id']=='example-b' for p in public.get('/data/people.json').json())
        assert unit.request('DELETE',path,json={'revision':preview['revision']},headers={'x-csrf-token':'invalid'}).status_code==403
        current=next(i for i in unit.get('/api/manage/content/people').json()['items'] if i['value']['id']=='example-b')
        assert unit.put('/api/manage/content/people/example-b',json={**current,'value':{**current['value'],'title':'更新職務'}}).status_code==200
        assert unit.request('DELETE',path,json={'revision':preview['revision']}).status_code==409
        preview=unit.get('/api/manage/people/example-a/delete-preview').json()
        assert any('EXAMPLE_MULTI' in line for line in preview['impacts'])
        assert unit.request('DELETE','/api/manage/people/example-a',json={'revision':preview['revision']}).status_code==200
        state=store.read()
        assert state['grants']['EXAMPLE_MULTI']['units']==['core-laboratory']
        assert not any(p['id']=='example-a' for p in state['content']['people'])
        assert next(p for p in state['content']['people'] if p['id']=='example-core')['account_identity']=='EXAMPLE_MULTI'
        # Grant removal preserves membership and upstream account while clearing only its explicit link.
        payload={'identity':'EXAMPLE_MULTI','unit':'core-laboratory'}
        assert unit.post('/api/manage/grants/delete-preview',json=payload).status_code==403
        assert site.post('/api/manage/grants/delete-preview',json={'identity':'EXAMPLE_SYSTEM','unit':None}).status_code==403
        assert root.post('/api/manage/grants/delete-preview',json={'identity':'EXAMPLE_ROOT','unit':None}).status_code==409
        preview=site.post('/api/manage/grants/delete-preview',json=payload).json()
        assert site.request('DELETE','/api/manage/grants',json={**payload,'revision':preview['revision']},headers={'x-csrf-token':'invalid'}).status_code==403
        assert site.request('DELETE','/api/manage/grants',json={**payload,'revision':'old'}).status_code==409
        assert site.request('DELETE','/api/manage/grants',json={**payload,'revision':preview['revision']}).status_code==200
        state=Store(directory,store.source).read()
        assert 'EXAMPLE_MULTI' not in state['grants']
        assert next(p for p in state['content']['people'] if p['id']=='example-core')['account_identity']==''
        restored=root.put('/api/manage/content/people/example-core',json={'value':foreign['value'],'revision':next(i['revision'] for i in root.get('/api/manage/content/people').json()['items'] if i['value']['id']=='example-core')})
        assert restored.status_code==422
        assert login('EXAMPLE_MULTI').get('/api/manage').status_code==403
        # No name matching: an unlinked public member never revokes a same-name grant.
        state['grants']['EXAMPLE_OTHER']={'name':'測試乙','role':'unit_admin','units':['ai-center'],'active':True}
        store._write(state)
        preview=unit.get(path+'/delete-preview').json()
        assert unit.request('DELETE',path,json={'revision':preview['revision']}).status_code==200
        assert store.read()['grants']['EXAMPLE_OTHER']['active']
        # Direct authorization deletion removes exactly one scope and its private links.
        added=root.put('/api/manage/grants',json={'identity':'EXAMPLE_PARTIAL','name':'測試多單位','role':'unit_admin','units':['ai-center','core-laboratory'],'active':True,'revision':None})
        assert added.status_code==200
        create('example-partial-ai','測試關聯甲',identity='EXAMPLE_PARTIAL')
        create('example-partial-core','測試關聯乙','core-laboratory','EXAMPLE_PARTIAL')
        payload={'identity':'EXAMPLE_PARTIAL','unit':'core-laboratory'}
        preview=root.post('/api/manage/grants/delete-preview',json=payload).json()
        assert root.request('DELETE','/api/manage/grants',json={**payload,'revision':preview['revision']}).status_code==200
        state=store.read()
        assert state['grants']['EXAMPLE_PARTIAL']['units']==['ai-center']
        assert next(p for p in state['content']['people'] if p['id']=='example-partial-core')['account_identity']==''
        assert next(p for p in state['content']['people'] if p['id']=='example-partial-ai')['account_identity']=='EXAMPLE_PARTIAL'
        # Scope edits clear invalid links, and older clients do not erase optional names.
        existing=next(g for g in root.get('/api/manage/grants').json()['items'] if g['identity']=='EXAMPLE_PARTIAL')
        assert root.put('/api/manage/grants',json={'identity':'EXAMPLE_PARTIAL','role':'unit_admin','units':['core-laboratory'],'active':True,'revision':existing['revision']}).status_code==200
        assert store.read()['grants']['EXAMPLE_PARTIAL']['name']=='測試多單位'
        assert next(p for p in store.read()['content']['people'] if p['id']=='example-partial-ai')['account_identity']==''
        create('example-self','測試本人',identity='EXAMPLE_UNIT')
        preview=unit.get('/api/manage/people/example-self/delete-preview').json()
        removed=unit.request('DELETE','/api/manage/people/example-self',json={'revision':preview['revision']})
        assert removed.status_code==200 and removed.json()['redirect']=='internal'
        assert unit.get('/api/manage').status_code==403
        # Last administrator and self/role escalation protections remain in force.
        state=store.read();state['grants']={'EXAMPLE_ROOT':{'role':'system_admin','units':[],'active':True}};store._write(state)
        with patch('backend.main.settings',replace(config,system_admin_ids=())):
            assert root.post('/api/manage/grants/delete-preview',json={'identity':'EXAMPLE_ROOT','unit':None}).status_code==409
            assert root.request('DELETE','/api/manage/grants',json={'identity':'EXAMPLE_ROOT','unit':None,'revision':'invalid'}).status_code==409
            state=store.read();state['grants']['EXAMPLE_REMAINING']={'role':'system_admin','units':[],'active':True};store._write(state)
            payload={'identity':'EXAMPLE_ROOT','unit':None}
            preview=root.post('/api/manage/grants/delete-preview',json=payload).json()
            removed=root.request('DELETE','/api/manage/grants',json={**payload,'revision':preview['revision']})
            assert removed.status_code==200 and removed.json()['redirect']=='internal'
            assert root.get('/api/manage').status_code==403
        assert any(item['action']=='調整成員順序' for item in store.read()['audit'])
    print('PASS personnel: atomic order/public summaries, persistence/conflicts, scoped deletes/CSRF, explicit links, partial grants, immediate revocation, last-admin protection')


if __name__=='__main__':
    main()
