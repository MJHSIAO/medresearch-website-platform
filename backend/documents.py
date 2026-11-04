"""Validation for managed download records; uploaded file metadata is server-owned."""
import json
import re
from fastapi import HTTPException


def validate_document(value, old, state, store):
    for key, limit in (('title', 160), ('summary', 1000), ('version', 80)):
        text = value.get(key)
        if not isinstance(text, str) or not text.strip() or len(text) > limit:
            raise HTTPException(422, '請填寫標題、說明與版本，並確認文字長度')
        value[key] = text.strip()
    if value.get('category') not in {'作業文件', '申請表單', '檢核清單'}:
        raise HTTPException(422, '請選擇有效的文件類型')
    if value.get('status') not in {'draft', 'published', 'archived'} or value.get('visibility') != 'public':
        raise HTTPException(422, '文件僅支援公開網站的草稿、發布與下架狀態')
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
    # Only the shipped sample attached to the same record may reference static HTML.
    samples = json.loads((store.source / 'documents.json').read_text(encoding='utf-8'))
    sample = next((d for d in samples if d['id'] == value['id']), None)
    if sample and old and href == sample['file']['href']:
        value['file'] = sample['file']
        value['is_demo'] = True
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
