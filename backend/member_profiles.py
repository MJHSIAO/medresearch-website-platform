"""Member profiles and independently saved, paginated publication records."""
import copy
import re
import secrets
from urllib.parse import urlsplit
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

PROFILE_LIMITS = {'english_name':200,'introduction':20000,'positions':10000,'education':10000,
                  'experience':10000,'research_fields':10000,'achievements':20000,
                  'email':200,'phone':100,'photo_href':2048,'doctor_href':2048}

def web_url(value):
    if not isinstance(value,str) or len(value)>2048 or any(c in value for c in '\\<>\r\n\t\"\'') or value!=value.strip():
        return False
    try:
        parsed=urlsplit(value)
        return parsed.scheme in {'http','https'} and bool(parsed.hostname) and not parsed.username
    except ValueError:return False

def validate_profile(value, state, store):
    profile=value.get('profile')
    if profile is None:return
    if not isinstance(profile,dict) or type(profile.get('enabled',False)) is not bool:
        raise HTTPException(422,'個人介紹格式不正確')
    for key,limit in PROFILE_LIMITS.items():
        if not isinstance(profile.get(key,''),str) or len(profile.get(key,''))>limit:
            raise HTTPException(422,f'個人介紹 {key} 最多 {limit} 字')
    if profile.get('doctor_href') and not web_url(profile['doctor_href']):
        raise HTTPException(422,'院方醫師介紹只接受完整 HTTP／HTTPS 網址')
    photo=profile.get('photo_href','')
    if photo:
        if photo.startswith('media/'):
            metadata=state['files'].get(photo[6:])
            if not metadata or metadata['unit']!=value['unit_id'] or metadata['mime'] not in {'image/png','image/jpeg'} or not (store.directory/photo[6:]).is_file():
                raise HTTPException(403,'照片必須使用同單位的 PNG 或 JPEG 檔案')
        else:
            import json
            seed=next((p for p in json.loads((store.source/'people.json').read_text(encoding='utf-8-sig')) if p['id']==value['id']),{})
            if photo!=seed.get('profile',{}).get('photo_href') or not (store.source.parent/photo).is_file():
                raise HTTPException(422,'照片請使用本人成員的既有照片或同單位上傳檔案')
    links=profile.get('links',[])
    if not isinstance(links,list) or len(links)>20:
        raise HTTPException(422,'外部連結最多 20 筆')
    for link in links:
        if not isinstance(link,dict) or not isinstance(link.get('label'),str) or not 1<=len(link['label'].strip())<=100 or not web_url(link.get('href')):
            raise HTTPException(422,'外部連結須有 100 字內名稱及有效網址')

def public_member(store,state,identifier):
    person=next((p for p in store.collection(state,'people') if p['id']==identifier),None)
    unit=next((u for u in store.collection(state,'units') if person and u['id']==person.get('unit_id')),None)
    if not person or person.get('visibility') not in {'public','both'} or person.get('status','active') not in {'active','published','expired'} or not unit or unit.get('visibility') not in {'public','both'} or unit.get('status')!='active' or not person.get('profile',{}).get('enabled'):
        raise HTTPException(404,'找不到公開的成員介紹')
    return person,unit

def publication_value(value,person_id,identifier):
    if not isinstance(value,dict):raise HTTPException(422,'論文格式不正確')
    citation=value.get('citation','')
    if not isinstance(citation,str) or not 1<=len(citation.strip())<=5000:
        raise HTTPException(422,'每筆論文內容請填寫 1–5000 字')
    year=value.get('year','')
    if year is None:year=''
    if not isinstance(year,str) or (year and not re.fullmatch(r'(18|19|20)\d{2}|2100',year)):
        raise HTTPException(422,'年份請填寫 1800–2100，或留空')
    category=value.get('category','期刊論文')
    if not isinstance(category,str) or not 1<=len(category.strip())<=80:raise HTTPException(422,'成果類型最多 80 字')
    href=value.get('href','')
    if href and not web_url(href):raise HTTPException(422,'論文連結須為完整 HTTP／HTTPS 網址')
    if not isinstance(href,str):raise HTTPException(422,'論文連結格式不正確')
    return {'id':identifier,'person_id':person_id,'citation':citation.strip(),'year':year,'category':category.strip(),'href':href}

def install(app,runtime,store,context,body):
    from .management import allowed,revision,audit,now
    def person_scope(request,state,identifier,write=False):
        actor,record=context(request,state,write=write)
        person=next((p for p in store.collection(state,'people') if p['id']==identifier),None)
        if not person:raise HTTPException(404,'成員不存在')
        if not allowed(actor,'people',person):raise HTTPException(403,'未獲授權的成員')
        return actor,person
    def page_result(state,identifier,page,year,q,limit=20):
        all_items=[p for p in store.collection(state,'publications') if p['person_id']==identifier]
        years=sorted({p['year'] for p in all_items if p.get('year')},reverse=True)
        selected=[p for p in all_items if (not year or p.get('year')==year) and q.casefold() in p['citation'].casefold()]
        pages=max(1,(len(selected)+limit-1)//limit);page=min(max(page,1),pages)
        return {'items':selected[(page-1)*limit:page*limit],'total':len(selected),'all_total':len(all_items),'page':page,'pages':pages,'years':years}
    @app.get('/api/people/{identifier}')
    async def public_profile(identifier:str):
        state=store.read();person,unit=public_member(store,state,identifier)
        safe={k:copy.deepcopy(v) for k,v in person.items() if not k.startswith('profile_source') and k not in {'account_identity','created_by','updated_by','profile_import_note','source_url','source_updated_at','source_checked_at'}}
        return JSONResponse({'person':safe,'unit':{'id':unit['id'],'name':unit['name'],'href':unit.get('site_about_href') or 'unit.html?unit='+unit['id']}},headers={'Cache-Control':'no-store'})
    @app.get('/api/people/{identifier}/publications')
    async def public_publications(identifier:str,page:int=1,year:str='',q:str=''):
        state=store.read();public_member(store,state,identifier)
        return JSONResponse(page_result(state,identifier,page,year,q[:200]),headers={'Cache-Control':'no-store'})
    @app.get('/api/manage/people/{identifier}/publications')
    async def management_publications(identifier:str,request:Request,page:int=1,year:str='',q:str=''):
        state=store.read();person_scope(request,state,identifier)
        data=page_result(state,identifier,page,year,q[:200])
        data['items']=[{'value':p,'revision':revision(p)} for p in data['items']]
        return data
    @app.post('/api/manage/people/{identifier}/publications')
    async def add_publications(identifier:str,request:Request):
        payload=await body(request);incoming=payload.get('items',[])
        if not isinstance(incoming,list) or not 1<=len(incoming)<=50:raise HTTPException(422,'每批請新增 1–50 筆')
        with store.transaction() as state:
            actor,person=person_scope(request,state,identifier,True)
            items=store.collection(state,'publications')
            if sum(p['person_id']==identifier for p in items)+len(incoming)>2000:raise HTTPException(422,'每位成員最多 2000 筆成果')
            added=[]
            for value in incoming:
                item=publication_value(value,identifier,'pub-'+secrets.token_hex(16));item['updated_at']=now();added.append(item)
            state['content']['publications']=items+added
            state['history'].extend({'version':secrets.token_hex(12),'kind':'publications','id':p['id'],'value':copy.deepcopy(p),'time':now()} for p in added)
            audit(state,actor,'新增論文成果','people',identifier,person['unit_id'])
        return {'added':len(added)}
    @app.api_route('/api/manage/people/{identifier}/publications/{publication_id}',methods=['PUT','DELETE'])
    async def change_publication(identifier:str,publication_id:str,request:Request):
        payload=await body(request)
        with store.transaction() as state:
            actor,person=person_scope(request,state,identifier,True);items=store.collection(state,'publications')
            old=next((p for p in items if p['id']==publication_id and p['person_id']==identifier),None)
            if not old:raise HTTPException(404,'論文不存在')
            if payload.get('revision')!=revision(old):raise HTTPException(409,'論文已更新，請重新載入')
            value=None if request.method=='DELETE' else {**old,**publication_value(payload.get('value'),identifier,publication_id),'updated_at':now()}
            if not any(h['kind']=='publications' and h['id']==publication_id and h['value']==old for h in state['history']):
                state['history'].append({'version':secrets.token_hex(12),'kind':'publications','id':publication_id,'value':copy.deepcopy(old),'time':old.get('updated_at',now())})
            if value:state['history'].append({'version':secrets.token_hex(12),'kind':'publications','id':publication_id,'value':copy.deepcopy(value),'time':now()})
            state['content']['publications']=[value if p['id']==publication_id else p for p in items if value is not None or p['id']!=publication_id]
            audit(state,actor,'刪除論文成果' if value is None else '編輯論文成果','people',identifier,person['unit_id'])
        return {'ok':True}
