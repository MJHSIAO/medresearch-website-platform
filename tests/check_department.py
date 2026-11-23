"""Parent department uses the existing scoped manager role, never a global role."""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import copy
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store
from backend.store import Store

def main():
    config=replace(settings,admin_identity_claim='sub',system_admin_ids=('TEST-ROOT',))
    with TemporaryDirectory() as directory,patch.object(store,'directory',Path(directory)),patch('backend.main.settings',config):
        def client(identity):
            c=TestClient(app);sid=sessions.create({'name':'隔離測試帳號'},{'sub':identity})
            c.cookies.set('medresearch_session',signed_session_cookie(sid))
            response=c.get('/api/manage')
            c.headers['x-csrf-token']=response.json().get('csrf','')
            return c
        root=client('TEST-ROOT')
        for identity,units in [('TEST-MAIN',['medresearch']),('TEST-AI',['ai-center'])]:
            assert root.put('/api/manage/grants',json={'identity':identity,'role':'unit_admin','units':units,'active':True,'revision':None}).status_code==200
        main,ai=client('TEST-MAIN'),client('TEST-AI')
        info=main.get('/api/manage').json()
        assert info['profile']['role']=='unit_admin' and [u['id'] for u in info['units']]==['medresearch']
        assert main.get('/api/manage/grants').status_code==403
        assert main.get('/api/manage/announcements').status_code==403
        assert main.get('/api/manage/content/theme').json()['items']==[]
        entry=main.get('/api/manage/content/units').json()['items'][0]
        value={**entry['value'],'full_description':'本部測試介紹'}
        assert main.put('/api/manage/content/units/medresearch',json={**entry,'value':value}).status_code==200
        assert ai.put('/api/manage/content/units/medresearch',json={**entry,'value':value}).status_code==403
        foreign=ai.get('/api/manage/content/units').json()['items'][0]
        assert main.put('/api/manage/content/units/ai-center',json=foreign).status_code==403
        assert main.get('/api/manage/people/order/ai-center').status_code==403
        assert ai.get('/api/manage/people/order/medresearch').status_code==403
        person={'name':'測試成員甲','title':'測試職稱','bio':'隔離內容','visibility':'public','department_group':'members'}
        created=main.put('/api/manage/content/people/test-main-person',json={'value':person,'unit':'medresearch','revision':None})
        assert created.status_code==200,created.text
        assert main.put('/api/manage/content/people/test-main-person',json={**created.json(),'value':{**created.json()['value'],'department_group':[]}}).status_code==422
        anon=TestClient(app)
        assert 'test-main-person' in anon.get('/data/people.json').text
        for bad in ('javascript:alert(1)', 'https://example.test/\n'):
            assert main.put('/api/manage/content/people/test-main-person',json={**created.json(),'value':{**created.json()['value'],'profile_href':bad}}).status_code==422
        data=main.get('/api/manage/people/order/medresearch').json()
        ids=[p['value']['id'] for p in data['items']][::-1]
        assert main.put('/api/manage/people/order/medresearch',json={'ids':ids,'revision':data['revision']}).status_code==200
        assert [p['id'] for p in anon.get('/data/people.json').json() if p['unit_id']=='medresearch']==ids
        assert ai.get('/api/manage/people/test-main-person/delete-preview').status_code==403
        preview=main.get('/api/manage/people/test-main-person/delete-preview').json()
        assert main.request('DELETE','/api/manage/people/test-main-person',json={'revision':preview['revision']}).status_code==200
        assert 'test-main-person' not in anon.get('/data/people.json').text
        assert any(i['id']=='test-main-person' for i in store.read()['audit'])
        assert len(main.get('/api/manage/content/people').json()['items'])==9
        assert main.get('/api/manage/analytics?unit=ai-center').status_code==403
        report=main.get('/api/manage/analytics?unit=medresearch')
        assert report.status_code==200
        assert len([u for u in root.get('/api/manage/analytics').json()['units'] if u['id']=='medresearch'])==1
        doc={'title':'本部測試文件','summary':'測試','category':'申請表單','version':'1','status':'draft','visibility':'public','file':{}}
        assert main.put('/api/manage/content/documents/test-main-document',json={'value':doc,'revision':None}).status_code==200
        assert main.post('/api/manage/files/ai-center',content=b'%PDF-',headers={'content-type':'application/pdf'}).status_code==403
        grant=next(i for i in root.get('/api/manage/grants').json()['items'] if i['identity']=='TEST-MAIN')
        assert root.put('/api/manage/grants',json={**grant,'active':False}).status_code==200
        assert main.get('/api/manage').status_code==403
    with TemporaryDirectory() as directory:
        old=Store(directory,store.source)
        with old.transaction() as state:
            state['content']['units']=[u for u in old.collection(state,'units') if u['id']!='medresearch']
            state['content']['people']=[p for p in old.collection(state,'people') if p['unit_id']!='medresearch']
            pages=old.collection(state,'pages');page=next(p for p in pages if p['id']=='department-about')
            page['sections']=[{'title':'本部簡介','content':'既有自訂本部介紹'}]
            state['content']['pages']=pages
            state['grants']['TEST-EXISTING']={'role':'unit_admin','units':['ai-center'],'active':True}
        previous=old.read();old.upgrade_department();updated=old.read()
        assert updated['grants']==previous['grants'] and updated['content']['pages']==previous['content']['pages']
        assert next(u for u in updated['content']['units'] if u['id']=='medresearch')['full_description']=='既有自訂本部介紹'
        assert len([p for p in updated['content']['people'] if p['unit_id']=='medresearch'])==9
        assert (Path(directory)/'state.before-department-members-2026-11-23.json').exists()
        with old.transaction() as state: state['content']['people']=[p for p in state['content']['people'] if p['unit_id']!='medresearch']
        old.upgrade_department()
        assert not any(p['unit_id']=='medresearch' for p in old.read()['content']['people'])
    with TemporaryDirectory() as directory:
        only_pages=Store(directory,store.source)
        with only_pages.transaction() as state:
            state['content']['pages']=only_pages.collection(state,'pages')
            page=next(p for p in state['content']['pages'] if p['id']=='department-about')
            page['sections']=[{'title':'本部簡介','content':'僅曾編輯一般頁面的既有介紹'}]
        only_pages.upgrade_department()
        assert next(u for u in only_pages.collection(only_pages.read(),'units') if u['id']=='medresearch')['full_description']=='僅曾編輯一般頁面的既有介紹'
    print('PASS department scope, CRUD/order/delete, public sync, forbidden global access, revocation and non-destructive one-time migration')

if __name__=='__main__':main()
