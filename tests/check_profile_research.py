"""Research sorting, structured emphasis, scoped edits and conservative section migration."""
import copy,json
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app,settings,sessions,signed_session_cookie
from backend.main import store
from backend.store import Store
from backend.profile_sections import split_profile

def main():
    identifier='person-medresearch-vice';path=f'/api/manage/people/{identifier}/publications'
    config=replace(settings,admin_identity_claim='sub',system_admin_ids=('RESEARCH-ROOT',))
    with TemporaryDirectory() as directory,patch.object(store,'directory',Path(directory)),patch('backend.main.settings',config):
        with store.transaction() as state:state['grants']={'RESEARCH-MAIN':{'role':'unit_admin','units':['medresearch'],'active':True},'RESEARCH-AI':{'role':'unit_admin','units':['ai-center'],'active':True}}
        def client(identity):
            c=TestClient(app);sid=sessions.create({'name':'測試管理員'},{'sub':identity});c.cookies.set('medresearch_session',signed_session_cookie(sid));c.headers['x-csrf-token']=c.get('/api/manage').json().get('csrf','');return c
        manager,foreign=map(client,['RESEARCH-MAIN','RESEARCH-AI']);anon=TestClient(app)
        values=[{'citation':name,'year':year,'category':'測試','href':''} for name,year in [('同年甲','2026'),('未填年份',''),('同年乙','2026'),('較新成果','2027')]]
        values[0]['runs']=[{'text':'同年','bold':True,'underline':True},{'text':'甲'}]
        assert manager.post(path,json={'items':values}).status_code==200
        result=anon.get(f'/api/people/{identifier}/publications').json()
        assert [p['citation'] for p in result['items'][:3]]==['較新成果','同年甲','同年乙']
        assert result['items'][1]['runs'][0]=={'text':'同年','bold':True,'underline':True}
        assert 'Chih-Hung Chang' in result['author_names'] and '張至宏' in result['author_names']
        last=anon.get(f'/api/people/{identifier}/publications?page={result["pages"]}').json()
        assert last['items'][-1]['citation']=='未填年份'
        records=manager.get(path+'?q=同年甲').json()['items'];record=records[0]
        updated={**record['value'],'year':'2028'}
        assert foreign.put(path+'/'+updated['id'],json={'value':updated,'revision':record['revision']}).status_code==403
        assert manager.put(path+'/'+updated['id'],json={'value':updated,'revision':record['revision']}).status_code==200
        assert anon.get(f'/api/people/{identifier}/publications').json()['items'][0]['citation']=='同年甲'
        # A plain-text client update deliberately clears old manual formatting.
        record=manager.get(path+'?q=同年甲').json()['items'][0];plain={k:v for k,v in record['value'].items() if k!='runs'}
        assert manager.put(path+'/'+plain['id'],json={'value':plain,'revision':record['revision']}).status_code==200
        assert manager.get(path+'?q=同年甲').json()['items'][0]['value']['runs']==[]
        for runs in ([{'text':'mismatch','bold':True}],[{'text':'同年甲','bold':'true'}],[{'text':'同年甲','html':'<script>bad()</script>'}]):
            assert manager.post(path,json={'items':[{**values[0],'runs':runs}]}).status_code==422
        entry=next(p for p in manager.get('/api/manage/content/people').json()['items'] if p['value']['id']==identifier)
        for profile in ({**entry['value']['profile'],'author_names':['x']*21},{**entry['value']['profile'],'honors':'字'*20001}):
            assert manager.put('/api/manage/content/people/'+identifier,json={**entry,'value':{**entry['value'],'profile':profile}}).status_code==422
        profile={**entry['value']['profile'],'honors':'測試榮譽','patents':'測試專利','author_names':['Custom Author']}
        assert manager.put('/api/manage/content/people/'+identifier,json={**entry,'value':{**entry['value'],'profile':profile}}).status_code==200
        public=anon.get('/api/people/'+identifier).json()['person']['profile']
        assert public['honors']=='測試榮譽' and public['patents']=='測試專利'
        assert anon.get(f'/api/people/{identifier}/publications').json()['author_names']==['張至宏','Custom Author']
        entry=next(p for p in manager.get('/api/manage/content/people').json()['items'] if p['value']['id']==identifier)
        legacy={k:v for k,v in entry['value']['profile'].items() if k not in {'sections_version','honors','patents','author_names','legacy_activity_source','legacy_activities'}}
        legacy['introduction']=''
        restored=manager.put('/api/manage/content/people/'+identifier,json={**entry,'value':{**entry['value'],'profile':legacy}})
        assert restored.status_code==200 and restored.json()['value']['profile']['patents'],'Old history/client updates remain visible through new sections'
        assert Store(directory,store.source).read()['content']['publications']==store.read()['content']['publications']
    seeds=json.loads((store.source/'people.json').read_text(encoding='utf-8-sig'))
    for p in seeds:
        profile=p.get('profile',{})
        if not profile:continue
        combined='\n'.join(profile.get(k,'') for k in ('honors','patents','introduction','legacy_activities'))
        assert all(line in combined for line in profile.get('achievements','').splitlines() if line)
    with TemporaryDirectory() as directory:
        old=Store(directory,store.source)
        with old.transaction() as state:
            people=copy.deepcopy(seeds);p=next(p for p in people if p['id']==identifier)
            for key in ('sections_version','honors','patents','author_names','legacy_activities'):p['profile'].pop(key,None)
            p['profile']['achievements']='自訂既有內容，不推測分類';p['profile']['introduction']='原有介紹'
            state['content']['people']=people
        old.upgrade_profile_sections();state=old.read();profile=next(p['profile'] for p in state['content']['people'] if p['id']==identifier)
        assert profile['introduction']=='原有介紹\n\n自訂既有內容，不推測分類' and profile['honors']=='' and profile['patents']==''
        assert profile['achievements']=='自訂既有內容，不推測分類'
        assert (Path(directory)/'state.before-profile-sections-2026-11-25.json').is_file()
        snapshot=copy.deepcopy(state);old.upgrade_profile_sections();assert old.read()==snapshot
    long=split_profile({'achievements':'乙'*20000,'introduction':'甲'*20000})
    assert len(long['introduction'])==20000 and long['legacy_activities']=='乙'*20000
    vice=next(p['profile'] for p in seeds if p['id']==identifier)
    baseline={k:v for k,v in vice.items() if k not in {'sections_version','honors','patents','author_names','legacy_activity_source'}}
    baseline['introduction']=''
    migrated=split_profile(baseline,vice)
    assert migrated['patents']==vice['patents'] and migrated['introduction']==vice['introduction']
    assert 'legacy_activities' not in migrated,'Source backup must not reappear after an intentional introduction edit'
    print('PASS descending year pagination/stable ties/undated last; formatted run validation/persistence, aliases, scope and lossless section migration')

if __name__=='__main__':main()
