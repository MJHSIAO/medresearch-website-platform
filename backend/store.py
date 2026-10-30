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
            self.directory.mkdir(parents=True, exist_ok=True)
            temporary = self.directory / 'state.tmp'
            with temporary.open('w', encoding='utf-8') as stream:
                json.dump(state, stream, ensure_ascii=False)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.directory / 'state.json')

    def collection(self, state, kind):
        if kind in state['content']:
            return copy.deepcopy(state['content'][kind])
        if kind == 'theme':
            return {'id': 'theme', 'accent': '#125c4b', 'width': '1200'}
        value = json.loads((self.source / f'{kind}.json').read_text(encoding='utf-8-sig'))
        return value
