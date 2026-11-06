"""Resource group validation and conservative one-time seed upgrade."""
import copy
from fastapi import HTTPException

RELEASE = 'resource-content-2026-11-05'


def validate_groups(groups):
    def text(value):
        if not isinstance(value, str) or len(value) > 10000:
            raise HTTPException(422, '資源文字欄位格式不正確')
    if not isinstance(groups, list) or len(groups) > 50:
        raise HTTPException(422, '資源群組必須為清單，最多 50 組')
    for group in groups:
        if not isinstance(group, dict):
            raise HTTPException(422, '資源群組格式不正確')
        text(group.get('title'))
        text(group.get('text', ''))
        cards = group.get('cards')
        if not isinstance(cards, list) or len(cards) > 100:
            raise HTTPException(422, '資源卡片必須為清單，最多 100 筆')
        for card in cards:
            if not isinstance(card, dict):
                raise HTTPException(422, '資源卡片格式不正確')
            for key in ('title', 'text', 'tag', 'contact'):
                text(card.get(key, ''))
            actions = card.get('actions')
            if not isinstance(actions, list) or len(actions) > 20:
                raise HTTPException(422, '資源連結格式不正確')
            for action in actions:
                if not isinstance(action, dict):
                    raise HTTPException(422, '資源連結格式不正確')
                text(action.get('label'))
                text(action.get('href'))


def merge_collection(current, baseline, updated):
    """Keep administrator edits; upgrade fields still equal to the prior seed."""
    old_by_id = {x['id']: x for x in baseline}
    new_by_id = {x['id']: x for x in updated}
    result = copy.deepcopy(current)
    present = {x['id'] for x in current}
    for item in result:
        previous, new = old_by_id.get(item['id']), new_by_id.get(item['id'])
        if previous is None or new is None:
            continue
        for key, value in new.items():
            if key not in previous:
                if key not in item:
                    item[key] = copy.deepcopy(value)
            elif key not in item or item[key] == previous[key]:
                item[key] = copy.deepcopy(value)
    # Content records have no delete endpoint. Append newly shipped IDs only;
    # never resurrect an old seed record missing from an overridden collection.
    result.extend(copy.deepcopy(x) for x in updated if x['id'] not in present and x['id'] not in old_by_id)
    return result
