"""First-party daily aggregates; no visitor identifiers or raw request logs."""
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from .management import MANAGERS, profile, visible

LOGGER = logging.getLogger(__name__)
TAIPEI = timezone(timedelta(hours=8))
IDENTIFIER = re.compile(r'[a-zA-Z0-9_-]{1,100}')


def local_now():
    return datetime.now(TAIPEI)


class Analytics:
    """One atomic daily file, using the application's existing single-process lock."""

    def __init__(self, store):
        self.store = store

    @property
    def directory(self):
        return self.store.directory / 'analytics'

    def record(self, target, moment=None):
        moment = moment or local_now()
        day = moment.astimezone(TAIPEI).date().isoformat()
        with self.store.lock:
            self.directory.mkdir(parents=True, exist_ok=True)
            path = self.directory / f'{day}.json'
            data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {
                'date': day, 'started_at': moment.isoformat(), 'entries': {}}
            entry = data['entries'].setdefault(target['key'], {**target, 'count': 0})
            # Titles may change, while identity and owner are determined by the server.
            entry.update(target)
            entry['count'] += 1
            data['updated_at'] = moment.isoformat()
            temporary = path.with_suffix('.tmp')
            with temporary.open('w', encoding='utf-8') as stream:
                json.dump(data, stream, ensure_ascii=False)
                stream.flush()
                os.fsync(stream.fileno())
            # Windows indexers/antivirus may briefly hold the destination open.
            # Keep atomic replacement; never delete or truncate the prior data.
            for attempt in range(5):
                try:
                    os.replace(temporary, path)
                    break
                except PermissionError:
                    if attempt == 4:
                        raise
                    time.sleep(0.025 * 2 ** attempt)

    def report(self, actor, units, days, unit='', moment=None):
        today = (moment or local_now()).astimezone(TAIPEI).date()
        permitted = {u['id'] for u in units}
        if actor['role'] == 'unit_admin':
            permitted &= set(actor['units'])
        else:
            permitted.add('medresearch')
        if unit and unit not in permitted:
            raise HTTPException(403, '沒有此單位的統計權限')
        scope = {unit} if unit else permitted
        daily, totals = [], {}
        first_recorded = None
        with self.store.lock:
            paths = sorted(self.directory.glob('????-??-??.json'))
            for path in paths:
                if path.stem > today.isoformat():
                    continue
                historical = json.loads(path.read_text(encoding='utf-8'))
                if any(entry['unit'] in scope for entry in historical['entries'].values()):
                    first_recorded = path.stem
                    break
            for offset in range(days - 1, -1, -1):
                day = (today - timedelta(days=offset)).isoformat()
                path = self.directory / f'{day}.json'
                data = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'entries': {}}
                row = {'date': day, 'views': 0, 'downloads': 0}
                for entry in data['entries'].values():
                    if entry['unit'] not in scope:
                        continue
                    row['downloads' if entry['kind'] == 'downloads' else 'views'] += entry['count']
                    previous = totals.get(entry['key'], {'count': 0})
                    totals[entry['key']] = {**entry, 'count': previous['count'] + entry['count']}
                daily.append(row)
        for row in daily:
            row['tracked'] = bool(first_recorded and row['date'] >= first_recorded)
        rankings = {kind: sorted((v for v in totals.values() if v['kind'] == kind),
                                key=lambda v: (-v['count'], v['title'], v['key']))[:5]
                    for kind in ('pages', 'news', 'downloads')}
        return {'days': days, 'unit': unit, 'start': daily[0]['date'], 'end': daily[-1]['date'],
                'timezone': 'Asia/Taipei', 'first_recorded': first_recorded,
                'generated_at': (moment or local_now()).isoformat(), 'daily': daily,
                'views': sum(r['views'] for r in daily), 'today': daily[-1]['views'],
                'tracked_days': sum(r['tracked'] for r in daily),
                'downloads': sum(r['downloads'] for r in daily), 'rankings': rankings,
                'units': [u for u in units if u['id'] in permitted] + (
                    [{'id': 'medresearch', 'name': '醫學研究部主站'}] if 'medresearch' in permitted else [])}


def target(key, kind, identifier, title, unit, href):
    return dict(key=key, kind=kind, id=identifier, title=title, unit=unit, href=href)


def public_catalog(store, state, kind):
    units = {u['id'] for u in store.collection(state, 'units') if visible(u, 'units') and u.get('status') == 'active'}
    return [item for item in store.collection(state, kind) if visible(item, kind)
            and item.get('owner_unit_id', 'medresearch') in units | {'medresearch'}]


def page_target(store, state, path, query):
    """Canonical keys ignore arbitrary queries, search terms, and tracking parameters."""
    if path in {'/unit.html', '/unit-about.html'}:
        slug = query.get('unit', 'academic-office')
        item = next((u for u in store.collection(state, 'units')
                     if slug in {u['id'], u.get('slug')} and visible(u, 'units') and u.get('status') == 'active'), None)
        if item:
            page = 'about' if path == '/unit-about.html' else 'home'
            return target(f'unit:{item["id"]}:{page}', 'pages', item['id'],
                          item['name'] + ('｜單位介紹' if page == 'about' else '｜單位首頁'),
                          item['id'], path[1:] + '?' + urlencode({'unit': item['id']}))
        return None
    if path in {'/news-detail.html', '/ai-center/news-detail.html'}:
        item = next((i for i in public_catalog(store, state, 'news') if i['id'] == query.get('id')), None)
        if item:
            return target('news:' + item['id'], 'news', item['id'], item['title'],
                          item.get('owner_unit_id', 'medresearch'), 'news-detail.html?' + urlencode({'id': item['id']}))
        return None
    if path == '/content-page.html':
        identifier = query.get('page', 'research-services')
        item = next((i for i in public_catalog(store, state, 'pages') if i['id'] == identifier), None)
        if item:
            return target('content:' + item['id'], 'pages', item['id'], item['title'],
                          item.get('owner_unit_id', 'medresearch'), 'content-page.html?' + urlencode({'page': item['id']}))
        return None
    fixed = {'/': ('home', '醫學研究部首頁'), '/index.html': ('home', '醫學研究部首頁'),
             '/news.html': ('news-list', '最新消息'), '/units.html': ('units-list', '隸屬單位'),
             '/search.html': ('search', '全站搜尋'), '/contact.html': ('contact', '聯絡我們')}
    if path in fixed:
        identifier, title = fixed[path]
        return target('page:' + identifier, 'pages', identifier, title, 'medresearch',
                      'index.html' if identifier == 'home' else path[1:])
    # The legacy AI landing page is a redirect shell; count only its destination.
    ai_pages = {'about': '中心介紹', 'application': '應用成果', 'contact': '聯絡資訊',
                'news': '最新消息', 'strategy': '發展策略', 'origin': '成立緣起', 'organization': '組織架構'}
    for identifier, title in ai_pages.items():
        if path == f'/ai-center/{identifier}.html' and any(
                u['id'] == 'ai-center' and visible(u, 'units') and u.get('status') == 'active' for u in store.collection(state, 'units')):
            return target('ai:' + identifier, 'pages', 'ai-' + identifier,
                          '人工智慧中心｜' + title, 'ai-center', path[1:])
    return None


def document_file(store, state, identifier):
    item = next((i for i in public_catalog(store, state, 'documents') if i['id'] == identifier), None)
    if not item:
        raise HTTPException(404, '文件未公開或不存在')
    href = item.get('file', {}).get('href', '')
    media = re.fullmatch(r'media/([a-f0-9]{32}\.(?:pdf|png|jpg))', href)
    if media:
        metadata = state['files'].get(media[1])
        if not metadata or metadata['unit'] != item['owner_unit_id']:
            raise HTTPException(404)
        path, mime = store.directory / media[1], metadata['mime']
        name = metadata.get('name') or media[1]
    else:
        # Only an exact shipped sample for this same document may use static HTML.
        samples = json.loads((store.source / 'documents.json').read_text(encoding='utf-8-sig'))
        sample = next((s for s in samples if s['id'] == identifier and s.get('file', {}).get('href') == href), None)
        if not sample or not re.fullmatch(r'assets/documents/demo/[a-z-]+\.html', href):
            raise HTTPException(404)
        path, mime, name = store.source.parent / href, 'text/html', href.rsplit('/', 1)[-1]
    if not path.is_file():
        raise HTTPException(404)
    return item, path, mime, name


def install(app, runtime, store, context):
    analytics = Analytics(store)

    @app.get('/api/manage/analytics')
    async def statistics(request: Request, days: int = 30, unit: str = ''):
        state = store.read()
        actor, _ = context(request, state)
        if days not in {7, 30}:
            raise HTTPException(422, '統計期間只支援 7 或 30 天')
        try:
            return await run_in_threadpool(analytics.report, actor, store.collection(state, 'units'), days, unit)
        except (OSError, ValueError, KeyError, TypeError):
            LOGGER.error('Analytics report unavailable')
            raise HTTPException(503, '統計資料暫時無法讀取，請稍後再試') from None

    @app.get('/api/documents/{identifier}/download')
    async def download_document(identifier: str):
        if not IDENTIFIER.fullmatch(identifier):
            raise HTTPException(404)
        _, path, mime, name = document_file(store, store.read(), identifier)
        return FileResponse(path, media_type=mime, filename=name,
                            headers={'Cache-Control': 'no-store', 'Content-Security-Policy': "sandbox; default-src 'none'"})

    def count(request, path, query):
        with store.lock:
            state = store.read()
            record = runtime.sessions.get(request.session.get('session_id'))
            if record and profile(record['claims'], runtime.settings, state)['role'] in MANAGERS:
                return
            match = re.fullmatch(r'/api/documents/([a-zA-Z0-9_-]{1,100})/download', path)
            if match:
                item, _, _, _ = document_file(store, state, match[1])
                title = item['title'] + ('（示意文件）' if item.get('is_demo') else '')
                entry = target('download:' + item['id'], 'downloads', item['id'], title,
                               item['owner_unit_id'], 'content-page.html?page=downloads')
            else:
                entry = page_target(store, state, path, query)
            if entry:
                analytics.record(entry)

    @app.middleware('http')
    async def count_successful_public_requests(request: Request, call_next):
        # Capture before StaticFiles changes root_path/scope.
        path = request.url.path
        prefix = request.scope.get('root_path', '').rstrip('/')
        if prefix and path.startswith(prefix + '/'):
            path = path[len(prefix):]
        query = {key: request.query_params.getlist(key)[0] for key in request.query_params}
        response = await call_next(request)
        download = bool(re.fullmatch(r'/api/documents/[a-zA-Z0-9_-]{1,100}/download', path))
        html = response.headers.get('content-type', '').startswith('text/html')
        purpose = ' '.join(request.headers.get(k, '') for k in ('purpose', 'sec-purpose', 'x-purpose')).lower()
        agent = request.headers.get('user-agent', '').lower()
        excluded = ('prefetch' in purpose or 'prerender' in purpose or
                    request.headers.get('sec-fetch-dest') in {'iframe', 'image', 'empty'} or
                    any(bot in agent for bot in ('bot', 'crawler', 'spider', 'headless', 'preview', 'slurp')))
        cached_html = response.status_code == 304 and path.endswith('.html')
        if request.method == 'GET' and response.status_code in {200, 304} and (html or download or cached_html) and not excluded:
            try:
                await run_in_threadpool(count, request, path, query)
            except (OSError, ValueError, KeyError, TypeError, HTTPException):
                # A statistics failure must never take down the public website.
                LOGGER.error('Analytics event could not be saved')
        return response

    return analytics
