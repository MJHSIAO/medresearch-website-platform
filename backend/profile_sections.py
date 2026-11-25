"""Conservative one-time classification of existing combined profile text."""
import copy
import hashlib

# Fingerprints of the official content reviewed and approved on 2026-11-25.
# Transfer the current stored text; never replace it with shipped/demo biography text.
CONFIRMED_COMBINED_SHA256 = {
    'person-medresearch-chang': 'ae619ae2d78172dc6389db7749de0e61ae9c0fa52105b5c43075333e5d8213cf',
    'person-medresearch-chen': 'f5bceaa350f326a0af46c817a5c621861a7a9a1b39837ba6142b9119a7e10d02',
    'person-medresearch-liao': 'a9d0cefd0a3ebc1f7263792231c0804a104bac91de8414ea64d5ef3d461909a2',
}

def split_confirmed_live_profile(identifier, profile):
    """Repair only the exact approved, still-unclassified official snapshots."""
    result=copy.deepcopy(profile)
    if not isinstance(profile,dict):return result
    combined=profile.get('achievements')
    if (not isinstance(combined,str) or not combined or
            hashlib.sha256(combined.encode('utf-8')).hexdigest()!=CONFIRMED_COMBINED_SHA256.get(identifier) or
            profile.get('introduction')!=combined or profile.get('honors') or profile.get('patents')):
        return result
    if identifier=='person-medresearch-liao':
        parts=combined.split('\n'+'*'*108+'\n')
        if len(parts)!=2 or not parts[1].startswith('Patent\n'):return result
        result.update(introduction='',honors=parts[0],patents=parts[1])
    else:
        result.update(introduction='',honors=combined)
    return result

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
