"""Biobank seed upgrade, public resources, scope and shared-data regression."""
import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from dataclasses import replace
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store
from backend.store import Store


def main():
    source = Path('data')
    seeds = {kind: json.loads((source / f'{kind}.json').read_text(encoding='utf-8-sig'))
             for kind in ('units', 'people', 'news')}
    unit = next(item for item in seeds['units'] if item['id'] == 'biobank')
    assert sum(item['id'] == 'biobank' for item in seeds['units']) == 1
    history = [item for item in seeds['news'] if item['owner_unit_id'] == 'biobank']
    assert len(history) == 32 and all(item['status'] == 'expired' for item in history)
    assert min(item['published_at'][:10] for item in history) == '2011-11-15'
    assert max(item['published_at'][:10] for item in history) == '2023-06-12'
    belongs = lambda kind, item: (item['id'] == 'biobank' if kind == 'units' else
                                 item.get('unit_id' if kind == 'people' else 'owner_unit_id') == 'biobank')
    with TemporaryDirectory() as directory:
        isolated = Store(directory, source)
        old = {'grants': {'EXAMPLE': {'active': True}}, 'content': {
            kind: [item for item in values if not belongs(kind, item)] for kind, values in seeds.items()
        }, 'history': [{'example': 'preserve'}], 'audit': [], 'files': {'example': {'preserve': True}}}
        old['content']['units'][0]['full_description'] = 'Preserve managed content'
        old['content']['pages'] = json.loads((source / 'pages.json').read_text(encoding='utf-8-sig'))
        department = old['content']['pages'][0]
        department['summary'] = 'Keep custom department summary'
        directory_group = next(group for group in department['groups'] if group['title'] == '隸屬單位')
        directory_group['title'] = '七個隸屬單位'
        directory_group['cards'] = directory_group['cards'][:-1]
        isolated._write(old)
        original = (Path(directory) / 'state.json').read_bytes()
        isolated.upgrade_biobank_content()
        updated = isolated.read()
        assert (Path(directory) / 'state.before-biobank-2026-11-18.json').read_bytes() == original
        for kind in seeds:
            assert [item for item in updated['content'][kind] if not belongs(kind, item)] == old['content'][kind]
        for key in ('grants', 'history', 'audit', 'files'):
            assert updated[key] == old[key]
        assert updated['content']['pages'][0]['summary'] == 'Keep custom department summary'
        group = next(group for group in updated['content']['pages'][0]['groups'] if group['title'] == '隸屬單位')
        assert group['cards'][:-1] == directory_group['cards']
        assert group['cards'][-1]['actions'][0]['href'] == 'unit.html?unit=biobank'
        assert updated['content']['pages'][1:] == old['content']['pages'][1:]
        # Repeated startup must not overwrite edits or resurrect removed content.
        updated['content']['units'][-1]['full_description'] = 'Managed biobank introduction'
        updated['content']['news'] = [item for item in updated['content']['news'] if item['id'] != history[0]['id']]
        isolated._write(updated)
        isolated.upgrade_biobank_content()
        assert isolated.read() == updated

    config = replace(settings, admin_identity_claim='sub', system_admin_ids=('EXAMPLE_ROOT',))
    with TemporaryDirectory() as directory, patch.object(store, 'directory', Path(directory)), patch('backend.main.settings', config):
        public = TestClient(app)
        public_unit = next(item for item in public.get('/data/units.json').json() if item['id'] == 'biobank')
        assert public_unit == {key: value for key, value in unit.items() if key != 'updated_by'}
        local = []
        for section in unit['special_sections']:
            local += [item['href'] for item in section.get('links', []) if item['href'].startswith('assets/')]
            local += [item['src'] for item in section.get('figures', [])]
        local += [d['file']['href'] for d in public.get('/data/documents.json').json() if d.get('original_file_href') and d['owner_unit_id']=='biobank']
        assert len(local) == 20
        for path in local:
            response = public.get('/' + path)
            assert response.status_code == 200, path
            assert response.content == Path(path).read_bytes(), path
            if path.endswith('.pdf'): assert response.content.startswith(b'%PDF-'), path
        root = TestClient(app)
        sid = sessions.create({'name': 'Example root'}, {'sub': 'EXAMPLE_ROOT'})
        root.cookies.set('medresearch_session', signed_session_cookie(sid))
        root.headers['x-csrf-token'] = root.get('/api/manage').json()['csrf']
        result = root.put('/api/manage/grants', json={'identity':'EXAMPLE_BIOBANK','role':'unit_admin','units':['biobank'],'active':True,'revision':None})
        assert result.status_code == 200
        manager = TestClient(app)
        sid = sessions.create({'name':'Example unit manager'}, {'sub':'EXAMPLE_BIOBANK'})
        manager.cookies.set('medresearch_session', signed_session_cookie(sid))
        overview = manager.get('/api/manage').json()
        assert overview['units'] == [{'id':'biobank','name':'人體生物資料庫'}]
        assert set(overview['kinds']) == {'units','news','people','documents'}
        manager.headers['x-csrf-token'] = overview['csrf']
        own = manager.get('/api/manage/content/units').json()['items']
        assert len(own) == 1 and own[0]['value']['id'] == 'biobank'
        malformed = copy.deepcopy(own[0])
        malformed['value']['special_sections'][2]['tables'][0]['rows'][0].pop()
        assert manager.put('/api/manage/content/units/biobank', json=malformed).status_code == 422
        malformed = copy.deepcopy(own[0])
        malformed['value']['special_sections'][0]['figures'][0].pop('alt')
        assert manager.put('/api/manage/content/units/biobank', json=malformed).status_code == 422
        edited = copy.deepcopy(own[0]); edited['value']['full_description'] = 'Shared-data verification'
        saved = manager.put('/api/manage/content/units/biobank', json=edited)
        assert saved.status_code == 200, saved.text
        assert next(item for item in public.get('/data/units.json').json() if item['id'] == 'biobank')['full_description'] == 'Shared-data verification'
        assert manager.put('/api/manage/content/units/academic-office', json=edited).status_code == 403
        assert manager.get('/api/manage/grants').status_code == 403
        # Public API excludes unpublished and internal records even under new-unit scope.
        state = store.read()
        state['content']['units'][-1]['visibility'] = 'internal'
        state['content']['news'] = copy.deepcopy(history)
        state['content']['news'][0]['visibility'] = 'internal'
        state['content']['news'][1]['status'] = 'draft'
        store._write(state)
        assert not any(item['id'] == 'biobank' for item in public.get('/data/units.json').json())
        public_ids = {item['id'] for item in public.get('/data/news.json').json()}
        assert history[0]['id'] not in public_ids and history[1]['id'] not in public_ids
    print('PASS biobank: additive migration/backup/idempotence, 32 original dates, 20 local resources, role scope, shared preview data, public filtering')


if __name__ == '__main__':
    main()
