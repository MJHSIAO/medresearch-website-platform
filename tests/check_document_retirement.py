"""Remove sample records while preserving uploaded replacements and unrelated state."""
import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from backend.store import Store


def main():
    seeds=json.loads(Path('data/documents.json').read_text(encoding='utf-8-sig'))
    assert len(seeds)==9 and not any(d.get('is_demo') for d in seeds)
    assert not list(Path('assets/documents/demo').glob('*.html'))
    with TemporaryDirectory() as directory:
        store=Store(directory,'data')
        store.retire_demo_documents()
        assert not (Path(directory)/'state.json').exists()
        state=store.read()
        placeholders=[{'id':identifier,'is_demo':True,'file':{'href':f'assets/documents/demo/{identifier}.html'}}
                      for identifier in ['research-guide','research-form','lab-form','trial-checklist','animal-guide','biosafety-form']]
        replacement={'id':'research-form','is_demo':False,'file':{'href':'media/'+'a'*32+'.pdf'},'title':'保留核定文件'}
        state['content']['documents']=copy.deepcopy(seeds)+placeholders+[replacement]
        state['history']=[{'id':'research-form','value':copy.deepcopy(placeholders[1])}]
        state['audit']=[{'action':'keep'}];state['files']={'a'*32+'.pdf':{'unit':'ai-center'}}
        state['grants']={'keep':{'active':True}};state['content']['units']=[{'id':'untouched'}]
        before=copy.deepcopy(state);store._write(state)
        snapshot=(Path(directory)/'state.json').read_bytes()
        store.retire_demo_documents();after=store.read()
        assert (Path(directory)/'state.before-retire-demo-documents-2026-11-18.json').read_bytes()==snapshot
        assert after['content']['documents']==seeds+[replacement]
        for key in ['history','audit','files','grants']:
            assert after[key]==before[key]
        assert after['content']['units']==before['content']['units']
        store.retire_demo_documents();assert store.read()==after
    print('PASS document retirement: nine real documents, removed sample files/records, backup, preserved real replacements/history/files/grants, idempotence')


if __name__=='__main__':
    main()
