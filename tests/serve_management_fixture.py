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
    parser.add_argument('--personnel-preview', action='store_true')
    parser.add_argument('--biobank-documents-preview', action='store_true')
    parser.add_argument('--audit-identity-preview', action='store_true')
    parser.add_argument('--department-preview', action='store_true')
    args = parser.parse_args()
    with TemporaryDirectory(prefix='medresearch-management-ui-') as directory:
        runtime.store.directory = Path(directory)
        runtime.settings = replace(runtime.settings, app_base_url=f'http://127.0.0.1:{args.port}/medresearch',
                                   admin_identity_claim='sub', system_admin_ids=('FIXTURE-ROOT',))
        if args.audit_identity_preview:
            runtime.settings = replace(runtime.settings, oidc_name_claim='unique_name')
        with runtime.store.transaction() as state:
            state['grants'] = {
                'FIXTURE-UNIT': {'role': 'unit_admin', 'units': ['ai-center'], 'active': True},
                'FIXTURE-SITE': {'role': 'site_admin', 'units': [], 'active': True},
                'FIXTURE-MULTI': {'role': 'unit_admin', 'units': ['ai-center', 'core-laboratory'], 'active': True}}
            if args.biobank_documents_preview:
                state['grants']['FIXTURE-BIOBANK']={'role':'unit_admin','units':['biobank'],'active':True}
            if args.department_preview:
                state['grants']['FIXTURE-DEPARTMENT']={'role':'unit_admin','units':['medresearch'],'active':True}
            if args.audit_identity_preview:
                state['audit'].append({'time':'2020-01-02T09:00:00+08:00','actor':'EXAMPLE-LEGACY',
                                       'action':'歷史紀錄（無姓名）','kind':'units','id':'biobank','unit':'biobank'})
            state['content']['news'] = [
                {'id': identifier, 'title': title, 'summary': 'Server fixture summary', 'content': ['Server fixture body'],
                 'category': '一般公告', 'owner_unit_id': unit, 'related_unit_ids': [], 'status': status,
                 'visibility': 'public', 'published_at': '2026-11-01T09:00:00+08:00' if status == 'published' else '',
                 'updated_at': '2026-11-01T09:00:00+08:00', 'featured': unit == 'core-laboratory', 'attachments': [], 'cover_image': '', 'cover_alt': ''}
                for identifier, title, unit, status in [
                    ('server-ai-public', 'SERVER-AI-PUBLISHED', 'ai-center', 'published'),
                    ('server-ai-draft', 'SERVER-AI-DRAFT', 'ai-center', 'draft'),
                    ('server-core-public', 'SERVER-CORE-PUBLISHED', 'core-laboratory', 'published')]]
            state['content']['news'][2]['published_at'] = '2026-10-01T09:00:00+08:00'
            if args.biobank_documents_preview or args.department_preview:
                # Display the unmodified public seeds; all management writes stay isolated.
                del state['content']['news']
            if args.personnel_preview:
                state['grants'].update({
                    'EXAMPLE-BIO-A': {'name':'示範管理員甲','role':'unit_admin','units':['biobank','core-laboratory'],'active':True},
                    'EXAMPLE-BIO-B': {'name':'示範管理員乙','role':'unit_admin','units':['biobank'],'active':True},
                    'EXAMPLE-SYSTEM': {'name':'示範系統管理員','role':'system_admin','units':[],'active':True}})
                people=runtime.store.collection(state,'people')
                state['content']['people']=[p for p in people if p['unit_id']!='biobank']+[
                    {'id':f'example-biobank-{index}','unit_id':'biobank','name':name,'title':title,'bio':'僅供本機功能驗證的虛構成員。','visibility':'public','display_order':index,
                     'account_identity':'EXAMPLE-BIO-A' if index==0 else ''}
                    for index,(name,title) in enumerate([('示範成員甲','研究支援'),('示範成員乙','資料管理'),('示範成員丙','檢體管理')])]

        if args.personnel_preview or args.biobank_documents_preview or args.audit_identity_preview or args.department_preview:
            from fastapi.responses import HTMLResponse
            @runtime.app.middleware('http')
            async def preview_notice(request, call_next):
                response=await call_next(request)
                if request.url.path.endswith('/admin') and response.status_code==200:
                    content=b''.join([chunk async for chunk in response.body_iterator]).decode('utf-8')
                    notice='本機隔離測試預覽｜示範帳號與新增內容供操作驗證；寫入暫存測試目錄，不影響正式資料。關閉此測試服務後清除。'
                    if args.audit_identity_preview:
                        notice+=' 姓名來自虛構 OAuth 欄位；院方 unique_name 的姓名值仍待確認。'
                    content=content.replace('<div id="workspace">',f'<p class="status-message">{notice}</p><div id="workspace">')
                    headers={k:v for k,v in response.headers.items() if k.lower() not in {'content-length','content-type'}}
                    return HTMLResponse(content,headers=headers)
                return response

        @runtime.app.get('/__fixture_login/{role}')
        async def fixture_login(role: str):
            subjects = {'system': 'FIXTURE-ROOT', 'unit': 'FIXTURE-UNIT', 'site': 'FIXTURE-SITE',
                        'multi': 'FIXTURE-MULTI', 'ordinary': 'FIXTURE-ORDINARY'}
            if args.biobank_documents_preview:
                subjects['biobank']='FIXTURE-BIOBANK'
            if args.department_preview:
                subjects['department']='FIXTURE-DEPARTMENT'
            if role not in subjects:
                raise HTTPException(404)
            claims = {'sub': subjects[role]}
            name = 'Fixture account'
            if args.audit_identity_preview:
                name = '示範管理員甲'
                claims['unique_name'] = name
            sid = runtime.sessions.create({'id': subjects[role], 'name': name}, claims)
            response = RedirectResponse('/medresearch/admin', status_code=303)
            response.set_cookie('medresearch_session', signed_session_cookie(sid), httponly=True, path='/medresearch', samesite='lax')
            response.set_cookie('medresearch_auth', '1', path='/medresearch', samesite='lax')
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
