"""Offline end-to-end tests against the actual API, with isolated runtime storage."""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store


def main():
    config = replace(settings, admin_identity_claim='employee_id', system_admin_ids=('TEST_ROOT',))
    with TemporaryDirectory() as directory, patch.object(store, 'directory', Path(directory)), patch('backend.main.settings', config):
        def client(identity):
            c = TestClient(app, follow_redirects=False)
            sid = sessions.create({'name': identity}, {'sub': identity, 'employee_id': identity})
            c.cookies.set('medresearch_session', signed_session_cookie(sid))
            return c
        root = client('TEST_ROOT')
        token = root.get('/api/manage').json()['csrf']
        root.headers['x-csrf-token'] = token
        def grant(identity, role, units, active=True):
            entries = root.get('/api/manage/grants').json()['items']
            old = next((i for i in entries if i['identity'] == identity), {})
            return root.put('/api/manage/grants', json={'identity': identity, 'role': role, 'units': units, 'active': active, 'revision': old.get('revision')})
        assert grant('UNIT_A', 'unit_admin', ['ai-center']).status_code == 200
        assert grant('DEPT', 'site_admin', []).status_code == 200
        a, dept, ordinary = client('UNIT_A'), client('DEPT'), client('ORDINARY')
        for c in (a, dept):
            c.headers['x-csrf-token'] = c.get('/api/manage').json()['csrf']
            assert c.get('/admin').status_code == 200
        assert ordinary.get('/admin').status_code == 403
        assert ordinary.get('/api/manage').status_code == 403
        assert a.get('/api/manage/grants').status_code == 403
        assert dept.put('/api/manage/grants', json={'identity':'ESCALATE','role':'system_admin','units':[],'active':True}).status_code == 403
        assert a.get('/api/manage/content/site').json()['items'] == []
        own = a.get('/api/manage/content/units').json()['items']
        assert len(own) == 1 and own[0]['value']['id'] == 'ai-center'
        malformed = {'value': {**own[0]['value'], 'services': 'invalid'}, 'revision': own[0]['revision']}
        assert a.put('/api/manage/content/units/ai-center', json=malformed).status_code == 422
        structure = {'value': {**own[0]['value'], 'name': 'unauthorized rename'}, 'revision': own[0]['revision']}
        assert a.put('/api/manage/content/units/ai-center', json=structure).status_code == 403
        changed = {'value': {**own[0]['value'], 'full_description': 'Verified unit content'}, 'revision': own[0]['revision']}
        assert a.put('/api/manage/content/units/ai-center', json=changed).status_code == 200
        assert 'Verified unit content' in TestClient(app).get('/data/units.json').text
        foreign = next(i for i in root.get('/api/manage/content/units').json()['items'] if i['value']['id'] == 'core-laboratory')
        assert a.put('/api/manage/content/units/core-laboratory', json=foreign).status_code == 403
        payload = {'value':{'title':'API regression','content':['Public body'],'visibility':'public','status':'draft','attachments':[]},'unit':'ai-center','revision':None}
        assert a.put('/api/manage/content/news/test-news', json={**payload,'unit':'core-laboratory'}).status_code == 403
        saved = a.put('/api/manage/content/news/test-news', json=payload)
        assert saved.status_code == 200, saved.text
        item = saved.json()
        assert item['value']['owner_unit_id'] == 'ai-center'
        assert 'test-news' not in root.get('/data/news.json').text
        item['value']['status'] = 'published'
        published = a.put('/api/manage/content/news/test-news', json=item)
        assert published.status_code == 200, published.text
        assert 'test-news' in ordinary.get('/data/news.json').text
        assert a.put('/api/manage/content/news/test-news', json=item).status_code == 409
        item = published.json()
        item['value']['visibility'] = 'internal'
        private = a.put('/api/manage/content/news/test-news', json=item).json()
        assert 'test-news' not in TestClient(app).get('/data/news.json').text
        assert 'test-news' in ordinary.get('/api/internal/news').text
        assert TestClient(app).get('/api/internal/news').status_code == 401
        bad = dict(private, value={**private['value'], 'cover_image':'javascript:alert(1)'})
        assert a.put('/api/manage/content/news/test-news', json=bad).status_code == 422
        a.headers['x-csrf-token'] = 'forged'
        assert a.put('/api/manage/content/news/test-news', json=private).status_code == 403
        a.headers['x-csrf-token'] = a.get('/api/manage').json()['csrf']
        assert a.put('/api/manage/content/news/test-news', json=private, headers={'origin':'https://evil.test'}).status_code == 403
        versions = a.get('/api/manage/history/news/test-news').json()['items']
        original = next(h['value'] for h in versions if h['value']['status'] == 'draft')
        assert a.put('/api/manage/content/news/test-news', json={'value':original,'revision':private['revision']}).status_code == 200
        assert a.post('/api/manage/files/ai-center', content=b'bad', headers={'content-type':'image/png'}).status_code == 422
        upload = a.post('/api/manage/files/ai-center', content=b'%PDF-1.4\n test', headers={'content-type':'application/pdf'})
        assert upload.status_code == 200, upload.text
        url = '/'+upload.json()['url']
        assert TestClient(app).get(url).status_code == 401
        assert a.get(url).status_code == 200
        assert ordinary.get(url).status_code == 403
        current = next(i for i in a.get('/api/manage/content/news').json()['items'] if i['value']['id'] == 'test-news')
        current['value'].update(status='published', visibility='public', attachments=[{'name':'Document','href':url.lstrip('/')}])
        file_news=a.put('/api/manage/content/news/test-news',json=current)
        assert file_news.status_code == 200, file_news.text
        assert TestClient(app).get(url).status_code == 200
        archived=file_news.json();archived['value']['status']='archived'
        assert a.put('/api/manage/content/news/test-news',json=archived).status_code == 200
        assert TestClient(app).get(url).status_code == 401
        assert grant('UNIT_A','unit_admin',['ai-center'],False).status_code == 200
        assert a.get('/api/manage').status_code == 403
        assert a.get(url).status_code == 403
        assert a.get('/api/me').json()['user']['role'] == 'internal_user'
        assert Path(directory,'state.json').exists()
        # Runtime reload preserves grants and content, and bootstrap account cannot be removed.
        from backend.store import Store
        persisted=Store(directory,store.source).read()
        assert persisted['grants']['UNIT_A']['active'] is False
        assert persisted['history'] and persisted['audit']
        assert grant('TEST_ROOT','unit_admin',['ai-center']).status_code == 409
        assert grant('LAST_ADMIN','system_admin',[]).status_code == 200
        last=client('LAST_ADMIN');last.headers['x-csrf-token']=last.get('/api/manage').json()['csrf']
        with patch('backend.main.settings',replace(config,system_admin_ids=())):
            entry=next(i for i in last.get('/api/manage/grants').json()['items'] if i['identity']=='LAST_ADMIN')
            assert last.put('/api/manage/grants',json={**entry,'active':False}).status_code==409
        assert TestClient(app).get('/var/state.json').status_code == 404
        assert TestClient(app).get('/data/../var/state.json').status_code == 404
        assert TestClient(app).get('/data/theme.json').status_code == 404
        print('PASS management: role hierarchy, unit scope, persistence, CSRF/origin, conflicts, history, public filtering, uploads, revocation, last-admin protection')


if __name__ == '__main__':
    main()
