"""Management API: verified identity, server scope, CSRF, revisions and private storage."""
import copy
import hashlib
import json
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlsplit, unquote
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse, Response

KINDS = {'units', 'news', 'people', 'pages', 'services', 'site', 'theme', 'documents'}
MANAGERS = {'unit_admin', 'site_admin', 'system_admin'}
LABELS = {'internal_user': '一般院內人員', 'unit_admin': '單位管理員', 'site_admin': '醫研部總管理員', 'system_admin': '系統管理員'}


def now():
    return datetime.now(timezone.utc).isoformat()


def revision(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def profile(claims, settings, state):
    identity = claims.get(settings.admin_identity_claim)
    identity = identity if isinstance(identity, str) else ''
    if identity and identity in settings.system_admin_ids:
        return {'identity': identity, 'role': 'system_admin', 'units': [], 'bootstrap': True}
    grant = state['grants'].get(identity, {}) if identity else {}
    return {'identity': identity, 'role': grant.get('role', 'internal_user') if grant.get('active') else 'internal_user',
            'units': grant.get('units', []), 'bootstrap': False}


def owner(kind, item):
    return item.get('id') if kind == 'units' else item.get('unit_id') if kind == 'people' else item.get('owner_unit_id', 'medresearch')


def allowed(actor, kind, item):
    if actor['role'] == 'system_admin':
        return True
    if kind == 'theme':
        return False
    if actor['role'] == 'site_admin':
        return True
    return actor['role'] == 'unit_admin' and kind in {'units', 'people', 'news', 'documents'} and owner(kind, item) in actor['units']


def visible(item, kind):
    if kind == 'documents':
        return item.get('visibility') == 'public' and item.get('status') == 'published'
    return item.get('visibility', 'public') in {'public', 'both'} and item.get('status', 'active') in {'active', 'published', 'expired'}


def audit(state, actor, action, kind, identifier, unit=None):
    state['audit'].append({'time': now(), 'actor': actor['identity'], 'action': action, 'kind': kind, 'id': identifier, 'unit': unit})


def validate(value):
    """Content is plain text. URLs cannot introduce executable or protocol-relative links."""
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {'href', 'url', 'src', 'cover_image', 'hero_image', 'source_url', 'site_href', 'site_about_href'} and isinstance(child, str) and child:
                if any(c in child for c in '\\<>\r\n\t\"\'') or child.startswith('//') or child != child.strip():
                    raise HTTPException(422, '連結格式不正確')
                scheme = urlsplit(child).scheme
                if scheme and scheme not in {'https', 'http', 'mailto', 'tel'}:
                    raise HTTPException(422, '連結協定不允許')
            validate(child)
    elif isinstance(value, list):
        for child in value:
            validate(child)
    elif isinstance(value, str) and ('<' in value or '>' in value):
        raise HTTPException(422, '請輸入純文字，不接受 HTML 標籤')


def install(app, runtime, store):
    def context(request, state, manager=True, write=False):
        record = runtime.sessions.get(request.session.get('session_id'))
        if not record:
            raise HTTPException(401, '請重新登入')
        actor = profile(record['claims'], runtime.settings, state)
        if manager and actor['role'] not in MANAGERS:
            raise HTTPException(403, '沒有管理權限')
        if write:
            token = record.get('csrf', '')
            if not token or not secrets.compare_digest(request.headers.get('x-csrf-token', ''), token):
                raise HTTPException(403, '驗證碼失效，請重新載入頁面')
            origin = request.headers.get('origin')
            base = urlsplit(runtime.settings.app_base_url)
            if origin and origin != f'{base.scheme}://{base.netloc}':
                raise HTTPException(403, '來源不符')
        return actor, record

    async def body(request):
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > 1024 * 1024:
                raise HTTPException(413, '資料超過 1 MB')
        try:
            result = json.loads(data)
        except (ValueError, UnicodeError):
            raise HTTPException(422, 'JSON 格式不正確')
        if not isinstance(result, dict):
            raise HTTPException(422, '資料必須為物件')
        return result

    @app.get('/api/manage')
    async def overview(request: Request):
        state = store.read()
        actor, record = context(request, state)
        record.setdefault('csrf', secrets.token_urlsafe(32))
        return {'profile': actor, 'label': LABELS[actor['role']], 'csrf': record['csrf'],
                'units': [{'id': u['id'], 'name': u['name']} for u in store.collection(state, 'units') if allowed(actor, 'units', u)],
                'kinds': [k for k in sorted(KINDS) if k != 'theme' or actor['role'] == 'system_admin'] if actor['role'] != 'unit_admin' else ['units', 'news', 'people', 'documents']}

    @app.get('/api/manage/grants')
    async def grants(request: Request):
        state = store.read()
        actor, _ = context(request, state)
        if actor['role'] not in {'site_admin', 'system_admin'}:
            raise HTTPException(403)
        entries = [{'identity': key, **value, 'revision': revision(value)} for key, value in state['grants'].items()
                   if actor['role'] == 'system_admin' or value['role'] == 'unit_admin']
        return {'items': entries, 'bootstrap': list(runtime.settings.system_admin_ids) if actor['role'] == 'system_admin' else []}

    @app.put('/api/manage/grants')
    async def grant(request: Request):
        payload = await body(request)
        with store.transaction() as state:
            actor, _ = context(request, state, write=True)
            identity = payload.get('identity')
            role = payload.get('role')
            units = payload.get('units', [])
            active = payload.get('active', True)
            if not isinstance(identity, str) or not identity.strip() or len(identity) > 160 or identity != identity.strip():
                raise HTTPException(422, '請填寫完整員工識別值')
            old = state['grants'].get(identity)
            if role not in MANAGERS or not isinstance(active, bool) or not isinstance(units, list):
                raise HTTPException(422, '角色或單位格式不正確')
            if actor['role'] != 'system_admin' and (actor['role'] != 'site_admin' or role != 'unit_admin' or (old and old['role'] != 'unit_admin')):
                raise HTTPException(403, '只有系統管理員可管理高階角色')
            if identity in runtime.settings.system_admin_ids:
                raise HTTPException(409, '此帳號為伺服器保留管理員，請由維運設定調整')
            if payload.get('revision') != (revision(old) if old else None):
                raise HTTPException(409, '授權已更新，請重新載入')
            known = {u['id'] for u in store.collection(state, 'units')}
            if any(not isinstance(u, str) or u not in known for u in units) or (role == 'unit_admin' and not units):
                raise HTTPException(422, '請選擇有效的管理單位')
            if old and old['role'] == 'system_admin' and old['active'] and (not active or role != 'system_admin'):
                others = any(k != identity and v['role'] == 'system_admin' and v['active'] for k, v in state['grants'].items())
                if not others and not runtime.settings.system_admin_ids:
                    raise HTTPException(409, '不能停用最後一位系統管理員')
            state['grants'][identity] = {'role': role, 'units': sorted(set(units)) if role == 'unit_admin' else [], 'active': active}
            audit(state, actor, '設定授權' if active else '停用授權', 'grants', identity)
        return {'ok': True}

    @app.get('/api/manage/content/{kind}')
    async def content(kind: str, request: Request):
        if kind not in KINDS:
            raise HTTPException(404)
        state = store.read()
        actor, _ = context(request, state)
        collection = store.collection(state, kind)
        items = collection if isinstance(collection, list) else [dict(collection, id=kind)]
        return {'items': [{'value': item, 'revision': revision(item)} for item in items if allowed(actor, kind, item)]}

    def save(state, actor, kind, identifier, payload):
        collection = store.collection(state, kind)
        singleton = not isinstance(collection, list)
        items = [dict(collection, id=kind)] if singleton else collection
        old = next((i for i in items if i['id'] == identifier), None)
        if old and not allowed(actor, kind, old):
            raise HTTPException(403, '不能修改其他單位內容')
        if payload.get('revision') != (revision(old) if old else None):
            raise HTTPException(409, '內容已被其他人更新，請重新載入後再編輯')
        value = payload.get('value')
        if not isinstance(value, dict):
            raise HTTPException(422, '內容格式不正確')
        value = copy.deepcopy(value)
        if old:
            value = {**old, **value}
        value['id'] = identifier
        if old:
            # Ownership is immutable through editing and history restore.
            for key in ('owner_unit_id', 'unit_id'):
                if key in old:
                    value[key] = old[key]
        elif kind in {'news', 'people', 'documents'}:
            unit = payload.get('unit')
            known = {u['id'] for u in store.collection(state, 'units')} | {'medresearch'}
            if unit not in known or (actor['role'] == 'unit_admin' and unit not in actor['units']):
                raise HTTPException(403, '未獲授權的單位')
            value['unit_id' if kind == 'people' else 'owner_unit_id'] = unit
        elif not old:
            raise HTTPException(422, '此資料類型請編輯既有項目')
        if not allowed(actor, kind, value):
            raise HTTPException(403)
        if actor['role'] == 'unit_admin':
            if kind == 'units':
                for key in ('name', 'slug', 'status', 'visibility', 'display_order', 'site_href', 'site_about_href', 'template_label'):
                    if value.get(key) != old.get(key):
                        raise HTTPException(403, '單位結構欄位須由總管理員維護')
            if kind == 'news':
                value['featured'] = old.get('featured', False) if old else False
                value['related_unit_ids'] = old.get('related_unit_ids', []) if old else []
        validate(value)
        # Preserve established data shapes so malformed edits cannot break public templates.
        def shape(before, after):
            if isinstance(before, dict):
                if not isinstance(after, dict):
                    raise HTTPException(422, '物件欄位格式不正確')
                for key, child in before.items():
                    if key in {'created_by', 'updated_by'}:
                        continue
                    if key not in after:
                        raise HTTPException(422, f'缺少欄位：{key}')
                    # Existing and newly uploaded files may carry different optional metadata.
                    # Validate these collections below instead of treating the first old file as a schema.
                    if before is old and kind == 'news' and key in {'attachments', 'gallery'}:
                        continue
                    if before is old and kind == 'documents' and key == 'file':
                        continue
                    if before is old and kind == 'pages' and key == 'groups':
                        continue
                    shape(child, after[key])
            elif isinstance(before, list):
                if not isinstance(after, list):
                    raise HTTPException(422, '清單欄位格式不正確')
                if before:
                    for child in after:
                        shape(before[0], child)
            elif before is not None and type(before) is not type(after):
                raise HTTPException(422, '欄位資料型別不正確')
        if old:
            shape(old, value)
        if kind == 'news':
            for key in ('attachments', 'gallery'):
                if key in value and (not isinstance(value[key], list) or any(not isinstance(x, dict) for x in value[key])):
                    raise HTTPException(422, '附件或圖集格式不正確')
        if kind == 'documents':
            from .documents import validate_document
            value = validate_document(value, old, state, store)
        if kind == 'pages' and 'groups' in value:
            from .resources import validate_groups
            validate_groups(value['groups'])
        if kind == 'units' and value.get('status') not in {'active', 'inactive', 'archived'}:
            raise HTTPException(422, '單位狀態不正確')
        # Referencing an unpublished upload cannot be used to publish another unit's file.
        serialized = json.dumps(value, ensure_ascii=False)
        for file_id, metadata in state['files'].items():
            if f'media/{file_id}' in serialized and actor['role'] == 'unit_admin' and metadata['unit'] not in actor['units']:
                raise HTTPException(403, '不能引用其他單位的上傳檔案')
        if kind == 'theme':
            if not re.fullmatch(r'#[0-9a-fA-F]{6}', str(value.get('accent', ''))) or str(value.get('width')) not in {'1100', '1200', '1320'}:
                raise HTTPException(422, '請選擇有效的色碼與版面寬度')
        else:
            required = 'name' if kind in {'units', 'people', 'site'} else 'title'
            if not isinstance(value.get(required), str) or not value[required].strip():
                raise HTTPException(422, '名稱／標題不可空白')
            if value.get('visibility', 'public') not in {'public', 'both', 'internal'}:
                raise HTTPException(422, '顯示範圍不正確')
            if kind == 'news':
                if value.get('status') not in {'draft', 'pending_review', 'published', 'expired', 'archived'}:
                    raise HTTPException(422, '消息狀態不正確')
                if not isinstance(value.get('content'), list) or not all(isinstance(x, str) for x in value['content']):
                    raise HTTPException(422, '本文必須為段落陣列')
                for key in ('published_at', 'expires_at', 'event_date'):
                    if value.get(key):
                        try:
                            datetime.fromisoformat(value[key].replace('Z', '+00:00'))
                        except (ValueError, TypeError, AttributeError):
                            raise HTTPException(422, '日期格式不正確')
                if value['status'] == 'published' and not value.get('published_at'):
                    value['published_at'] = now()
        value['updated_at'] = now()
        # Employee identifiers are kept in private audit only, not public content.
        value.pop('updated_by', None)
        value.pop('created_by', None)
        state['history'].append({'version': secrets.token_hex(12), 'kind': kind, 'id': identifier, 'value': copy.deepcopy(value), 'time': now()})
        if old and not any(h['kind'] == kind and h['id'] == identifier and h['value'] == old for h in state['history']):
            state['history'].append({'version': secrets.token_hex(12), 'kind': kind, 'id': identifier, 'value': old, 'time': old.get('updated_at', '原始版本')})
        if singleton:
            state['content'][kind] = value
        else:
            state['content'][kind] = [value if i['id'] == identifier else i for i in items] if old else items + [value]
        if kind == 'people':
            units = store.collection(state, 'units')
            for unit in units:
                if unit['id'] == value['unit_id']:
                    unit['members'] = [f"{person.get('title', '')} {person['name']}".strip()
                                       for person in state['content']['people'] if person.get('unit_id') == unit['id'] and visible(person, 'people')]
            state['content']['units'] = units
        audit(state, actor, '儲存內容', kind, identifier, owner(kind, value))
        return {'value': value, 'revision': revision(value)}

    def announcement_actor(request, state, write=False):
        actor, _ = context(request, state, write=write)
        if actor['role'] not in {'system_admin', 'site_admin'}:
            raise HTTPException(403, '只有系統管理員及醫研部總管理員可管理全站公告')
        return actor

    @app.get('/api/announcements')
    async def public_announcements():
        items = store.collection(store.read(), 'announcements')
        return JSONResponse({'items': [{k: i.get(k, '') for k in ('id', 'text', 'href')} for i in items if i.get('active')]}, headers={'Cache-Control': 'no-store'})

    @app.get('/api/manage/announcements')
    async def announcements(request: Request):
        state = store.read()
        announcement_actor(request, state)
        return {'items': [{'value': i, 'revision': revision(i)} for i in store.collection(state, 'announcements')]}

    @app.api_route('/api/manage/announcements/{identifier}', methods=['PUT', 'DELETE'])
    async def change_announcement(identifier: str, request: Request):
        if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', identifier):
            raise HTTPException(404)
        payload = await body(request)
        with store.transaction() as state:
            actor = announcement_actor(request, state, write=True)
            items = store.collection(state, 'announcements')
            old = next((i for i in items if i['id'] == identifier), None)
            if payload.get('revision') != (revision(old) if old else None):
                raise HTTPException(409, '公告已更新，請重新載入後再操作')
            if request.method == 'DELETE':
                if not old:
                    raise HTTPException(404, '公告不存在')
                state['content']['announcements'] = [i for i in items if i['id'] != identifier]
                value = old
            else:
                value = payload.get('value')
                if not isinstance(value, dict) or not isinstance(value.get('text'), str) or not 1 <= len(value['text'].strip()) <= 200 or type(value.get('active')) is not bool or not isinstance(value.get('href', ''), str):
                    raise HTTPException(422, '公告須為 1–200 字，並選擇啟用狀態')
                href = value.get('href', '').strip()
                try:
                    parsed = urlsplit(href)
                    invalid_url = parsed.scheme not in {'', 'https', 'http'} or (parsed.scheme and not parsed.hostname)
                except ValueError:
                    invalid_url = True
                if len(href) > 500 or invalid_url:
                    raise HTTPException(422, '連結只接受網站相對路徑或 HTTP／HTTPS 網址')
                validate({'text': value['text'], 'href': href})
                value = {'id': identifier, 'text': value['text'].strip(), 'href': href, 'active': value['active'], 'updated_at': now()}
                if not old and len(items) >= 100:
                    raise HTTPException(422, '公告最多 100 則，請先刪除不需要的內容')
                state['content']['announcements'] = [value if i['id'] == identifier else i for i in items] if old else [value] + items
            state['history'].append({'version': secrets.token_hex(12), 'kind': 'announcements', 'id': identifier, 'value': copy.deepcopy(value), 'time': now()})
            audit(state, actor, '刪除公告' if request.method == 'DELETE' else '儲存公告', 'announcements', identifier, 'medresearch')
        return {'value': value, 'revision': revision(value)}

    @app.put('/api/manage/content/{kind}/{identifier}')
    async def write(kind: str, identifier: str, request: Request):
        if kind not in KINDS or not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', identifier):
            raise HTTPException(404)
        payload = await body(request)
        with store.transaction() as state:
            actor, _ = context(request, state, write=True)
            return save(state, actor, kind, identifier, payload)

    @app.get('/api/manage/history/{kind}/{identifier}')
    async def history(kind: str, identifier: str, request: Request):
        state = store.read()
        actor, _ = context(request, state)
        return {'items': [h for h in state['history'] if h['kind'] == kind and h['id'] == identifier and allowed(actor, kind, h['value'])]}

    @app.get('/api/manage/audit')
    async def logs(request: Request):
        state = store.read()
        actor, _ = context(request, state)
        return {'items': [a for a in reversed(state['audit']) if actor['role'] in {'site_admin', 'system_admin'} or a['unit'] in actor['units']][:500]}

    @app.get('/data/{kind}.json')
    async def public_data(kind: str):
        if kind not in KINDS | {'media'} or kind == 'theme':
            raise HTTPException(404)
        state = store.read()
        value = store.collection(state, kind)
        if isinstance(value, list):
            value = [item for item in value if visible(item, kind)]
            if kind == 'news':
                for item in value:
                    expires = item.get('expires_at', '')
                    if expires and expires[:10] < now()[:10] and item['status'] == 'published':
                        item['status'] = 'expired'
        def clean(item):
            if isinstance(item, dict):
                return {k: clean(v) for k, v in item.items() if k not in {'created_by', 'updated_by'}}
            return [clean(x) for x in item] if isinstance(item, list) else item
        return JSONResponse(clean(value), headers={'Cache-Control': 'no-store'})

    @app.get('/api/internal/news')
    async def internal_news(request: Request):
        state = store.read()
        context(request, state, manager=False)
        return {'items': [i for i in store.collection(state, 'news') if i.get('status') in {'published', 'expired'} and i.get('visibility') in {'internal', 'both'}]}

    @app.post('/api/manage/files/{unit}')
    async def upload(unit: str, request: Request):
        state = store.read()
        actor, _ = context(request, state, write=True)
        if not allowed(actor, 'news', {'owner_unit_id': unit}) or unit not in {u['id'] for u in store.collection(state, 'units')} | {'medresearch'}:
            raise HTTPException(403)
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > 5 * 1024 * 1024:
                raise HTTPException(413, '檔案上限為 5 MB')
        mime = request.headers.get('content-type', '')
        signatures = {'image/png': (b'\x89PNG\r\n\x1a\n', '.png'), 'image/jpeg': (b'\xff\xd8\xff', '.jpg'), 'application/pdf': (b'%PDF-', '.pdf')}
        if mime not in signatures or not data.startswith(signatures[mime][0]):
            raise HTTPException(422, '只接受 PNG、JPEG 或 PDF，且內容須與格式一致')
        identifier = secrets.token_hex(16) + signatures[mime][1]
        filename = unquote(request.headers.get('x-file-name', ''), errors='replace').replace('\\', '/').rsplit('/', 1)[-1]
        filename = ''.join(c for c in filename if ord(c) >= 32 and ord(c) != 127)[:255] or identifier
        with store.transaction() as state:
            actor, _ = context(request, state, write=True)
            if not allowed(actor, 'news', {'owner_unit_id': unit}):
                raise HTTPException(403)
            store.directory.mkdir(parents=True, exist_ok=True)
            (store.directory / identifier).write_bytes(data)
            state['files'][identifier] = {'unit': unit, 'mime': mime, 'name': filename, 'size': len(data), 'uploaded_at': now()}
            audit(state, actor, '上傳檔案', 'files', identifier, unit)
        return {'url': f'media/{identifier}', 'size': len(data)}

    @app.get('/api/manage/files')
    async def file_library(request: Request):
        state = store.read()
        actor, _ = context(request, state)
        # Recover readable names for older uploads from content the actor may manage.
        names = {}
        for item in store.collection(state, 'news'):
            if allowed(actor, 'news', item):
                for attachment in item.get('attachments', []):
                    if isinstance(attachment, dict) and isinstance(attachment.get('name'), str) and isinstance(attachment.get('href'), str):
                        names[attachment['href'].lstrip('/')] = attachment['name']
        items = []
        for identifier, metadata in state['files'].items():
            if not allowed(actor, 'news', {'owner_unit_id': metadata['unit']}):
                continue
            path = store.directory / identifier
            if not path.is_file():
                continue
            url = f'media/{identifier}'
            items.append({'id': identifier, 'url': url, 'unit': metadata['unit'], 'mime': metadata['mime'],
                          'name': metadata.get('name') or names.get(url) or identifier,
                          'size': metadata.get('size', path.stat().st_size), 'uploaded_at': metadata.get('uploaded_at', '')})
        return {'items': sorted(items, key=lambda item: item['uploaded_at'], reverse=True)}

    @app.get('/media/{identifier}')
    async def download(identifier: str, request: Request, inline: bool = False):
        state = store.read()
        metadata = state['files'].get(identifier)
        if not metadata:
            raise HTTPException(404)
        ref = f'media/{identifier}'
        public = any((item.get('file', {}).get('href') == ref if kind == 'documents' else ref in json.dumps(item, ensure_ascii=False)) and visible(item, kind)
                     for kind in ('news', 'units', 'people', 'pages', 'documents') for item in store.collection(state, kind))
        if not public:
            actor, _ = context(request, state, manager=False)
            internal = any(ref in json.dumps(i) and i.get('status') in {'published', 'expired'} and i.get('visibility') in {'internal', 'both'} for i in store.collection(state, 'news'))
            if not internal and not allowed(actor, 'news', {'owner_unit_id': metadata['unit']}):
                raise HTTPException(403)
        # Browser PDF viewers cannot run inside a CSP sandbox. Inline responses are
        # limited to the upload endpoint's PDF/image MIME allowlist, never HTML.
        inline = inline and metadata['mime'] in {'application/pdf', 'image/png', 'image/jpeg'}
        policy = "default-src 'none'; frame-ancestors 'self'" if inline else "sandbox; default-src 'none'"
        return FileResponse(store.directory / identifier, media_type=metadata['mime'], filename=metadata.get('name') or identifier,
                            content_disposition_type='inline' if inline else 'attachment',
                            headers={'Cache-Control': 'no-store', 'Content-Security-Policy': policy})

    @app.get('/theme.css')
    async def theme():
        value = store.collection(store.read(), 'theme')
        return Response(f":root{{--green-700:{value['accent']};--green-800:{value['accent']};}} .container{{max-width:{value['width']}px;}}", media_type='text/css', headers={'Cache-Control': 'no-store'})

    from .analytics import install as install_analytics
    runtime.analytics = install_analytics(app, runtime, store, context)
