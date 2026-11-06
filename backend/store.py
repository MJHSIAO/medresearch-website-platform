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
