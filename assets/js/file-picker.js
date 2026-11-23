/* Reuse a scoped private upload without creating or publishing a second copy. */
(function(){
  'use strict';
  async function choose({base,api,unit,onChoose,accept}){
    const {esc}=window.MedManagementShell;
    const result=await api('manage/files?include_imported=false&unit='+encodeURIComponent(unit));
    const items=accept?result.items.filter(f=>accept.includes(f.mime)):result.items;
    const dialog=document.createElement('dialog');dialog.className='file-picker';
    dialog.setAttribute('aria-labelledby','file-picker-title');
    dialog.innerHTML=`<h2 id="file-picker-title">選用既有檔案</h2><p>僅列出目前單位的上傳檔案。選用後仍須儲存內容才會建立關聯。</p><label>搜尋檔名<input type="search"></label><div class="file-picker-list"></div><button type="button" data-close>取消</button>`;
    const draw=()=>{const q=dialog.querySelector('input').value.toLocaleLowerCase();const shown=items.filter(f=>f.name.toLocaleLowerCase().includes(q));dialog.querySelector('.file-picker-list').innerHTML=shown.map(f=>`<div class="news-edit-file"><span>${esc(f.name)} · ${Math.ceil(f.size/1024)} KB<br><small>${esc(f.usages?.map(u=>`${u.kind==='documents'?'文件':u.kind==='news'?'消息':'內容'}：${u.title}（${u.visibility==='internal'?'院內':'對外'}）`).join('；')||'尚未被內容引用')}</small></span><button type="button" data-id="${esc(f.id)}">選用</button></div>`).join('')||'<p>此單位目前沒有符合條件的上傳檔案。</p>';};
    dialog.querySelector('input').oninput=draw;
    dialog.onclick=event=>{if(event.target.closest('[data-close]'))dialog.close();const id=event.target.closest('[data-id]')?.dataset.id;if(id){const file=items.find(f=>f.id===id);onChoose({href:file.url,name:file.name,mime:file.mime,size:file.size});dialog.close();}};
    const previous=document.activeElement;
    dialog.onclose=()=>{dialog.remove();previous?.focus();};document.body.append(dialog);draw();dialog.showModal();
  }
  window.MedFilePicker={choose};
})();
