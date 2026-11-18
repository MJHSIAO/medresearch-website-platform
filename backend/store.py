"""Single-process transactional JSON store. Runtime data is never publicly mounted."""
import copy
import json
import os
import threading
from pathlib import Path
from contextlib import contextmanager


class Store:
    def __init__(self, directory, source):
        self.directory = Path(directory)
        self.source = Path(source)
        self.lock = threading.RLock()

    def read(self):
        path = self.directory / 'state.json'
        if path.exists():
            return json.loads(path.read_text(encoding='utf-8'))
        return {'grants': {}, 'content': {}, 'history': [], 'audit': [], 'files': {}}

    @contextmanager
    def transaction(self):
        with self.lock:
            state = self.read()
            yield state
            self._write(state)

    def _write(self, state):
        self.directory.mkdir(parents=True, exist_ok=True)
        temporary = self.directory / 'state.tmp'
        with temporary.open('w', encoding='utf-8') as stream:
            json.dump(state, stream, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, self.directory / 'state.json')

    def upgrade_resource_content(self):
        from .resources import RELEASE, merge_collection
        # Fresh installations use the new public seeds without creating state.
        path = self.directory / 'state.json'
        if not path.exists():
            return
        with self.lock:
            state = self.read()
            if RELEASE in state.get('migrations', []):
                return
            baseline = json.loads((Path(__file__).parent / 'resource_baseline.json').read_text(encoding='utf-8'))
            for kind, previous in baseline.items():
                current = state['content'].get(kind)
                if current is None:
                    continue
                updated = json.loads((self.source / f'{kind}.json').read_text(encoding='utf-8-sig'))
                state['content'][kind] = merge_collection(current, previous, updated)
            backup = self.directory / f'state.before-{RELEASE}.json'
            # Never overwrite the original pre-upgrade backup on subsequent starts.
            if not backup.exists():
                backup.write_bytes(path.read_bytes())
            state.setdefault('migrations', []).append(RELEASE)
            self._write(state)

    def upgrade_biobank_content(self):
        """Add this release's new unit records without replacing managed content."""
        release = 'biobank-2026-11-18'
        path = self.directory / 'state.json'
        if not path.exists():
            return
        with self.lock:
            state = self.read()
            if release in state.get('migrations', []):
                return
            for kind in ('units', 'people', 'news'):
                current = state['content'].get(kind)
                if current is None:
                    continue
                seeds = json.loads((self.source / f'{kind}.json').read_text(encoding='utf-8-sig'))
                existing = {item['id'] for item in current}
                for item in seeds:
                    belongs = (item['id'] == 'biobank' if kind == 'units' else
                               item.get('unit_id' if kind == 'people' else 'owner_unit_id') == 'biobank')
                    if belongs and item['id'] not in existing:
                        current.append(item)
            # Add the department's new entry point while retaining edited cards.
            pages = state['content'].get('pages')
            if pages is not None:
                page = next((item for item in pages if item['id'] == 'department-about'), None)
                seeds = json.loads((self.source / 'pages.json').read_text(encoding='utf-8-sig'))
                seed = next(item for item in seeds if item['id'] == 'department-about')
                if page:
                    previous_summary = seed['summary'].replace('整合各隸屬單位的', '下設七個隸屬單位，整合')
                    if page.get('summary') == previous_summary:
                        page['summary'] = seed['summary']
                    section = next(item for item in seed['sections'] if item['title'] == '隸屬單位')
                    previous_list = section['content'].replace('、創新智財產學中心及人體生物資料庫', '及創新智財產學中心')
                    for item in page.get('sections', []):
                        if item.get('title') == '隸屬單位' and item.get('content') == previous_list:
                            item['content'] = section['content']
                    for group in page.get('groups', []):
                        if group.get('title') in {'七個隸屬單位', '隸屬單位'}:
                            group['title'] = '隸屬單位'
                            href = 'unit.html?unit=biobank'
                            if not any(action.get('href') == href for card in group.get('cards', []) for action in card.get('actions', [])):
                                seed_group = next(item for item in seed['groups'] if item['title'] == '隸屬單位')
                                group['cards'].append(copy.deepcopy(next(card for card in seed_group['cards'] if any(a['href'] == href for a in card['actions']))))
            backup = self.directory / f'state.before-{release}.json'
            if not backup.exists():
                backup.write_bytes(path.read_bytes())
            state.setdefault('migrations', []).append(release)
            self._write(state)

    def collection(self, state, kind):
        if kind in state['content']:
            return copy.deepcopy(state['content'][kind])
        if kind == 'theme':
            return {'id': 'theme', 'accent': '#125c4b', 'width': '1200'}
        if kind == 'announcements':
            notice = self.collection(state, 'site').get('notice', '')
            return [{'id': 'site-notice', 'text': notice, 'href': '', 'active': True}] if notice else []
        value = json.loads((self.source / f'{kind}.json').read_text(encoding='utf-8-sig'))
        return value
