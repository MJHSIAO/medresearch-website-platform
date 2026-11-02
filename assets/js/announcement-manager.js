(function(){
  'use strict';
  async function mount({target,api,message,isCurrent,base}){
    const {esc:e,badge,table}=window.MedManagementShell;
    let entries=[];
    document.querySelector('.announcement-dialog')?.remove();
    const modal=document.createElement('dialog');modal.className='announcement-dialog';document.body.append(modal);
    const report=error=>message(error.message,true);
    async function refresh(){
      const result=await api('manage/announcements');if(!isCurrent())return;entries=result.items;
      target.innerHTML=`<div class="announcement-toolbar"><p>${entries.length} 則公告，${entries.filter(i=>i.value.active).length} 則啟用。新增公告優先顯示。</p><div class="actions"><a class="button" href="${e(base.href)}" target="_blank" rel="noopener">查看前台 ↗</a><button type="button" class="button primary" data-announcement-new>＋ 新增公告</button></div></div><section class="panel">${table(['公告內容','狀態','操作'],entries.map((entry,index)=>{const item=entry.value;return `<tr><td class="announcement-text">${e(item.text)}${item.href?`<small class="announcement-link">連結：${e(item.href)}</small>`:''}</td><td>${badge(item.active?'active':'inactive')}</td><td><div class="announcement-actions"><button type="button" class="edit-button" data-announcement-edit="${index}">編輯</button><button type="button" class="edit-button" data-announcement-toggle="${index}">${item.active?'停用':'啟用'}</button><button type="button" class="edit-button" data-announcement-delete="${index}">刪除</button></div></td></tr>`;}).join(''))}</section>`;
    }
    function edit(entry){
      const value=entry?.value||{id:'announcement-'+crypto.randomUUID(),text:'',href:'',active:true};
      modal.innerHTML=`<h2>${entry?'編輯公告':'新增公告'}</h2><form class="announcement-form"><label>公告內容<textarea name="text" maxlength="200" required>${e(value.text)}</textarea></label><small>最多 200 字，建議每則保持簡短，方便閱讀。</small><label>連結（選填）<input name="href" maxlength="500" value="${e(value.href)}" placeholder="例如 news.html 或 https://..."></label><label><input type="checkbox" name="active" ${value.active?'checked':''}>啟用此公告，儲存後顯示於前台</label><p role="alert" class="announcement-error"></p><div class="actions"><button type="button" class="button" data-cancel>取消</button><button type="submit" class="button primary">儲存公告</button></div></form>`;
      modal.showModal();modal.querySelector('[data-cancel]').onclick=()=>modal.close();
      modal.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.target,submit=form.querySelector('[type=submit]');submit.disabled=true;try{await api('manage/announcements/'+value.id,'PUT',{revision:entry?.revision||null,value:{text:form.elements.text.value,href:form.elements.href.value,active:form.elements.active.checked}});modal.close();if(!isCurrent())return;await refresh();message('公告已儲存至伺服器。前台重新載入或回到前台分頁後更新。');}catch(error){modal.querySelector('.announcement-error').textContent=error.message;}finally{submit.disabled=false;}};
    }
    function confirmDelete(entry){
      modal.innerHTML=`<h2>刪除這則公告？</h2><p>${e(entry.value.text)}</p><p>刪除後將從前台及公告列表移除。</p><p role="alert" class="announcement-error"></p><div class="actions"><button type="button" class="button" data-cancel>取消</button><button type="button" class="button primary" data-confirm>確認刪除</button></div>`;
      modal.showModal();modal.querySelector('[data-cancel]').onclick=()=>modal.close();modal.querySelector('[data-confirm]').onclick=async event=>{const button=event.target;button.disabled=true;try{await api('manage/announcements/'+entry.value.id,'DELETE',{revision:entry.revision});modal.close();if(!isCurrent())return;await refresh();message('公告已從伺服器刪除。');}catch(error){modal.querySelector('.announcement-error').textContent=error.message;button.disabled=false;}};
    }
    target.onclick=async event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-announcement-new')){edit();return;}
      const editIndex=button.dataset.announcementEdit,deleteIndex=button.dataset.announcementDelete,toggleIndex=button.dataset.announcementToggle;
      if(editIndex!==undefined){edit(entries[Number(editIndex)]);return;}
      if(deleteIndex!==undefined){confirmDelete(entries[Number(deleteIndex)]);return;}
      if(toggleIndex!==undefined){const entry=entries[Number(toggleIndex)];button.disabled=true;try{await api('manage/announcements/'+entry.value.id,'PUT',{revision:entry.revision,value:{...entry.value,active:!entry.value.active}});if(!isCurrent())return;await refresh();message(entry.value.active?'公告已停用。':'公告已啟用。');}catch(error){report(error);button.disabled=false;}}
    };
    await refresh();
  }
  window.MedAnnouncementManager={mount};
})();
