"""Real requests, isolated persistence, time boundaries, and aggregate authorization."""
import json
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store, analytics
from backend.analytics import Analytics, local_now, target


def main():
    config = replace(settings, admin_identity_claim='sub', system_admin_ids=('TEST_ROOT',))
    with TemporaryDirectory() as directory, patch.object(store, 'directory', Path(directory)), patch('backend.main.settings', config):
        def client(identity=None):
            result = TestClient(app, follow_redirects=False)
            if identity:
                sid = sessions.create({'name': identity}, {'sub': identity})
                result.cookies.set('medresearch_session', signed_session_cookie(sid))
            return result

        root, visitor, ordinary = client('TEST_ROOT'), client(), client('ORDINARY')
        root.headers['x-csrf-token'] = root.get('/api/manage').json()['csrf']
        for identity, role, units in [('UNIT_A', 'unit_admin', ['ai-center']),
                                      ('MULTI', 'unit_admin', ['ai-center', 'core-laboratory']),
                                      ('DEPT', 'site_admin', [])]:
            assert root.put('/api/manage/grants', json=dict(identity=identity, role=role, units=units,
                            active=True, revision=None)).status_code == 200
        a, multi, dept = client('UNIT_A'), client('MULTI'), client('DEPT')
        assert visitor.get('/api/manage/analytics').status_code == 401
        assert ordinary.get('/api/manage/analytics').status_code == 403
        assert root.get('/api/manage/analytics?days=365').status_code == 422
        assert root.get('/api/manage/analytics?days=bad').status_code == 422
        assert a.get('/api/manage/analytics?unit=core-laboratory').status_code == 403
        assert a.get('/api/manage/analytics?unit=medresearch').status_code == 403
        empty = root.get('/api/manage/analytics').json()
        assert empty['views'] == empty['downloads'] == 0 and len(empty['daily']) == 30
        assert empty['first_recorded'] is None and not (Path(directory) / 'analytics').exists()
        state_before = (Path(directory) / 'state.json').read_bytes()

        with store.transaction() as state:
            state['content']['news'] = [dict(id=i, title=i, owner_unit_id='ai-center',
                                            visibility=v, status=s)
                                       for i, v, s in [('analytics-public', 'public', 'published'),
                                                       ('analytics-internal', 'internal', 'published'),
                                                       ('analytics-draft', 'public', 'draft'),
                                                       ('analytics-pending', 'public', 'pending_review'),
                                                       ('analytics-archived', 'public', 'archived')]]
        unchanged_state = (Path(directory) / 'state.json').read_bytes()

        for url in ['/', '/index.html?utm_source=PRIVATE_SEARCH',
                    '/unit.html?unit=ai-center', '/unit.html?unit=core-laboratory',
                    '/unit-about.html?unit=ai-center', '/content-page.html?page=research-services',
                    '/news-detail.html?id=analytics-public', '/ai-center/news-detail.html?id=analytics-public',
                    '/search.html?q=PRIVATE_SEARCH']:
            assert visitor.get(url).status_code == 200, url
        report = root.get('/api/manage/analytics').json()
        assert report['views'] == 9 and report['today'] == 9
        assert next(i for i in report['rankings']['news'] if i['id'] == 'analytics-public')['count'] == 2
        assert next(i for i in report['rankings']['pages'] if i['id'] == 'home')['count'] == 2
        assert a.get('/api/manage/analytics').json()['views'] == 4
        assert multi.get('/api/manage/analytics').json()['views'] == 5
        assert dept.get('/api/manage/analytics').json()['views'] == 9
        assert all(u['id'] == 'ai-center' for u in a.get('/api/manage/analytics').json()['units'])

        # Manager views, private/invalid content, assets/data, embeds, robots, prefetch and HEAD are excluded.
        assert root.get('/index.html').status_code == 200
        for suffix in ['internal', 'draft', 'pending', 'archived', 'missing']:
            visitor.get('/news-detail.html?id=analytics-' + suffix)
        for url in ['/unit.html?unit=missing', '/content-page.html?page=missing',
                    '/data/units.json', '/api/me', '/healthz', '/ai-center/index.html',
                    '/assets/js/main.js', '/missing.html', '/internal']:
            visitor.get(url)
        for headers in [{'User-Agent': 'ExampleBot'}, {'User-Agent': 'HeadlessChrome'},
                        {'Purpose': 'prefetch'}, {'Sec-Purpose': 'prefetch;prerender'},
                        {'Sec-Fetch-Dest': 'iframe'}, {'Sec-Fetch-Dest': 'empty'}]:
            visitor.get('/index.html', headers=headers)
        visitor.head('/index.html')
        assert root.get('/api/manage/analytics').json()['views'] == 9
        assert (Path(directory) / 'state.json').read_bytes() == unchanged_state
        assert state_before != unchanged_state  # fixture setup, not statistics, changed content.
        assert 'analytics-internal' not in visitor.get('/data/news.json').text

        # Explicit document download counts once; preview and direct media never do.
        sample = visitor.get('/data/documents.json').json()[0]
        assert visitor.get('/' + sample['file']['href']).status_code == 200
        assert root.get('/api/manage/analytics').json()['downloads'] == 0
        response = visitor.get('/api/documents/' + sample['id'] + '/download')
        assert response.status_code == 200 and response.headers['content-disposition'].startswith('attachment;')
        assert root.get('/api/manage/analytics').json()['downloads'] == 1
        assert visitor.get('/api/documents/missing/download').status_code == 404
        # Uploaded public document uses the same protected validation as its download endpoint.
        href = root.post('/api/manage/files/ai-center', content=b'%PDF-1.4\nAnalytics test',
                         headers={'content-type': 'application/pdf', 'x-file-name': 'analytics.pdf'}).json()['url']
        draft = root.put('/api/manage/content/documents/analytics-doc', json={
            'unit': 'ai-center', 'revision': None,
            'value': dict(title='Analytics document', summary='Download test', category='申請表單',
                          version='1', visibility='public', status='draft', file={'href': href})}).json()
        assert visitor.get('/api/documents/analytics-doc/download').status_code == 404
        published = root.put('/api/manage/content/documents/analytics-doc',
                             json={**draft, 'value': {**draft['value'], 'status': 'published'}}).json()
        assert visitor.get('/' + href + '?inline=true').status_code == 200
        assert visitor.get('/' + href).status_code == 200
        assert root.get('/api/manage/analytics').json()['downloads'] == 1
        assert visitor.get('/api/documents/analytics-doc/download').status_code == 200
        assert a.get('/api/manage/analytics').json()['downloads'] == 1
        assert root.get('/api/manage/analytics').json()['downloads'] == 2
        assert root.get('/api/documents/analytics-doc/download').status_code == 200
        assert root.get('/api/manage/analytics').json()['downloads'] == 2
        assert root.put('/api/manage/content/documents/analytics-doc',
                        json={**published, 'value': {**published['value'], 'status': 'archived'}}).status_code == 200
        assert visitor.get('/api/documents/analytics-doc/download').status_code == 404
        assert a.get('/api/manage/analytics').json()['downloads'] == 1  # history retained

        # Deployment prefix, root aliases and search canonicalization.
        outer = FastAPI()
        outer.mount('/medresearch', app)
        prefixed = TestClient(outer)
        assert prefixed.get('/medresearch/unit.html?unit=ai-center').status_code == 200
        assert root.get('/api/manage/analytics').json()['views'] == 10
        for path in Path(directory).glob('analytics/*.json'):
            raw = path.read_text(encoding='utf-8')
            assert all(secret not in raw for secret in ('PRIVATE_SEARCH', 'ORDINARY', 'TEST_ROOT', 'user-agent', '127.0.0.1'))
            assert visitor.get('/analytics/' + path.name).status_code == 404

        # Per-day isolation and exact Taipei midnight boundary, including concurrent updates.
        event = target('page:concurrency', 'pages', 'concurrency', 'Counter', 'ai-center', 'unit.html?unit=ai-center')
        moment = local_now().replace(hour=0, minute=0, second=0, microsecond=0)
        before_midnight = (moment - timedelta(seconds=1)).astimezone(timezone.utc)
        analytics.record(event, before_midnight)
        analytics.record(event, moment.astimezone(timezone.utc))
        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(lambda _: analytics.record(event, moment), range(24)))
        reloaded = Analytics(store)
        result = reloaded.report({'role': 'unit_admin', 'units': ['ai-center']},
                                 [{'id': 'ai-center', 'name': '人工智慧中心'}], 7, moment=moment)
        assert result['daily'][-2]['views'] == 1 and result['daily'][-1]['views'] == 30
        assert next(i for i in result['rankings']['pages'] if i['id'] == 'concurrency')['count'] == 26
        assert root.get('/api/manage/analytics?days=7').json()['views'] == 36
        assert result['tracked_days'] == 2 and all(not row['tracked'] for row in result['daily'][:-2])
        # Static AI HTML cache revalidation is a page view, not a lost refresh.
        ai_page = visitor.get('/ai-center/about.html')
        assert ai_page.status_code == 200
        assert visitor.get('/ai-center/about.html', headers={'if-none-match': ai_page.headers['etag']}).status_code == 304
        assert root.get('/api/manage/analytics').json()['views'] == 38
        # Repeated query keys follow the same first-value semantics as public templates.
        visitor.get('/news-detail.html?id=analytics-internal&id=analytics-public')
        assert root.get('/api/manage/analytics').json()['views'] == 38
        # Corrupt storage is surfaced, never silently reset; counting errors do not break public pages.
        today_file = Path(directory) / 'analytics' / (moment.date().isoformat() + '.json')
        original = today_file.read_bytes()
        today_file.write_text('broken', encoding='utf-8')
        assert root.get('/api/manage/analytics').status_code == 503
        assert visitor.get('/index.html').status_code == 200
        assert today_file.read_text(encoding='utf-8') == 'broken'
        today_file.write_bytes(original)
        # Existing sessions lose statistics access immediately after revocation.
        with store.transaction() as state:
            state['grants']['UNIT_A']['active'] = False
        assert a.get('/api/manage/analytics').status_code == 403
        assert not (Path(directory) / 'analytics' / 'state.json').exists()
    print('PASS analytics: real page/download requests, canonical IDs, private/manager/bot/prefetch exclusion, role and unit scope, revocation, persistence, atomic concurrent writes, Taipei dates, corrupt storage and deployment prefix')


if __name__ == '__main__':
    main()
