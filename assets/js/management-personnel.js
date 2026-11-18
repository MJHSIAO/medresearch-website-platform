/* Member order and authorization removal use authenticated, persistent APIs. */
(function () {
  'use strict';
  const roles = {system_admin:'系統管理員',site_admin:'醫研部總管理員',unit_admin:'單位管理員'};
  const rank = {system_admin:3,site_admin:2,unit_admin:1};
  const e = value => window.MedManagementShell.esc(value);
  function focusTable(host,label){const region=host.querySelector('.table-container');if(region){region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',label+'，可左右捲動');}}

  function grantRows(items, bootstrap, units) {
    const order = new Map(units.map((unit, index) => [unit.id, index]));
    const rows = [...bootstrap.map(identity => ({identity, role:'system_admin', name:'',active:true,bootstrap:true,unit:null})),
      ...items.filter(grant=>!bootstrap.includes(grant.identity)).flatMap(grant => grant.role === 'unit_admin' ? grant.units.map(unit => ({...grant,unit})) : [{...grant,unit:null}])];
    return rows.sort((a,b) => (a.unit === null ? -1 : order.get(a.unit) ?? units.length) - (b.unit === null ? -1 : order.get(b.unit) ?? units.length)
      || (a.unit || '').localeCompare(b.unit || '') || rank[b.role]-rank[a.role]
      || (a.name || a.identity).localeCompare(b.name || b.identity,'zh-Hant') || a.identity.localeCompare(b.identity));
  }

  function confirmRemoval(title, preview) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog');
      dialog.className = 'announcement-dialog personnel-dialog';
      dialog.setAttribute('aria-labelledby','personnel-confirm-title');
      dialog.innerHTML = `<h2 id="personnel-confirm-title">${e(title)}「${e(preview.name)}」？</h2><ul>${preview.impacts.map(text=>`<li>${e(text)}</li>`).join('')}</ul><div class="actions"><button type="button" class="button" data-cancel autofocus>取消</button><button type="button" class="button danger" data-confirm>確認刪除</button></div>`;
      document.body.append(dialog);
      dialog.addEventListener('close',()=>{const confirmed=dialog.returnValue==='confirmed';dialog.remove();resolve(confirmed);},{once:true});
      dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
      dialog.querySelector('[data-confirm]').onclick=()=>dialog.close('confirmed');
      dialog.showModal();
    });
  }

  async function mountPeople({session,api,shell,onEdit,onNew,message,isCurrent,base}) {
    let unitId = new URLSearchParams(location.search).get('unit');
    if (!session.units.some(unit=>unit.id===unitId)) unitId=session.units[0]?.id;
    let items=[],revision='',saved=[],busy=false,loaded=false,loadTicket=0,dragged=null;
    const dirty=()=>items.map(entry=>entry.value.id).join('\n')!==saved.join('\n');
    shell.frame('單位成員','選擇單位後拖曳或使用上下移按鈕調整順序，再按「儲存順序」。','<div id="personnel-manager"></div>');
    const host=document.getElementById('personnel-manager');
    const active=()=>isCurrent()&&host.isConnected;
    const option=()=>session.units.map(unit=>`<option value="${e(unit.id)}" ${unit.id===unitId?'selected':''}>${e(unit.name)}</option>`).join('');
    function render(focusId,focusAction) {
      host.innerHTML=`<div class="personnel-toolbar"><label>所屬單位<select id="people-unit" ${busy?'disabled':''}>${option()}</select></label><p role="status">${loaded?`${items.length} 位成員 · ${dirty()?'順序已調整，尚未儲存':'目前順序已保存'}`:'尚未取得伺服器資料'}</p><div class="actions"><button class="button" data-reload ${busy?'disabled':''}>重新載入</button><button class="button primary" data-save ${busy||!dirty()?'disabled':''}>儲存順序</button><button class="button" data-new ${busy||!loaded||dirty()||!unitId?'disabled':''}>新增成員</button></div></div>
        <section class="panel">${window.MedManagementShell.table(['順序','姓名','職務','顯示範圍','操作'],items.map((entry,index)=>{const p=entry.value;return `<tr data-person-id="${e(p.id)}"><td><div class="member-position"><button type="button" class="drag-handle" data-drag aria-label="拖曳調整${e(p.name)}的順序" ${busy?'disabled':''}>⠿</button><span>${index+1}</span></div></td><td>${e(p.name)}${p.account_identity?'<small class="member-link-note">已明確關聯管理帳號</small>':''}</td><td>${e(p.title||'—')}</td><td>${e(p.visibility==='internal'?'僅院內':p.visibility==='both'?'院內外':'公開')}</td><td><div class="personnel-actions"><button type="button" class="edit-button" data-up aria-label="上移${e(p.name)}" ${busy||index===0?'disabled':''}>↑ 上移</button><button type="button" class="edit-button" data-down aria-label="下移${e(p.name)}" ${busy||index===items.length-1?'disabled':''}>↓ 下移</button><button type="button" class="edit-button" data-person-edit ${busy||dirty()?'disabled':''}>編輯</button><button type="button" class="edit-button danger-text" data-person-delete ${busy||dirty()?'disabled':''}>刪除</button></div></td></tr>`;}).join(''))}</section><p class="panel-subtitle">排序只影響目前單位，儲存後前台網站依相同順序呈現。調整期間請先儲存，再編輯、新增或刪除成員。</p>`;
      focusTable(host,'單位成員表格');
      if(focusId&&focusAction){const row=[...host.querySelectorAll('[data-person-id]')].find(node=>node.dataset.personId===focusId);row?.querySelector(`[${focusAction}]:not(:disabled)`)?.focus();}
    }
    async function load() {
      const ticket=++loadTicket;
      if(!unitId){items=[];saved=[];render();return;}
      busy=true;loaded=false;items=[];saved=[];revision='';render();
      try {const data=await api('manage/people/order/'+encodeURIComponent(unitId));if(!active()||ticket!==loadTicket)return;items=data.items;revision=data.revision;saved=items.map(entry=>entry.value.id);loaded=true;}
      finally {if(active()&&ticket===loadTicket){busy=false;render();}}
    }
    function move(id,to,action='data-drag') {
      const from=items.findIndex(entry=>entry.value.id===id);
      if(busy||from<0||to<0||to>=items.length||from===to)return;
      const [entry]=items.splice(from,1);items.splice(to,0,entry);render(id,action);
    }
    host.addEventListener('change',async event=>{
      if(event.target.id!=='people-unit')return;
      const next=event.target.value;
      if(dirty()){event.target.value=unitId;message('請先儲存順序，或按重新載入放棄尚未儲存的變更。',true);return;}
      unitId=next;const url=new URL(location.href);url.searchParams.set('unit',unitId);history.replaceState(null,'',url);try{await load();}catch(error){if(active())message(error.message,true);}
    });
    host.addEventListener('click',async event=>{
      const control=event.target.closest('button');if(!control||control.disabled||busy)return;
      const id=control.closest('[data-person-id]')?.dataset.personId;
      const index=items.findIndex(entry=>entry.value.id===id);
      if(control.hasAttribute('data-up')){move(id,index-1,'data-up');return;}
      if(control.hasAttribute('data-down')){move(id,index+1,'data-down');return;}
      try {
        if(control.hasAttribute('data-new')){await onNew('people');return;}
        if(control.hasAttribute('data-person-edit')){await onEdit('people',items[index]);return;}
        if(control.hasAttribute('data-reload')){await load();message('已重新載入伺服器保存的順序。');return;}
        if(control.hasAttribute('data-save')) {
          busy=true;render();
          const data=await api('manage/people/order/'+encodeURIComponent(unitId),'PUT',{ids:items.map(entry=>entry.value.id),revision});
          if(!active())return;items=data.items;revision=data.revision;saved=items.map(entry=>entry.value.id);message('成員順序已保存，前台重新整理後同步更新。');
        }
        if(control.hasAttribute('data-person-delete')) {
          busy=true;
          const preview=await api('manage/people/'+encodeURIComponent(id)+'/delete-preview');
          if(!active())return;
          if(!await confirmRemoval('刪除單位成員',preview)||!active())return;
          const deleted=await api('manage/people/'+encodeURIComponent(id),'DELETE',{revision:preview.revision});
          if(deleted.redirect){location.assign(new URL(deleted.redirect,base));return;}
          if(!active())return;await load();message('成員已從此單位移除，關聯的單位授權已依確認範圍更新。');
        }
      } catch(error) {if(active())message(error.message,true);}
      finally {if(active()){busy=false;render();if(control.hasAttribute('data-person-delete')){const next=items.find(entry=>entry.value.id===id)||items[Math.min(index,items.length-1)];const row=[...host.querySelectorAll('[data-person-id]')].find(node=>node.dataset.personId===next?.value.id);(row?.querySelector('[data-person-delete]')||host.querySelector('#people-unit'))?.focus();}else if(control.hasAttribute('data-reload'))host.querySelector('[data-reload]')?.focus();else if(control.hasAttribute('data-save'))host.querySelector('#people-unit')?.focus();}}
    });
    function endDrag(){dragged=null;host.classList.remove('member-dragging');host.querySelectorAll('.member-drop-target').forEach(row=>row.classList.remove('member-drop-target'));}
    host.addEventListener('pointerdown',event=>{
      const handle=event.target.closest('[data-drag]');if(!handle||busy||event.button!==0)return;
      event.preventDefault();handle.focus();handle.setPointerCapture(event.pointerId);
      dragged={id:handle.closest('[data-person-id]').dataset.personId,x:event.clientX,y:event.clientY,moved:false};
      host.classList.add('member-dragging');
    });
    host.addEventListener('pointermove',event=>{
      if(!dragged)return;
      dragged.moved ||= Math.hypot(event.clientX-dragged.x,event.clientY-dragged.y)>5;
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-person-id]');
      host.querySelectorAll('[data-person-id]').forEach(row=>row.classList.toggle('member-drop-target',dragged.moved&&row===target));
    });
    host.addEventListener('pointerup',event=>{
      if(!dragged)return;
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-person-id]');
      const drag=dragged;endDrag();
      if(drag.moved&&target&&host.contains(target))move(drag.id,items.findIndex(entry=>entry.value.id===target.dataset.personId));
    });
    host.addEventListener('pointercancel',endDrag);
    await load();
  }

  async function mountGrants({session,api,shell,onGrant,message,isCurrent,base}) {
    const data=await api('manage/grants');if(!isCurrent())return;
    let rows=grantRows(data.items,data.bootstrap||[],session.units),busy=false;
    shell.frame('人員權限','依所屬單位分組；同組依現有角色層級、姓名及識別值排序。','<div id="personnel-grants"></div>');
    const host=document.getElementById('personnel-grants'),active=()=>isCurrent()&&host.isConnected;
    function render(){
      let previous=Symbol();
      const html=rows.map((g,index)=>{
        const group=g.unit===null?'全站管理':shell.unitName(g.unit);
        const heading=previous!==g.unit?`<tr class="personnel-group"><th colspan="5">${e(group)}</th></tr>`:'';previous=g.unit;
        return heading+`<tr data-grant-row="${index}"><td>${g.name?`<strong>${e(g.name)}</strong><br>`:''}${e(g.identity)}</td><td>${e(roles[g.role])}</td><td class="unit-name">${e(g.unit===null?'全部單位':shell.unitName(g.unit))}${g.units?.length>1?`<small class="member-link-note">共 ${g.units.length} 個授權單位，此列僅操作本單位</small>`:''}</td><td>${window.MedManagementShell.badge(g.active?'active':'inactive')}</td><td>${g.bootstrap?'<span>伺服器保留帳號</span><button type="button" class="edit-button" disabled title="須由維運設定調整">刪除</button>':`<div class="personnel-actions"><button type="button" class="edit-button" data-personnel-grant ${busy?'disabled':''}>調整／停用</button><button type="button" class="edit-button danger-text" data-grant-delete ${busy?'disabled':''}>刪除</button></div>`}</td></tr>`;
      }).join('');
      host.innerHTML=`<div class="personnel-toolbar"><p>跨單位人員會分列於各授權單位；刪除僅移除該列範圍的管理權限。</p><button type="button" class="button primary" data-grant-new ${busy?'disabled':''}>新增授權</button></div><section class="panel">${window.MedManagementShell.table(['姓名／員工識別值','角色','管理範圍','狀態','操作'],html)}</section>`;
      focusTable(host,'人員權限表格');
    }
    host.addEventListener('click',async event=>{
      const control=event.target.closest('button');if(!control||control.disabled||busy)return;
      if(control.hasAttribute('data-grant-new')){onGrant({identity:'',name:'',role:'unit_admin',units:[],active:true});return;}
      const grant=rows[Number(control.closest('[data-grant-row]')?.dataset.grantRow)];if(!grant)return;
      if(control.hasAttribute('data-personnel-grant')){onGrant(grant);return;}
      if(!control.hasAttribute('data-grant-delete'))return;
      busy=true;render();
      try{
        const payload={identity:grant.identity,unit:grant.unit};
        const preview=await api('manage/grants/delete-preview','POST',payload);if(!active())return;
        if(!await confirmRemoval('移除管理授權',preview)||!active())return;
        const deleted=await api('manage/grants','DELETE',{...payload,revision:preview.revision});if(!active())return;
        if(deleted.redirect){location.assign(new URL(deleted.redirect,base));return;}
        const updated=await api('manage/grants');if(!active())return;
        rows=grantRows(updated.items,updated.bootstrap||[],session.units);message('已移除此範圍的管理授權，院方登入帳號與公開成員名單均保留。');
      }catch(error){if(active())message(error.message,true);}
      finally{if(active()){busy=false;render();const next=rows.findIndex(row=>row.identity===grant.identity&&row.unit===grant.unit);(host.querySelector(`[data-grant-row="${next}"] [data-grant-delete]`)||host.querySelector('[data-grant-new]'))?.focus();}}
    });
    render();
  }
  window.MedManagementPersonnel={mountPeople,mountGrants,grantRows};
})();
