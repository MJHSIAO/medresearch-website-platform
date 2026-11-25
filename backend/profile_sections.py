"""Conservative one-time classification of existing combined profile text."""
import copy

def split_profile(profile, seed=None):
    result=copy.deepcopy(profile)
    if result.get('sections_version')==1:return result
    legacy=result.get('achievements','')
    result.setdefault('honors','');result.setdefault('patents','')
    if seed and legacy==seed.get('achievements',''):
        for key in ('honors','patents','author_names'):
            if key not in profile:result[key]=copy.deepcopy(seed.get(key,[] if key=='author_names' else ''))
        # The seed introduction also contains unclassified original professional activities.
        extra=seed.get('legacy_activity_source','')
    else:
        # Do not guess whether custom text is an award or a patent.
        extra=legacy
        result.setdefault('author_names',[])
    if extra and extra not in result.get('introduction',''):
        joined='\n\n'.join(filter(None,[result.get('introduction',''),extra]))
        if len(joined)<=20000:result['introduction']=joined
        else:result['legacy_activities']=extra
    result['sections_version']=1
    return result
