"""Announcement persistence, authorization and legacy notice compatibility."""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store
from backend.store import Store


def main():
    config = replace(settings, admin_identity_claim='sub', system_admin_ids=('ROOT',))
    with TemporaryDirectory() as directory, patch.object(store, 'directory', Path(directory)), patch('backend.main.settings', config):
        def client(identity):
            c = TestClient(app)
            sid = sessions.create({'name': identity}, {'sub': identity})
            c.cookies.set('medresearch_session', signed_session_cookie(sid))
            return c
        root, unit, dept, ordinary, public = [client(i) for i in ('ROOT', 'UNIT', 'DEPT', 'ORDINARY')] + [TestClient(app)]
        with store.transaction() as state:
            state['grants'] = {'UNIT': {'role':'unit_admin', 'units':['ai-center'], 'active':True},
                               'DEPT': {'role':'site_admin', 'units':[], 'active':True}}
        for c in (root, unit, dept):
            c.headers['x-csrf-token'] = c.get('/api/manage').json()['csrf']
        news_before = store.collection(store.read(), 'news')
        notice = store.collection(store.read(), 'site')['notice']
        assert public.get('/api/announcements').json()['items'][0]['text'] == notice
        legacy = root.get('/api/manage/announcements').json()['items'][0]
        assert public.get('/api/manage/announcements').status_code == 401
        assert ordinary.get('/api/manage/announcements').status_code == 403
        assert unit.get('/api/manage/announcements').status_code == 403
        payload = {'value': {'text':'Persisted announcement', 'href':'news.html', 'active':True}, 'revision':None}
        url = '/api/manage/announcements/test-announcement'
        assert unit.put(url, json=payload).status_code == 403
        assert public.put(url, json=payload).status_code == 401
        assert root.put(url, json=payload, headers={'x-csrf-token':'forged'}).status_code == 403
        assert root.put(url, json=payload, headers={'origin':'https://evil.test'}).status_code == 403
        for value in ({'text':' ', 'href':'', 'active':True}, {'text':'x'*201, 'href':'', 'active':True},
                      {'text':'Valid', 'href':'javascript:alert(1)', 'active':True},
                      {'text':'Valid', 'href':'//evil.test', 'active':True}, {'text':'<script>', 'href':'', 'active':True},
                      {'text':'Valid', 'href':'https://[', 'active':True}, {'text':'Valid', 'href':'', 'active':'false'}):
            assert root.put(url, json={'value':value, 'revision':None}).status_code == 422
        saved = root.put(url, json=payload)
        assert saved.status_code == 200, saved.text
        entry = saved.json()
        assert root.put(url, json=payload).status_code == 409
        assert public.get('/api/announcements').json()['items'][0]['text'] == 'Persisted announcement'
        assert 'revision' not in public.get('/api/announcements').text
        persisted = Store(directory, store.source).collection(Store(directory, store.source).read(), 'announcements')
        assert persisted[0]['text'] == 'Persisted announcement'
        entry['value']['active'] = False
        disabled = dept.put(url, json=entry)
        assert disabled.status_code == 200
        assert 'Persisted announcement' not in public.get('/api/announcements').text
        assert unit.request('DELETE', url, json={'revision':disabled.json()['revision']}).status_code == 403
        assert root.request('DELETE', url, json={'revision':entry['revision']}).status_code == 409
        assert root.request('DELETE', url, json={'revision':disabled.json()['revision']}).status_code == 200
        assert dept.request('DELETE', '/api/manage/announcements/site-notice', json={'revision':legacy['revision']}).status_code == 200
        assert public.get('/api/announcements').json()['items'] == []
        assert store.collection(Store(directory, store.source).read(), 'announcements') == []
        assert store.collection(store.read(), 'news') == news_before
        assert any(i['action'] == '刪除公告' for i in store.read()['audit'])
        print('PASS announcements: legacy notice, server persistence, empty state, roles, CSRF/origin, validation, conflicts, deletion and news preservation')


if __name__ == '__main__':
    main()
