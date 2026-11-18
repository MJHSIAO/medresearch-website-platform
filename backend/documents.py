"""Validation for managed download records; uploaded file metadata is server-owned."""
import json
import re
from datetime import date, datetime, timedelta, timezone
from fastapi import HTTPException


def seed_file(store, item):
    """Only exact, same-unit shipped files may retain their public legacy URL."""
    seeds = json.loads((store.source / 'documents.json').read_text(encoding='utf-8-sig'))
    href = item.get('file', {}).get('href', '')
    return next((s for s in seeds if s.get('owner_unit_id') == item.get('owner_unit_id')
                 and s.get('file', {}).get('href') == href
                 and s.get('original_file_href') == href
                 and re.fullmatch(r'assets/documents/biobank/[0-9]+\.pdf', href)), None)


def validate_document(value, old, state, store):
    # Provenance survives editing, replacement and history restore.
    for key in ('source_url', 'source_checked_at', 'source_note', 'original_file_href'):
        if old and key in old:
            value[key] = old[key]
    for key, limit in (('title', 160), ('summary', 1000), ('version', 80)):
        text = value.get(key)
        if not isinstance(text, str) or not text.strip() or len(text) > limit:
            raise HTTPException(422, '請填寫標題、說明與版本，並確認文字長度')
        value[key] = text.strip()
    if value.get('category') not in {'作業文件', '申請表單', '檢核清單'}:
        raise HTTPException(422, '請選擇有效的文件類型')
    if value.get('status') not in {'draft', 'published', 'archived'} or value.get('visibility') not in {'public', 'internal'}:
        raise HTTPException(422, '請選擇有效的文件狀態與公開範圍')
    stamp = value.get('document_date', (old or {}).get('updated_at', '')[:10] or datetime.now(timezone(timedelta(hours=8))).date().isoformat())
    try:
        if not isinstance(stamp, str) or (stamp and date.fromisoformat(stamp).isoformat() != stamp):
            raise ValueError()
    except ValueError:
        raise HTTPException(422, '文件日期須為 YYYY-MM-DD')
    value['document_date'] = stamp
    file = value.get('file')
    if not isinstance(file, dict):
        raise HTTPException(422, '檔案格式不正確')
    href = file.get('href', '')
    if not isinstance(href, str):
        raise HTTPException(422, '檔案路徑不正確')
    if not href:
        if value['status'] == 'published':
            raise HTTPException(422, '發布前請先上傳檔案')
        value['file'] = {}
        value['is_demo'] = False
        return value
    sample = seed_file(store, value)
    if sample and old and (sample['id'] == value['id'] or old.get('original_file_href') == href or old.get('file', {}).get('href') == href):
        if value['visibility'] != 'public':
            raise HTTPException(422, '既有公開素材仍有原始公開網址；如需院內文件，請先更換私有儲存區檔案')
        value['file'] = sample['file']
        value['is_demo'] = sample.get('is_demo', False)
        return value
    if not re.fullmatch(r'media/[a-f0-9]{32}\.(pdf|png|jpg)', href):
        raise HTTPException(422, '請選用本站上傳的 PDF、PNG 或 JPEG 檔案')
    identifier = href.split('/')[1]
    metadata = state['files'].get(identifier)
    if not metadata or not (store.directory / identifier).is_file():
        raise HTTPException(422, '檔案不存在，請重新上傳')
    if metadata['unit'] != value['owner_unit_id']:
        raise HTTPException(403, '文件與附件必須屬於同一個單位')
    value['file'] = {'href': href, 'name': metadata.get('name') or identifier,
                     'type': {'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPEG'}[metadata['mime']],
                     'size': metadata.get('size', (store.directory / identifier).stat().st_size)}
    value['is_demo'] = False
    return value


def active_units(state, store):
    return {u['id'] for u in store.collection(state, 'units')
            if u.get('status') == 'active' and u.get('visibility') == 'public'} | {'medresearch'}


def file_usages(state, store, href):
    """References, not copies: uploading alone never publishes a file."""
    result = []
    for kind in ('news', 'documents', 'units', 'people', 'pages'):
        for item in store.collection(state, kind):
            if href not in json.dumps(item, ensure_ascii=False):
                continue
            result.append({'kind': kind, 'id': item['id'], 'title': item.get('title') or item.get('name', ''),
                           'status': item.get('status', 'active'), 'visibility': item.get('visibility', 'public'),
                           'unit': item.get('owner_unit_id', item.get('unit_id', item['id'] if kind == 'units' else 'medresearch'))})
    return result


def validate_file_scope(kind, value, state, store):
    """A shared physical file cannot be both restricted and public."""
    serialized = json.dumps(value, ensure_ascii=False)
    for identifier, metadata in state['files'].items():
        href = f'media/{identifier}'
        if href not in serialized:
            continue
        if kind in {'documents', 'news'} and metadata['unit'] != value.get('owner_unit_id'):
            raise HTTPException(403, '內容與附件必須屬於同一個單位')
        if value.get('status', 'active') not in {'published', 'expired', 'active'}:
            continue
        restricted = value.get('visibility') == 'internal'
        for use in file_usages(state, store, href):
            if (use['kind'], use['id']) == (kind, value['id']) or use['status'] not in {'published', 'expired', 'active'}:
                continue
            if restricted != (use['visibility'] == 'internal'):
                raise HTTPException(422, '此檔案已被不同公開範圍的內容引用；請選用獨立檔案，避免院內資料外流')


def resolve_file(store, state, identifier, internal=False):
    item = next((d for d in store.collection(state, 'documents') if d['id'] == identifier
                 and d.get('status') == 'published' and d.get('visibility') in ({'public', 'internal'} if internal else {'public'})
                 and d.get('owner_unit_id') in active_units(state, store)), None)
    if not item:
        raise HTTPException(404, '文件未發布或不存在')
    href = item.get('file', {}).get('href', '')
    match = re.fullmatch(r'media/([a-f0-9]{32}\.(?:pdf|png|jpg))', href)
    if match:
        meta = state['files'].get(match[1])
        if not meta or meta['unit'] != item['owner_unit_id']:
            raise HTTPException(404)
        path, mime, name = store.directory / match[1], meta['mime'], meta.get('name') or match[1]
    else:
        sample = seed_file(store, item)
        if item['visibility'] != 'public' or not sample:
            raise HTTPException(404)
        path, mime, name = store.source.parent / href, 'application/pdf', sample['file']['name']
    if not path.is_file():
        raise HTTPException(404)
    return item, path, mime, name
