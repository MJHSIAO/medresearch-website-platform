"""Verified-name snapshots, old audit compatibility and unchanged authorization."""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store
from backend.identity import oauth_display_name
from backend.management import profile
from backend.store import Store


def main():
    config = replace(settings, admin_identity_claim='sub', system_admin_ids=('TEST-ROOT',),
                     oidc_name_claim='unique_name')
    assert oauth_display_name({'unique_name': ' 測試管理員甲 '}, config) == '測試管理員甲'
    for value in (None, [], {}, 123, True, '', '   ', 'x' * 201, '姓名\n帳號', '姓名\u202e'):
        assert oauth_display_name({'unique_name': value}, config) == ''
    assert oauth_display_name({'name': '不可猜測', 'preferred_username': '帳號'}, config) == ''
    assert oauth_display_name({'unique_name': '未確認'}, replace(config, oidc_name_claim='')) == ''

    with TemporaryDirectory(prefix='audit-identity-') as directory, patch.object(store, 'directory', Path(directory)), patch('backend.main.settings', config):
        old = {'time': '2020-01-02T03:04:05+00:00', 'actor': 'TEST-UNIT', 'action': '歷史操作',
               'kind': 'units', 'id': 'ai-center', 'unit': 'ai-center'}
        foreign = {**old, 'actor': 'TEST-OTHER', 'id': 'biobank', 'unit': 'biobank'}
        with store.transaction() as state:
            state['audit'] = [old, foreign]
            state['grants']['TEST-UNIT'] = {'role': 'unit_admin', 'units': ['ai-center'], 'active': True, 'name': '手動名單姓名'}
        expected_profile = profile({'sub': 'TEST-UNIT'}, config, store.read())
        assert profile({'sub': 'TEST-UNIT', 'unique_name': '任意姓名', 'role': 'system_admin'}, config, store.read()) == expected_profile

        def client(identity, name=None, claims_extra=None):
            claims = {'sub': identity, **(claims_extra or {})}
            if name is not None:
                claims['unique_name'] = name
            sid = sessions.create({'id': identity, 'name': '不可使用的 Session 顯示名稱'}, claims)
            result = TestClient(app, follow_redirects=False)
            result.cookies.set('medresearch_session', signed_session_cookie(sid))
            response = result.get('/api/manage')
            if response.status_code == 200:
                result.headers['x-csrf-token'] = response.json()['csrf']
            return result

        def save(c, unit='ai-center'):
            entry = next(i for i in root.get('/api/manage/content/units').json()['items'] if i['value']['id'] == unit)
            entry['value']['full_description'] = '隔離測試內容'
            # Client-supplied audit identity must never override verified claims.
            entry.update(actor='FORGED', actor_name='偽造姓名', name_claim='name')
            return c.put('/api/manage/content/units/' + unit, json=entry)

        root = client('TEST-ROOT', '測試系統管理員')
        unit = client('TEST-UNIT', '測試管理員甲')
        assert save(unit).status_code == 200
        first = unit.get('/api/manage/audit').json()['items'][0]
        assert first['actor'] == 'TEST-UNIT' and first['actor_name'] == '測試管理員甲'
        assert first['actor_name_claim'] == 'unique_name'
        assert old in unit.get('/api/manage/audit').json()['items']
        assert foreign not in unit.get('/api/manage/audit').json()['items']

        renamed = client('TEST-UNIT', '測試管理員乙')
        assert save(renamed).status_code == 200
        assert renamed.get('/api/manage/audit').json()['items'][0]['actor_name'] == '測試管理員乙'
        assert first in renamed.get('/api/manage/audit').json()['items']
        for name in (None, ['invalid'], 'TEST-UNIT'):
            nameless = client('TEST-UNIT', name, {'name': '其他候選姓名'})
            assert save(nameless).status_code == 200
            assert 'actor_name' not in nameless.get('/api/manage/audit').json()['items'][0]
        with patch('backend.main.settings', replace(config, oidc_name_claim='')):
            assert save(unit).status_code == 200
            assert 'actor_name' not in unit.get('/api/manage/audit').json()['items'][0]

        before = store.read()['audit']
        assert save(unit, 'biobank').status_code == 403
        ordinary = client('TEST-ORDINARY', '測試系統管理員', {'role': 'system_admin'})
        assert ordinary.get('/api/manage/audit').status_code == 403
        assert TestClient(app).get('/api/manage/audit').status_code == 401
        assert store.read()['audit'] == before
        assert foreign in root.get('/api/manage/audit').json()['items']
        public = TestClient(app)
        assert 'actor_name' not in public.get('/data/units.json').text
        assert public.get('/api/me').json() == {'authenticated': False}
        with store.transaction() as state:
            state['grants']['TEST-UNIT']['active'] = False
        assert unit.get('/api/manage/audit').status_code == 403
        persisted = Store(directory, store.source).read()
        assert persisted['audit'][:2] == [old, foreign]
        assert first in persisted['audit']
        assert persisted['audit'] == before
    print('PASS verified-name snapshots, no guessing/forged identity, old audit persistence, unit scope and immediate revocation')


if __name__ == '__main__':
    main()
