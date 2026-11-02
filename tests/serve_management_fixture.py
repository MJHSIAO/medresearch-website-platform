"""Loopback-only, temporary-data fixture used by check_management_ui.mjs.

This module is not copied into the production image and must not be deployed.
"""
import argparse
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse
import uvicorn
from tests.check_backend import signed_session_cookie
import backend.main as runtime


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, required=True)
    args = parser.parse_args()
    with TemporaryDirectory(prefix='medresearch-management-ui-') as directory:
        runtime.store.directory = Path(directory)
        runtime.settings = replace(runtime.settings, app_base_url=f'http://127.0.0.1:{args.port}/medresearch',
                                   admin_identity_claim='sub', system_admin_ids=('FIXTURE-ROOT',))
        with runtime.store.transaction() as state:
            state['grants'] = {
                'FIXTURE-UNIT': {'role': 'unit_admin', 'units': ['ai-center'], 'active': True},
                'FIXTURE-SITE': {'role': 'site_admin', 'units': [], 'active': True},
                'FIXTURE-MULTI': {'role': 'unit_admin', 'units': ['ai-center', 'core-laboratory'], 'active': True}}
            state['content']['news'] = [
                {'id': identifier, 'title': title, 'summary': 'Server fixture summary', 'content': ['Server fixture body'],
                 'category': '一般公告', 'owner_unit_id': unit, 'related_unit_ids': [], 'status': status,
                 'visibility': 'public', 'published_at': '2026-11-01T09:00:00+08:00' if status == 'published' else '',
                 'updated_at': '2026-11-01T09:00:00+08:00', 'attachments': [], 'cover_image': '', 'cover_alt': ''}
                for identifier, title, unit, status in [
                    ('server-ai-public', 'SERVER-AI-PUBLISHED', 'ai-center', 'published'),
                    ('server-ai-draft', 'SERVER-AI-DRAFT', 'ai-center', 'draft'),
                    ('server-core-public', 'SERVER-CORE-PUBLISHED', 'core-laboratory', 'published')]]

        @runtime.app.get('/__fixture_login/{role}')
        async def fixture_login(role: str):
            subjects = {'system': 'FIXTURE-ROOT', 'unit': 'FIXTURE-UNIT', 'site': 'FIXTURE-SITE',
                        'multi': 'FIXTURE-MULTI', 'ordinary': 'FIXTURE-ORDINARY'}
            if role not in subjects:
                raise HTTPException(404)
            sid = runtime.sessions.create({'name': 'Fixture account'}, {'sub': subjects[role]})
            response = RedirectResponse('/medresearch/admin', status_code=303)
            response.set_cookie('medresearch_session', signed_session_cookie(sid), httponly=True, path='/medresearch', samesite='lax')
            return response

        outer = FastAPI(docs_url=None, redoc_url=None)
        outer.mount('/medresearch', runtime.app)
        server = uvicorn.Server(uvicorn.Config(outer, host='127.0.0.1', port=args.port, access_log=False, log_level='error'))

        @runtime.app.post('/__fixture_shutdown')
        async def fixture_shutdown():
            server.should_exit = True
            return {'ok': True}

        server.run()


if __name__ == '__main__':
    main()
