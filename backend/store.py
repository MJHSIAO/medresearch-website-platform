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

    def upgrade_biobank_documents(self):
        """One-time additive import; retain custom records and all legacy PDF URLs."""
        release = 'biobank-documents-2026-11-18'
        path = self.directory / 'state.json'
        if not path.exists():
            return
        with self.lock:
            state = self.read()
            if release in state.get('migrations', []):
                return
            seeds = json.loads((self.source / 'documents.json').read_text(encoding='utf-8-sig'))
            imported = [d for d in seeds if d.get('owner_unit_id') == 'biobank' and d.get('original_file_href')]
            units = state['content'].get('units', [])
            unit = next((u for u in units if u['id'] == 'biobank'), None)
            section = next((s for s in (unit or {}).get('special_sections', []) if s['id'] == 'biobank-forms'), None)
            links = {link.get('href'): link for link in (section or {}).get('links', [])}
            current = state['content'].get('documents')
            if current is None:
                ids = {d['id'] for d in imported}
                current = copy.deepcopy([d for d in seeds if d['id'] not in ids])
                state['content']['documents'] = current
            if current is not None:
                for seed in imported:
                    if any(d['id'] == seed['id'] or (d.get('owner_unit_id') == 'biobank' and d.get('file', {}).get('href') == seed['file']['href']) for d in current):
                        continue
                    value = copy.deepcopy(seed)
                    legacy = links.get(seed['file']['href'], {})
                    if legacy.get('label'):
                        value['title'] = legacy['label']
                    if legacy.get('note'):
                        value['summary'] = legacy['note']
                        value['source_note'] = legacy['note']
                    current.append(value)
            if section:
                paths = {d['original_file_href'] for d in imported}
                section['links'] = [link for link in section.get('links', []) if link.get('href') not in paths]
                if not any(link.get('href') == '#unit-documents' for link in section['links']):
                    section['links'].append({'label': '前往文件下載', 'href': '#unit-documents', 'note': '辦法及表單統一由文件管理維護。'})
                previous = '提供原官網九份公開 PDF 的本機副本。來源查核：2026-11-18；文件內版次與原站檔名日期可能不同，申請前請洽本庫核對適用版本。'
                if section.get('intro') == previous:
                    section['intro'] = '本庫辦法及申請表單統一於「文件下載」查閱；適用版本及原站名稱差異請詳閱各文件說明。'
            if unit:
                for link in unit.get('resource_links', []):
                    if link.get('href') == '#biobank-forms' and link.get('note') == '九份公開 PDF 與版本說明':
                        link['note'] = '統一文件下載入口與版本說明'
                for module in unit.get('special_sections', []):
                    for link in module.get('links', []):
                        if link.get('href') == '#biobank-forms' and link.get('note') == '查看本頁九份原站文件與版本提醒。':
                            link['note'] = '由統一文件下載區查閱辦法、表單及版本提醒。'
            backup = self.directory / f'state.before-{release}.json'
            if not backup.exists():
                backup.write_bytes(path.read_bytes())
            state.setdefault('migrations', []).append(release)
            self._write(state)

    def retire_demo_documents(self):
        """Retire placeholders once, preserving real replacements and audit history."""
        release = 'retire-demo-documents-2026-11-18'
        path = self.directory / 'state.json'
        if not path.exists():
            return
        with self.lock:
            state = self.read()
            if release in state.get('migrations', []):
                return
            current = state['content'].get('documents')
            if current is not None:
                state['content']['documents'] = [d for d in current if not (
                    d.get('is_demo') is True or d.get('file', {}).get('href', '').startswith('assets/documents/demo/'))]
            backup = self.directory / f'state.before-{release}.json'
            if not backup.exists():
                backup.write_bytes(path.read_bytes())
            state.setdefault('migrations', []).append(release)
            self._write(state)

    def upgrade_department(self):
        """Append the newly supported parent unit/people once, never overwrite edits."""
        release = 'department-members-2026-11-23'
        path = self.directory / 'state.json'
        if not path.exists():
            return
        with self.lock:
            state = self.read()
            if release in state.get('migrations', []):
                return
            if 'pages' in state['content']:
                page = next((p for p in state['content']['pages'] if p['id']=='department-about'), None)
                current_units = self.collection(state, 'units')
                if page and not any(u['id']=='medresearch' for u in state['content'].get('units', [])):
                    current_units = [u for u in current_units if u['id']!='medresearch']
                    seed = next(u for u in json.loads((self.source/'units.json').read_text(encoding='utf-8-sig')) if u['id']=='medresearch')
                    if isinstance(page.get('summary'), str) and 1 <= len(page['summary'].strip()) <= 100:
                        seed['short_description'] = page['summary']
                    for section in page.get('sections', []):
                        if section.get('title')=='本部簡介': seed['full_description']=section['content']
                        if section.get('title')=='本部執掌': seed['purpose']=section['content']
                        if section.get('title')=='發展目標': seed['goals']=[section['content']]
                    state['content']['units'] = current_units + [seed]
            for kind in ('units', 'people'):
                if kind not in state['content']:
                    continue
                seeds = json.loads((self.source / f'{kind}.json').read_text(encoding='utf-8-sig'))
                existing = {v['id'] for v in state['content'][kind]}
                state['content'][kind].extend(v for v in seeds if v['id'] not in existing and
                                            (v['id']=='medresearch' if kind=='units' else v.get('unit_id')=='medresearch'))
            backup = self.directory / f'state.before-{release}.json'
            if not backup.exists():
                backup.write_bytes(path.read_bytes())
            state.setdefault('migrations', []).append(release)
            self._write(state)

    def upgrade_member_profiles(self):
        """Add profile fields to existing members, preserving edits and deleted members."""
        release='member-profiles-2026-11-23'
        path=self.directory/'state.json'
        if not path.exists():return
        with self.lock:
            state=self.read()
            if release in state.get('migrations',[]):return
            seeds=json.loads((self.source/'people.json').read_text(encoding='utf-8-sig'))
            by_id={p['id']:p for p in seeds if p.get('profile',{}).get('enabled')}
            if 'people' in state['content']:
                for person in state['content']['people']:
                    seed=by_id.get(person['id'])
                    if not seed:continue
                    for key in ('profile','profile_source_url','profile_source_updated_at','profile_source_checked_at','profile_import_note'):
                        if key not in person and key in seed:person[key]=copy.deepcopy(seed[key])
            if 'publications' in state['content']:
                present={p['id'] for p in state['content']['publications']}
                people={p['id'] for p in self.collection(state,'people')}
                incoming=json.loads((self.source/'publications.json').read_text(encoding='utf-8-sig'))
                state['content']['publications'].extend(p for p in incoming if p['id'] not in present and p['person_id'] in people)
            backup=self.directory/f'state.before-{release}.json'
            if not backup.exists():backup.write_bytes(path.read_bytes())
            state.setdefault('migrations',[]).append(release)
            self._write(state)

    def upgrade_profile_sections(self):
        from .profile_sections import split_profile
        release='profile-sections-2026-11-25'
        path=self.directory/'state.json'
        if not path.exists():return
        with self.lock:
            state=self.read()
            if release in state.get('migrations',[]):return
            seeds={p['id']:p.get('profile',{}) for p in json.loads((self.source/'people.json').read_text(encoding='utf-8-sig'))}
            for person in state['content'].get('people',[]):
                if isinstance(person.get('profile'),dict):
                    person['profile']=split_profile(person['profile'],seeds.get(person['id']))
            backup=self.directory/f'state.before-{release}.json'
            if not backup.exists():backup.write_bytes(path.read_bytes())
            state.setdefault('migrations',[]).append(release)
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
