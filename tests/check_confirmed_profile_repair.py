"""Only approved live fingerprints can be reclassified; no seed content is read."""
import copy
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from backend.profile_sections import CONFIRMED_COMBINED_SHA256,split_confirmed_live_profile
from backend.store import Store

def main():
    assert len(CONFIRMED_COMBINED_SHA256)==3
    assert all(len(value)==64 for value in CONFIRMED_COMBINED_SHA256.values())
    texts={
        'person-medresearch-chang':'2025 新增證照\n2024 學術獎',
        'person-medresearch-chen':'2026 Travel Grant\n2024 Paper Award',
        'person-medresearch-liao':'2026 新增榮譽\n'+'*'*108+'\nPatent\n1. Patent No. LIVE-ONE\nCurrent patent text\n\n2. Patent No. LIVE-TWO',
    }
    fingerprints={key:hashlib.sha256(value.encode('utf-8')).hexdigest() for key,value in texts.items()}
    def profile(text):return {'enabled':True,'sections_version':1,'introduction':text,'achievements':text,'honors':'','patents':'','author_names':['Existing Author'],'links':[{'label':'Existing link','href':'https://example.test/profile'}],'positions':'既有現職'}
    with patch.dict(CONFIRMED_COMBINED_SHA256,fingerprints,clear=True):
        for identifier,text in texts.items():
            original=profile(text);saved=copy.deepcopy(original)
            result=split_confirmed_live_profile(identifier,original)
            assert original==saved and result['introduction']=='' and result['achievements']==text
            assert result['positions']==original['positions'] and result['author_names']==original['author_names']
            assert result['links']==original['links']
            assert split_confirmed_live_profile(identifier,result)==result
            if identifier.endswith('liao'):
                assert result['honors']+'\n'+'*'*108+'\n'+result['patents']==text
            else:assert result['honors']==text and result['patents']==''
            protected=[{**original,'honors':'後續自訂榮譽'},{**original,'patents':'後續自訂專利'},{**original,'introduction':text+'\n新介紹'},{**original,'achievements':text+'\n上線後再次更新'}]
            for item in protected:assert split_confirmed_live_profile(identifier,item)==item
            assert split_confirmed_live_profile('unrelated-member',original)==original
        assert split_confirmed_live_profile('person-medresearch-liao',None) is None
        with TemporaryDirectory() as directory:
            # Deliberately absent seed directory: this repair must use runtime content only.
            store=Store(directory,Path(directory)/'no-demo-seeds')
            with store.transaction() as state:
                state['grants']={'TEST-ADMIN':{'role':'unit_admin','units':['medresearch'],'active':True}}
                state['content']['people']=[{'id':identifier,'unit_id':'medresearch','name':'測試成員','updated_at':'2026-01-01T00:00:00Z','profile':profile(text)} for identifier,text in texts.items()]
                state['content']['people'].append({'id':'foreign-member','unit_id':'ai-center','profile':profile(next(iter(texts.values())))})
                state['content']['publications']=[{'id':'unchanged-research','citation':'既有成果'}]
                state['audit']=[{'action':'既有紀錄'}];state['files']={'existing-file':{'unit':'medresearch'}}
            before=store.read();raw=(Path(directory)/'state.json').read_bytes()
            store.repair_confirmed_live_profile_sections();after=store.read()
            backup=Path(directory)/'state.before-confirmed-live-profile-sections-2026-11-25.json'
            assert backup.read_bytes()==raw
            assert after['grants']==before['grants'] and after['audit']==before['audit'] and after['files']==before['files']
            assert after['content']['publications']==before['content']['publications']
            assert [p['id'] for p in after['content']['people']]==[p['id'] for p in before['content']['people']]
            assert after['content']['people'][-1]==before['content']['people'][-1]
            for original in before['content']['people'][:3]:
                assert any(h['value']==original and h['kind']=='people' for h in after['history'])
            assert len(after['history'])==6
            store.repair_confirmed_live_profile_sections();assert store.read()==after and backup.read_bytes()==raw
            # Even without a release marker, already-correct records are left untouched.
            with store.transaction() as state:state['migrations']=[]
            correct=store.read();store.repair_confirmed_live_profile_sections()
            assert store.read()['content']==correct['content'] and store.read()['history']==correct['history']
    print('PASS exact approved live fingerprints, lossless split, newer edits protected, no seeds, complete backup/history, permissions and unrelated content unchanged, idempotence')

if __name__=='__main__':main()
