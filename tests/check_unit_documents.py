"""Unit document publication, file reuse, intranet access and summary persistence."""
from dataclasses import replace
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from fastapi.testclient import TestClient
from tests.check_backend import app, settings, sessions, signed_session_cookie
from backend.main import store
from backend.store import Store


def main():
    config=replace(settings,admin_identity_claim='sub',system_admin_ids=('TEST_ROOT',))
    with TemporaryDirectory() as directory, patch.object(store,'directory',Path(directory)), patch('backend.main.settings',config):
        def client(identity):
            c=TestClient(app)
            sid=sessions.create({'name':identity},{'sub':identity})
            c.cookies.set('medresearch_session',signed_session_cookie(sid))
            c.headers['x-csrf-token']=c.get('/api/manage').json().get('csrf','')
            return c
        root=client('TEST_ROOT')
        for identity,role,units in [('UNIT','unit_admin',['ai-center']),('OTHER','unit_admin',['biobank']),('DEPT','site_admin',[])]:
            assert root.put('/api/manage/grants',json=dict(identity=identity,role=role,units=units,active=True,revision=None)).status_code==200
        unit,other,dept,ordinary=map(client,('UNIT','OTHER','DEPT','ORDINARY'))
        anon=TestClient(app)
        def upload(c,route='/api/manage/files'):
            response=c.post(route,content=b'%PDF-1.4\nfixture',headers={'content-type':'application/pdf','x-file-name':'example.pdf'})
            assert response.status_code==200,response.text
            return response.json()['url']
        href=upload(unit)
        assert unit.get('/api/manage/files').json()['items'][0]['unit']=='ai-center'
        assert unit.post('/api/manage/files/biobank',content=b'%PDF-',headers={'content-type':'application/pdf'}).status_code==403
        assert unit.get('/api/manage/files?unit=biobank').status_code==403
        assert len(other.get('/api/manage/files').json()['items'])==9
        assert not other.get('/api/manage/files?include_imported=false').json()['items']
        assert len(dept.get('/api/manage/files').json()['items'])==10
        assert anon.get('/'+href).status_code==401
        def doc(title,href,visibility='public',status='published'):
            return dict(title=title,summary='隔離測試',version='1.0',category='申請表單',visibility=visibility,status=status,file={'href':href},document_date='2020-01-02',owner_unit_id='biobank')
        endpoint='/api/manage/content/documents/unit-doc'
        response=unit.put(endpoint,json={'value':doc('對外文件',href),'revision':None})
        assert response.status_code==200,response.text
        published=response.json()
        assert published['value']['owner_unit_id']=='ai-center'
        assert published['value']['document_date']=='2020-01-02'
        assert anon.get('/api/documents/unit-doc/download').status_code==200
        downloads=root.get('/api/manage/analytics').json()['downloads']
        assert anon.get('/api/documents/unit-doc/download?inline=true').headers['content-disposition'].startswith('inline;')
        assert root.get('/api/manage/analytics').json()['downloads']==downloads
        public_before=anon.get('/data/documents.json').json()
        # A news-only upload never becomes a document, even after publishing the news.
        news_file=upload(unit)
        news={'title':'附件消息','summary':'測試','content':['測試'],'category':'一般公告','visibility':'public','status':'published','attachments':[{'href':news_file,'name':'附件.pdf'}]}
        news_endpoint='/api/manage/content/news/attachment-news'
        assert unit.put(news_endpoint,json={'value':news,'revision':None,'unit':'ai-center'}).status_code==200
        assert anon.get('/data/documents.json').json()==public_before
        # One file can be selected by a document and a message without another upload.
        news['attachments']=[{'href':href,'name':'共用.pdf'}]
        old=next(x for x in unit.get('/api/manage/content/news').json()['items'] if x['value']['id']=='attachment-news')
        assert unit.put(news_endpoint,json={**old,'value':{**old['value'],**news}}).status_code==200
        library=unit.get('/api/manage/files').json()['items']
        assert len(library)==2
        shared=next(f for f in library if f['url']==href)
        assert {u['kind'] for u in shared['usages']}=={'documents','news'}
        assert unit.put(endpoint,json={**published,'value':{**published['value'],'visibility':'internal'}}).status_code==422
        # Internal downloads require a live authenticated session, not a management role.
        private=upload(other,'/api/manage/files/biobank')
        internal_endpoint='/api/manage/content/documents/internal-doc'
        internal=other.put(internal_endpoint,json={'value':doc('院內文件',private,'internal'),'unit':'biobank','revision':None})
        assert internal.status_code==200,internal.text
        assert 'internal-doc' not in anon.get('/data/documents.json').text
        assert anon.get('/api/internal/documents').status_code==401
        assert 'internal-doc' in ordinary.get('/api/internal/documents').text
        downloads=root.get('/api/manage/analytics').json()['downloads']
        for route in ('/'+private,'/api/documents/internal-doc/download','/api/documents/internal-doc/download?inline=true'):
            assert anon.get(route).status_code==401
            assert ordinary.get(route).status_code==200
        assert root.get('/api/manage/analytics').json()['downloads']==downloads
        assert unit.put(internal_endpoint,json=internal.json()).status_code==403
        # Cannot declassify a shared internal upload by publishing public content.
        assert other.put('/api/manage/content/documents/leak',json={'value':doc('不允許',private),'unit':'biobank','revision':None}).status_code==422
        archived=other.put(internal_endpoint,json={**internal.json(),'value':{**internal.json()['value'],'status':'archived'}})
        assert archived.status_code==200
        assert ordinary.get('/api/documents/internal-doc/download').status_code==404
        assert ordinary.get('/'+private).status_code==403
        # Existing summary is retained; editing it preserves the complete introduction.
        entry=next(x for x in unit.get('/api/manage/content/units').json()['items'] if x['value']['id']=='ai-center')
        full=entry['value']['full_description']
        for summary in ('','字'*101):
            assert unit.put('/api/manage/content/units/ai-center',json={**entry,'value':{**entry['value'],'short_description':summary}}).status_code==422
        saved=unit.put('/api/manage/content/units/ai-center',json={**entry,'value':{**entry['value'],'short_description':'測試：新的單位卡片摘要。'}})
        assert saved.status_code==200,saved.text
        assert saved.json()['value']['full_description']==full
        assert other.put('/api/manage/content/units/ai-center',json=saved.json()).status_code==403
        assert next(u for u in anon.get('/data/units.json').json() if u['id']=='ai-center')['short_description']=='測試：新的單位卡片摘要。'
        reloaded=Store(directory,store.source)
        assert next(u for u in reloaded.collection(reloaded.read(),'units') if u['id']=='ai-center')['short_description']=='測試：新的單位卡片摘要。'
        assert len(reloaded.read()['files'])==3
        # No public file is served for an inactive owning unit.
        ai=next(x for x in root.get('/api/manage/content/units').json()['items'] if x['value']['id']=='ai-center')
        assert root.put('/api/manage/content/units/ai-center',json={**ai,'value':{**ai['value'],'status':'inactive'}}).status_code==200
        assert 'unit-doc' not in anon.get('/data/documents.json').text
        assert anon.get('/api/documents/unit-doc/download').status_code==404
    print('PASS unit documents: automatic owner, scopes, file reuse, independent news attachments, public/internal download and preview, archive, immutable full intro and persistent 100-character summary')


if __name__=='__main__':
    main()
