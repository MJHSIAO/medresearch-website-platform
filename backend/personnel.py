"""Persistent member order and scoped removal of members/authorizations."""
import copy
import secrets
from fastapi import HTTPException, Request


def ordered_people(people):
    groups = {}
    for person in people:
        groups.setdefault(person.get('unit_id', ''), []).append(person)
    result = []
    for group in groups.values():
        result.extend(person for _, person in sorted(enumerate(group), key=lambda pair: (
            pair[1].get('display_order') if type(pair[1].get('display_order')) is int else pair[0], pair[0])))
    return result


def sync_members(state, store, unit_id):
    people = ordered_people(store.collection(state, 'people'))
    units = store.collection(state, 'units')
    for unit in units:
        if unit['id'] == unit_id:
            unit['members'] = [f"{p.get('title', '')} {p['name']}".strip() for p in people
                               if p.get('unit_id') == unit_id and p.get('visibility') in {'public', 'both'}
                               and p.get('status', 'active') in {'active', 'published', 'expired'}]
    state['content']['units'] = units


def validate_person(value, old, actor, state, store, bootstrap):
    identity = value.get('account_identity', '')
    if not isinstance(identity, str) or len(identity) > 160 or identity != identity.strip():
        raise HTTPException(422, '關聯帳號格式不正確')
    previous = (old or {}).get('account_identity', '')
    if actor['role'] == 'unit_admin' and identity != previous:
        raise HTTPException(403, '成員與帳號關聯須由總管理員設定')
    if identity:
        grant = state['grants'].get(identity)
        if identity not in bootstrap and (not grant or (grant['role'] == 'unit_admin' and value['unit_id'] not in grant['units'])):
            raise HTTPException(422, '關聯帳號沒有此單位的管理授權，請先設定人員權限')
        if any(p['id'] != value['id'] and p.get('unit_id') == value['unit_id'] and p.get('account_identity') == identity
               for p in store.collection(state, 'people')):
            raise HTTPException(422, '此帳號已關聯同單位的另一筆成員，請勿重複建立')
    if 'display_order' in value and (type(value['display_order']) is not int or value['display_order'] < 0):
        raise HTTPException(422, '成員排序必須是非負整數')
    if 'display_order' not in value:
        own = [p for p in store.collection(state, 'people') if p.get('unit_id') == value['unit_id']]
        value['display_order'] = (next((i for i, p in enumerate(ordered_people(own)) if p['id'] == value['id']), len(own)) if old else
                                  max((p['display_order'] if type(p.get('display_order')) is int else i for i, p in enumerate(own)), default=-1) + 1)


def clear_links(state, store, identity, units=None):
    people = store.collection(state, 'people')
    changed = False
    for person in people:
        if person.get('account_identity') == identity and (units is None or person.get('unit_id') in units):
            person['account_identity'] = ''
            changed = True
    if changed:
        state['content']['people'] = people


def install(app, runtime, store, context, body):
    from .management import allowed, revision, audit, now

    def unit_scope(state, actor, unit_id):
        unit = next((u for u in store.collection(state, 'units') if u['id'] == unit_id), None)
        if not unit or not allowed(actor, 'units', unit):
            raise HTTPException(403, '未獲授權的單位')
        return unit

    def own_people(state, unit_id):
        return ordered_people([p for p in store.collection(state, 'people') if p.get('unit_id') == unit_id])

    def order_result(state, unit_id):
        people = own_people(state, unit_id)
        return {'items': [{'value': p, 'revision': revision(p)} for p in people], 'revision': revision(people)}

    def remember(state, value):
        state['history'].append({'version': secrets.token_hex(12), 'kind': 'people', 'id': value['id'],
                                 'value': copy.deepcopy(value), 'time': now()})

    @app.get('/api/manage/people/order/{unit_id}')
    async def get_order(unit_id: str, request: Request):
        state = store.read()
        actor, _ = context(request, state)
        unit_scope(state, actor, unit_id)
        return order_result(state, unit_id)

    @app.put('/api/manage/people/order/{unit_id}')
    async def set_order(unit_id: str, request: Request):
        payload = await body(request)
        with store.transaction() as state:
            actor, _ = context(request, state, write=True)
            unit_scope(state, actor, unit_id)
            people = own_people(state, unit_id)
            ids = payload.get('ids')
            if not isinstance(ids, list) or any(not isinstance(i, str) for i in ids) or len(set(ids)) != len(ids) or set(ids) != {p['id'] for p in people}:
                raise HTTPException(422, '排序必須包含該單位全部成員，且不得重複或包含其他單位')
            if payload.get('revision') != revision(people):
                raise HTTPException(409, '成員已被更新，請重新載入後再排序')
            positions = {identifier: i for i, identifier in enumerate(ids)}
            all_people = store.collection(state, 'people')
            for person in all_people:
                if person.get('unit_id') == unit_id:
                    remember(state, person)
                    person['display_order'] = positions[person['id']]
                    person['updated_at'] = now()
                    remember(state, person)
            state['content']['people'] = all_people
            sync_members(state, store, unit_id)
            audit(state, actor, '調整成員順序', 'people', unit_id, unit_id)
            return order_result(state, unit_id)

    def member_preview(state, actor, identifier):
        person = next((p for p in store.collection(state, 'people') if p['id'] == identifier), None)
        if not person:
            raise HTTPException(404, '找不到此成員')
        if not allowed(actor, 'people', person):
            raise HTTPException(403, '不能刪除其他單位成員')
        unit = unit_scope(state, actor, person['unit_id'])
        identity = person.get('account_identity', '')
        grant = state['grants'].get(identity) if identity else None
        related = [p for p in store.collection(state, 'people') if identity and p.get('account_identity') == identity and p.get('unit_id') == person['unit_id']]
        revoke = bool(grant and grant['role'] == 'unit_admin' and person['unit_id'] in grant['units'] and len(related) == 1 and identity not in runtime.settings.system_admin_ids)
        impacts = [f"將「{person['name']}」從「{unit['name']}」成員名單移除，前台及單位摘要會同步更新。", '不會刪除院方登入帳號、其他單位成員或該人員建立的內容。']
        if revoke:
            impacts.append(f"同時移除明確關聯帳號「{identity}」在此單位的管理權限，其他單位授權保留。")
        elif identity:
            impacts.append('此關聯帳號的全站授權或其他有效成員關聯維持不變；全站授權須由人員權限頁另行處理。')
        else:
            impacts.append('此成員未關聯登入帳號，不會依姓名推測或更動任何帳號授權。')
        token = revision({'person': person, 'grant': grant, 'related': related})
        return person, grant, revoke, {'name': person['name'], 'impacts': impacts, 'revision': token}

    @app.get('/api/manage/people/{identifier}/delete-preview')
    async def preview_member(identifier: str, request: Request):
        state = store.read()
        actor, _ = context(request, state)
        return member_preview(state, actor, identifier)[3]

    @app.delete('/api/manage/people/{identifier}')
    async def delete_member(identifier: str, request: Request):
        payload = await body(request)
        with store.transaction() as state:
            actor, _ = context(request, state, write=True)
            person, grant, revoke, preview = member_preview(state, actor, identifier)
            if payload.get('revision') != preview['revision']:
                raise HTTPException(409, '成員或關聯授權已更新，請重新確認刪除範圍')
            remember(state, person)
            state['content']['people'] = [p for p in store.collection(state, 'people') if p['id'] != identifier]
            if revoke:
                identity = person['account_identity']
                remaining = [u for u in grant['units'] if u != person['unit_id']]
                if remaining:
                    state['grants'][identity] = {**grant, 'units': remaining}
                else:
                    del state['grants'][identity]
                audit(state, actor, '刪除成員並移除該單位授權', 'grants', identity, person['unit_id'])
            sync_members(state, store, person['unit_id'])
            audit(state, actor, '刪除單位成員', 'people', identifier, person['unit_id'])
        redirect = None
        if revoke and person.get('account_identity') == actor['identity']:
            redirect = 'admin' if remaining else 'internal'
        return {'ok': True, 'redirect': redirect}

    def grant_preview(state, actor, payload):
        identity, unit_id = payload.get('identity'), payload.get('unit')
        if not isinstance(identity, str):
            raise HTTPException(422, '請指定員工識別值')
        if actor['role'] not in {'site_admin', 'system_admin'}:
            raise HTTPException(403, '沒有移除人員授權的權限')
        if identity in runtime.settings.system_admin_ids:
            raise HTTPException(409, '伺服器保留管理員須由維運調整')
        grant = state['grants'].get(identity)
        if not grant:
            raise HTTPException(404, '找不到此授權')
        if actor['role'] != 'system_admin' and grant['role'] != 'unit_admin':
            raise HTTPException(403, '只有系統管理員可移除高階管理授權')
        if grant['role'] == 'unit_admin':
            if not isinstance(unit_id, str) or unit_id not in grant['units']:
                raise HTTPException(422, '請指定要移除的單一單位授權')
            scope = unit_scope(state, actor, unit_id)['name']
        else:
            if unit_id is not None:
                raise HTTPException(422, '全站角色不使用單位授權範圍')
            scope = '全站' + ('系統管理員' if grant['role'] == 'system_admin' else '醫研部總管理員')
            if grant['role'] == 'system_admin' and grant['active'] and not runtime.settings.system_admin_ids and not any(k != identity and g['role'] == 'system_admin' and g['active'] for k, g in state['grants'].items()):
                raise HTTPException(409, '不能移除最後一位系統管理員')
        people = [p for p in store.collection(state, 'people') if p.get('account_identity') == identity and (unit_id is None or p.get('unit_id') == unit_id)]
        name = grant.get('name') or (people[0]['name'] if people else identity)
        return grant, {'name': name, 'revision': revision({'grant': grant, 'unit': unit_id, 'people': people}),
                       'impacts': [f"移除「{name}」（{identity}）的「{scope}」管理權限，既有登入的後續操作立即套用新權限。", '保留院方登入帳號、公開成員名單及已建立的內容；其餘單位授權不受影響。', '清除此範圍成員的帳號關聯，避免留下已移除授權的連結。']}

    @app.post('/api/manage/grants/delete-preview')
    async def preview_grant(request: Request):
        payload = await body(request)
        state = store.read()
        actor, _ = context(request, state)
        return grant_preview(state, actor, payload)[1]

    @app.delete('/api/manage/grants')
    async def delete_grant(request: Request):
        payload = await body(request)
        with store.transaction() as state:
            actor, _ = context(request, state, write=True)
            grant, preview = grant_preview(state, actor, payload)
            if payload.get('revision') != preview['revision']:
                raise HTTPException(409, '授權或關聯成員已更新，請重新確認刪除範圍')
            identity, unit_id = payload['identity'], payload.get('unit')
            remaining = [u for u in grant['units'] if u != unit_id] if grant['role'] == 'unit_admin' else []
            if remaining:
                state['grants'][identity] = {**grant, 'units': remaining}
            else:
                del state['grants'][identity]
            clear_links(state, store, identity, {unit_id} if unit_id else None)
            audit(state, actor, '移除管理授權', 'grants', identity, unit_id)
        return {'ok': True, 'redirect': 'internal' if identity == actor['identity'] else None}
