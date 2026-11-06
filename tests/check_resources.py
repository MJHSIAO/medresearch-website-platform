"""Release upgrade, custom content preservation and resource-page API validation."""
import copy
import json
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store
from backend.store import Store
from backend.resources import RELEASE


def main():
    baseline=json.loads((Path(__file__).resolve().parent.parent/'backend/resource_baseline.json').read_text(encoding='utf-8'))
    with TemporaryDirectory() as directory:
        isolated=Store(directory,store.source)
        isolated.upgrade_resource_content()
        assert not (Path(directory)/'state.json').exists()
        with isolated.transaction() as state:
            state['content']=copy.deepcopy(baseline)
            about=next(p for p in state['content']['pages'] if p['id']=='department-about')
            about['summary']='Custom live summary'
            about['sections'][0]['content']='Custom live paragraph'
            # Preserve extra entries, private news, unit edits, document state and custom attachments.
            state['content']['pages'].append({'id':'custom-page','title':'Custom page','sections':[]})
            state['content']['units']=[{'id':'custom-unit','name':'Keep unit'}]
            state['content']['documents']=[{'id':'custom-document','status':'draft'}]
            state['content']['news'][0]['attachments']=[{'href':'media/custom.pdf','name':'custom'}]
            state['content']['news'].append({'id':'private-news','visibility':'internal','status':'published','title':'Private'})
            state['grants']['TEST_KEEP']={'active':True,'role':'unit_admin','units':['ai-center']}
            state['files']['keep.pdf']={'unit':'ai-center'}
        before=isolated.read()
        isolated.upgrade_resource_content()
        after=isolated.read()
        backup=Path(directory)/f'state.before-{RELEASE}.json'
        assert json.loads(backup.read_text(encoding='utf-8'))==before
        assert after['grants']==before['grants'] and after['files']==before['files']
        assert after['content']['units']==before['content']['units']
        assert after['content']['documents']==before['content']['documents']
        about=next(p for p in after['content']['pages'] if p['id']=='department-about')
        assert about['summary']=='Custom live summary'
        assert about['sections'][0]['content']=='Custom live paragraph'
        assert about['groups']
        assert any(p['id']=='governance' for p in after['content']['pages'])
        assert any(p['id']=='custom-page' for p in after['content']['pages'])
        assert after['content']['news'][0]['attachments']==before['content']['news'][0]['attachments']
        assert any(n['id']=='private-news' for n in after['content']['news'])
        with isolated.transaction() as state:
            # Later deliberate edits back to old wording must not trigger repeated upgrades.
            state['content']['pages'][0]['summary']=baseline['pages'][0]['summary']
        once=isolated.read()
        isolated.upgrade_resource_content()
        assert isolated.read()==once
        assert json.loads(backup.read_text(encoding='utf-8'))==before
    config=replace(settings,admin_identity_claim='sub',system_admin_ids=('RESOURCE_TEST',))
    with TemporaryDirectory() as directory,patch.object(store,'directory',Path(directory)),patch('backend.main.settings',config):
        root=TestClient(app)
        sid=sessions.create({'name':'Test'}, {'sub':'RESOURCE_TEST'})
        root.cookies.set('medresearch_session',signed_session_cookie(sid))
        root.headers['x-csrf-token']=root.get('/api/manage').json()['csrf']
        collection=root.get('/api/manage/content/pages').json()['items']
        page=next(x for x in collection if x['value']['id']=='research-consultation')
        url='/api/manage/content/pages/research-consultation'
        saved=root.put(url,json=page)
        assert saved.status_code==200,saved.text  # mixed person/link groups remain editable
        current=saved.json()
        broken=copy.deepcopy(current);broken['value']['groups'][0]['cards']='not a list'
        assert root.put(url,json=broken).status_code==422
        broken=copy.deepcopy(current);broken['value']['groups'][0]['cards'][0]['actions'][0]['href']='javascript:alert(1)'
        assert root.put(url,json=broken).status_code==422
        broken=copy.deepcopy(current);broken['value']['groups'][0]['cards'][0]['actions'][0]['href']='data:text/html,unsafe'
        assert root.put(url,json=broken).status_code==422
        assert root.put(url,json=current,headers={'x-csrf-token':'bad'}).status_code==403
        # API filtering keeps restricted resource data out of the search input.
        hidden=copy.deepcopy(current);hidden['value']['visibility']='internal'
        assert root.put(url,json=hidden).status_code==200
        public=TestClient(app).get('/data/pages.json').json()
        assert not any(x['id']=='research-consultation' for x in public)
        assert any(x['id']=='teams' for x in public)
        assert TestClient(app).get('/api/manage/content/pages').status_code==401
    print('PASS resource upgrade: backup, edits/grants/files preserved, new IDs, once-only; API: editable groups, malformed/unsafe/CSRF rejected, private-page filtering')


if __name__=='__main__':
    main()
