"""Offline authorization regression checks using fictional identities only."""
from dataclasses import replace
from unittest.mock import patch, AsyncMock
from tests.check_backend import app, settings, sessions, signed_session_cookie, oidc
from fastapi.testclient import TestClient
from backend.permissions import resolved_role


def main():
    configured = replace(settings, admin_identity_claim='employee_id', system_admin_ids=('TEST001',))
    for value in ('test001', ' TEST001', '', None, ['TEST001'], 1):
        assert resolved_role({'employee_id': value}, configured) == 'internal_user'
    assert resolved_role({'sub': 'TEST001'}, configured) == 'internal_user'
    assert resolved_role({'employee_id': 'TEST001'}, configured) == 'system_admin'
    with patch('backend.main.settings', configured), TestClient(app, follow_redirects=False) as client:
        version = client.get('/api/version')
        assert version.json() == {'version': '2026.10.30.3', 'management': 'server_authorized'}
        assert version.headers['x-medresearch-version'] == '2026.10.30.3'
        assert version.headers['cache-control'] == 'no-store'
        assert client.get('/assets/js/main.js').headers['cache-control'] == 'no-cache'
        for path in ('/internal', '/admin', '/admin-demo/', '/admin-demo/news-edit.html'):
            response = client.get(path)
            assert response.status_code == 303
            assert response.headers['location'].endswith('/auth/login')
            assert response.headers['cache-control'] == 'no-store'
        client.cookies.set('medresearch_auth', '1')
        assert client.get('/admin').status_code == 303
        sid = sessions.create({'id': 'other', 'name': '<script>bad()</script>', 'role': 'system_admin'},
                              {'sub': 'other', 'employee_id': 'OTHER', 'access_token': 'never-show-this'})
        client.cookies.set('medresearch_session', signed_session_cookie(sid))
        response = client.get('/internal')
        assert response.status_code == 200
        assert '<script>bad()' not in response.text and '&lt;script&gt;' in response.text
        assert 'never-show-this' not in response.text
        assert '登入身分確認' not in response.text
        assert '本次回傳欄位名稱' not in response.text
        assert 'employee_id' not in response.text
        assert client.get('/api/me').json()['user']['role'] == 'internal_user'
        for path in ('/admin', '/admin-demo/', '/admin-demo/news-edit.html', '/admin-demo/../admin-demo/index.html'):
            assert client.get(path).status_code == 403
        sessions.get(sid)['claims']['employee_id'] = 'TEST001'
        assert client.get('/api/me').json()['user']['role'] == 'system_admin'
        assert client.get('/admin').status_code == 200
        assert 'role-switcher' not in client.get('/admin-demo/').text
        assert '內容管理 Demo' not in client.get('/admin-demo/').text
        assert '此為 UI Demo' not in client.get('/admin-demo/').text
        assert client.head('/admin-demo/news-edit.html').status_code == 200
        with patch('backend.main.settings', replace(configured, system_admin_ids=())):
            assert client.get('/admin').status_code == 403
        with patch.object(oidc, 'complete_login', AsyncMock(return_value=(
            {'name': 'Verified test', 'role': 'internal_user'},
            {'sub': 'verified', 'employee_id': 'TEST001'}
        ))):
            callback = client.get('/auth/callback')
        assert callback.headers['location'].endswith('/admin')
        assert sessions.get(sid) is None
        assert client.get('/api/me').json()['user']['role'] == 'system_admin'
        assert client.get('/admin').status_code == 200
        client.get('/auth/logout')
        assert client.get('/admin').status_code == 303
    # Reverse proxy prefix must survive redirects and generated links.
    prefixed = replace(configured, app_base_url='https://example.test/medresearch')
    with patch('backend.main.settings', prefixed), TestClient(app, follow_redirects=False, root_path='/medresearch') as client:
        assert client.get('/internal').headers['location'] == 'https://example.test/medresearch/auth/login'
        sid = sessions.create({'name': 'Test'}, {'sub': 'test', 'employee_id': 'TEST001'})
        client.cookies.set('medresearch_session', signed_session_cookie(sid))
        page = client.get('/internal')
        assert 'https://example.test/medresearch/admin' in page.text
        assert page.headers['cache-control'] == 'no-store'
    # Confirmed subject-based authorization survives retirement of the diagnostic UI.
    subject_settings = replace(configured, admin_identity_claim='sub', system_admin_ids=('TEST-SUBJECT-001',))
    with patch('backend.main.settings', subject_settings), TestClient(app, follow_redirects=False) as client:
        sid = sessions.create({'name': 'Verified user'}, {'sub': 'TEST-SUBJECT-001', 'private_field': 'hidden-subject-data'})
        client.cookies.set('medresearch_session', signed_session_cookie(sid))
        page = client.get('/internal')
        assert '系統管理員' in page.text and '/admin' in page.text
        assert 'TEST-SUBJECT-001' not in page.text and 'hidden-subject-data' not in page.text
        assert '登入身分確認' not in page.text
        assert client.get('/api/me').json()['user']['role'] == 'system_admin'
        assert client.get('/admin').status_code == 200
        sessions.get(sid)['claims']['sub'] = 'OTHER-SUBJECT'
        assert client.get('/admin').status_code == 403
    print('PASS portal: anonymous, denied, exact identity, escaping, no claims UI, sub authorization, revocation, logout, prefix')


if __name__ == '__main__':
    main()
