"""Member pages, independently saved long bibliographies and existing scope rules."""
import copy,json
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app,settings,sessions,signed_session_cookie
from backend.main import store
from backend.store import Store

def main():
    config=replace(settings,admin_identity_claim='sub',system_admin_ids=('PROFILE-ROOT',))
    identifier='person-medresearch-vice';path='/api/manage/people/'+identifier+'/publications'
    with TemporaryDirectory() as directory,patch.object(store,'directory',Path(directory)),patch('backend.main.settings',config):
        with store.transaction() as state:
            state['grants']={'PROFILE-MAIN':{'role':'unit_admin','units':['medresearch'],'active':True},'PROFILE-AI':{'role':'unit_admin','units':['ai-center'],'active':True}}
        def client(identity):
            c=TestClient(app);sid=sessions.create({'name':'測試管理員'},{'sub':identity});c.cookies.set('medresearch_session',signed_session_cookie(sid));c.headers['x-csrf-token']=c.get('/api/manage').json().get('csrf','');return c
        main,foreign,root,ordinary=map(client,['PROFILE-MAIN','PROFILE-AI','PROFILE-ROOT','PROFILE-ORDINARY']);anon=TestClient(app)
        people=main.get('/api/manage/content/people').json()['items'];entry=next(p for p in people if p['value']['id']==identifier)
        assert len(people)==9
        for p in people:
            response=anon.get('/api/people/'+p['value']['id']);assert response.status_code==200,response.text
            assert 'account_identity' not in response.text and 'profile_import_note' not in response.text
        assert anon.get('/person.html?id='+identifier).status_code==200
        assert anon.get('/api/people/unknown').status_code==404
        assert anon.get('/data/publications.json').status_code==404
        first=anon.get('/api/people/'+identifier+'/publications').json()
        assert first['all_total']==59 and len(first['items'])==20 and first['pages']==3
        assert len(anon.get('/api/people/'+identifier+'/publications?page=3').json()['items'])==19
        assert anon.get('/api/people/'+identifier+'/publications?year=2022').json()['total']>0
        assert anon.get('/api/people/'+identifier+'/publications?q=NO_MATCH_PROFILE').json()['total']==0
        assert foreign.get(path).status_code==403 and ordinary.get(path).status_code==403 and anon.get(path).status_code==401
        citation='測試引用文字 '+('長篇資料 '*700)+' p < 0.05'
        value={'citation':citation,'year':'2026','category':'測試成果','href':'https://example.test/paper','person_id':'forged'}
        assert main.post(path,json={'items':[value]}).status_code==200
        latest=main.get(path+'?q='+ '測試引用文字').json()['items'][0]
        assert latest['value']['person_id']==identifier and latest['value']['citation']==citation
        assert main.put('/api/manage/content/people/'+identifier,json=entry).status_code==200
        assert main.get(path+'?q=測試引用文字').json()['total']==1,'Saving a member must not overwrite independent publications'
        url=path+'/'+latest['value']['id']
        updated=main.put(url,json={'value':{**value,'citation':'測試引用更新'},'revision':latest['revision']});assert updated.status_code==200
        assert main.put(url,json={'value':value,'revision':latest['revision']}).status_code==409
        current=main.get(path+'?q=測試引用更新').json()['items'][0]
        assert main.request('DELETE',url,json={'revision':current['revision']}).status_code==200
        before=main.get(path).json()['all_total']
        assert main.post(path,json={'items':[value,{**value,'citation':'字'*5001}]}).status_code==422
        assert main.get(path).json()['all_total']==before
        for item in ({**value,'href':'javascript:alert(1)'},{**value,'year':2026},{**value,'year':'9999'}):
            assert main.post(path,json={'items':[item]}).status_code==422
        assert main.post(path,json={'items':[value]*51}).status_code==422
        main.headers['x-csrf-token']='forged';assert main.post(path,json={'items':[value]}).status_code==403
        main.headers['x-csrf-token']=main.get('/api/manage').json()['csrf']
        assert main.post(path,json={'items':[value]},headers={'origin':'https://evil.test'}).status_code==403
        entry=next(p for p in main.get('/api/manage/content/people').json()['items'] if p['value']['id']==identifier)
        for profile in ({**entry['value']['profile'],'doctor_href':'javascript:alert(1)'},{**entry['value']['profile'],'introduction':'字'*20001},{**entry['value']['profile'],'links':[{'label':'x','href':'//evil.test'}]}):
            assert main.put('/api/manage/content/people/'+identifier,json={**entry,'value':{**entry['value'],'profile':profile}}).status_code==422
        uploaded=foreign.post('/api/manage/files/ai-center',content=b'\x89PNG\r\n\x1a\nfixture',headers={'content-type':'image/png'}).json()['url']
        assert main.put('/api/manage/content/people/'+identifier,json={**entry,'value':{**entry['value'],'profile':{**entry['value']['profile'],'photo_href':uploaded}}}).status_code==403
        photo=main.post('/api/manage/files/medresearch',content=b'\x89PNG\r\n\x1a\nfixture',headers={'content-type':'image/png'}).json()['url']
        assert anon.get('/'+photo).status_code==401
        entry=main.put('/api/manage/content/people/'+identifier,json={**entry,'value':{**entry['value'],'profile':{**entry['value']['profile'],'photo_href':photo}}}).json()
        assert anon.get('/'+photo).status_code==200
        for visibility in ('internal','public'):
            entry=main.put('/api/manage/content/people/'+identifier,json={**entry,'value':{**entry['value'],'visibility':visibility}}).json()
            assert anon.get('/api/people/'+identifier).status_code==(404 if visibility=='internal' else 200)
            assert anon.get('/api/people/'+identifier+'/publications').status_code==(404 if visibility=='internal' else 200)
        disabled=main.put('/api/manage/content/people/'+identifier,json={**entry,'value':{**entry['value'],'profile':{**entry['value']['profile'],'enabled':False}}}).json()
        assert anon.get('/api/people/'+identifier).status_code==404
        assert anon.get('/'+photo).status_code==401
        assert next(p for p in anon.get('/data/people.json').json() if p['id']==identifier)['profile']=={'enabled':False}
        entry=main.put('/api/manage/content/people/'+identifier,json={**disabled,'value':{**disabled['value'],'profile':{**disabled['value']['profile'],'enabled':True}}}).json()
        unit=main.get('/api/manage/content/units').json()['items'][0]
        hidden=root.put('/api/manage/content/units/medresearch',json={**unit,'value':{**unit['value'],'visibility':'internal'}}).json()
        assert anon.get('/api/people/'+identifier+'/publications').status_code==404
        assert anon.get('/'+photo).status_code==401
        assert not any(p['unit_id']=='medresearch' for p in anon.get('/data/people.json').json())
        assert root.put('/api/manage/content/units/medresearch',json={**hidden,'value':{**hidden['value'],'visibility':'public'}}).status_code==200
        state=store.read();assert any(h['kind']=='publications' for h in state['history'])
        assert Store(directory,store.source).read()['content']['publications']==state['content']['publications']
        with store.transaction() as state:state['grants']['PROFILE-MAIN']['active']=False
        assert main.get(path).status_code==403
    with TemporaryDirectory() as directory:
        old=Store(directory,store.source)
        with old.transaction() as state:
            people=old.collection(state,'people')
            for person in people:
                if person.get('unit_id')=='medresearch':person.pop('profile',None)
            person=next(p for p in people if p['id']==identifier);person['name']='自訂姓名';person['bio']='既有自訂簡介'
            people=[p for p in people if p['id']!='person-medresearch-staff']
            state['content']['people']=people;state['content']['publications']=[]
        old.upgrade_member_profiles();state=old.read();person=next(p for p in state['content']['people'] if p['id']==identifier)
        assert person['name']=='自訂姓名' and person['bio']=='既有自訂簡介' and person['profile']['enabled']
        assert not any(p['id']=='person-medresearch-staff' for p in state['content']['people'])
        assert (Path(directory)/'state.before-member-profiles-2026-11-23.json').exists()
        with old.transaction() as state:state['content']['publications']=[]
        old.upgrade_member_profiles();assert old.read()['content']['publications']==[]
    print('PASS nine local profiles; independent long publications, pagination/filter/CAS, scope/CSRF, privacy, images, persistence and conservative migration')

if __name__=='__main__':main()
