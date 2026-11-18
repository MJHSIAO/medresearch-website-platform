/* Document records select or upload a file, then publish to an explicit destination. */
(function(){
  'use strict';
  function mount({target,entry,session,base,api,message,onSaved,onBack,onHistory}){
    const {esc:e,badge}=window.MedManagementShell,original=entry.value;
    const units=[...session.units,...(session.profile.role==='unit_admin'?[]:[{id:'medresearch',name:'醫學研究部'}])];
    let file={...original.file},busy=false;
    const requested=new URLSearchParams(location.search).get('unit');
    const chosen=original.owner_unit_id||(units.some(u=>u.id===requested)?requested:units[0]?.id);
    const options=(values,value)=>values.map(([id,label])=>`<option value="${e(id)}"${id===value?' selected':''}>${e(label)}</option>`).join('');
    const localDate=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
    target.innerHTML=`<h2>${entry.revision?'編輯文件':'新增文件'}</h2><p>目前狀態：${badge(original.status)}${original.is_demo?' · 此項為公開示意文件；換上核定檔案後移除示意標記。':''}</p>
    <form id="document-editor">
      <label>所屬單位${entry.revision||units.length===1?`<input value="${e(units.find(u=>u.id===chosen)?.name||chosen)}" readonly>`:`<select name="unit">${options(units.map(u=>[u.id,u.name]),chosen)}</select>`}</label>
      <p>單位管理員的檔案歸屬由伺服器依授權確認；建立後不可變更。</p>
      <label>文件名稱<input name="title" required maxlength="160" value="${e(original.title)}"></label>
      <label>文件說明<textarea name="summary" required maxlength="1000" rows="3">${e(original.summary)}</textarea></label>
      <div class="grid"><label>文件類型<select name="category">${options(['作業文件','申請表單','檢核清單'].map(x=>[x,x]),original.category)}</select></label><label>版本<input name="version" required maxlength="80" value="${e(original.version)}"></label></div>
      <div class="grid"><label>文件日期<input name="document_date" type="date" value="${e(Object.prototype.hasOwnProperty.call(original,'document_date')?original.document_date:original.updated_at?.slice(0,10)||localDate())}"><small>日期不明請留空，前台會標示「日期待確認」。來源查核日不代表文件日期。</small></label><label>公開範圍<select name="visibility">${options([['public','對外公開'],['internal','僅院內（登入後查閱）']],original.visibility)}</select></label></div>
      <p id="document-destination" role="status"></p>${original.original_file_href?`<aside class="document-provenance"><strong>原始公開文件</strong><p>${e(original.source_note||'')}</p><p>原始網址會持續保留；下架只移出下載清單。更換檔案後，舊網址仍提供原 PDF。</p></aside>`:''}
      <fieldset><legend>文件檔案</legend><label>上傳／更換檔案<input name="file" type="file" accept="application/pdf,image/png,image/jpeg"></label><p>PDF、PNG 或 JPEG，每檔上限 5 MB。上傳不會自動發布；可直接選用共用檔案庫中的同單位檔案。</p><button type="button" id="document-choose">選用既有檔案</button><div id="document-file"></div></fieldset>
      <div class="actions"><button type="submit" value="draft">${original.status==='published'?'轉為草稿（停止發布）':'儲存草稿'}</button><button type="submit" value="published">${original.status==='published'?'發布更新':'發布'}</button>${entry.revision?'<button type="submit" value="archived">下架</button>':''}<button type="button" id="document-back">返回列表</button>${entry.revision?'<button type="button" id="document-history">查看歷史版本</button>':''}</div></form>`;
    const form=target.querySelector('form'),fileBox=target.querySelector('#document-file');
    const unit=()=>original.owner_unit_id||form.elements.unit?.value||chosen;
    const active=()=>target.isConnected&&target.querySelector('form')===form;
    const setBusy=value=>{busy=value;form.querySelectorAll('button,input[type=file],select[name=unit]').forEach(x=>x.disabled=value);};
    function destination(){const internal=form.elements.visibility.value==='internal',id=unit();const path=internal?'internal?unit='+encodeURIComponent(id)+'#internal-documents':id==='medresearch'?'content-page.html?page=downloads&unit=medresearch':'unit.html?unit='+encodeURIComponent(id)+'#unit-documents';const box=target.querySelector('#document-destination');box.replaceChildren(document.createTextNode('發布位置：'+(internal?'院內專區 → 院內文件下載':'單位官網 → 文件下載')+' · '));const a=document.createElement('a');a.href=new URL(path,base);a.textContent='查看呈現位置';a.target='_blank';a.rel='noopener';box.append(a);}
    function drawFile(){fileBox.replaceChildren();if(!file.href){fileBox.textContent='尚未選擇檔案';return;}const a=document.createElement('a');a.textContent=file.name||'查看檔案';a.href=new URL(file.href,base);a.target='_blank';a.rel='noopener';fileBox.append(a);const b=document.createElement('button');b.type='button';b.textContent='移除檔案';b.onclick=()=>{file={};drawFile();};fileBox.append(b);}
    form.elements.visibility.onchange=destination;
    if(form.elements.unit)form.elements.unit.onchange=()=>{file={};drawFile();destination();message('所屬單位已變更，請選擇該單位的檔案。');};
    target.querySelector('#document-choose').onclick=async()=>{if(busy)return;setBusy(true);try{await window.MedFilePicker.choose({base,api,unit:unit(),onChoose:selected=>{if(active()){file={href:selected.href,name:selected.name};drawFile();message('已選用既有檔案，請儲存或發布。');}}});}catch(err){if(active())message(err.message,true);}finally{if(active())setBusy(false);}};
    form.elements.file.onchange=async()=>{
      const selected=form.elements.file.files[0];if(!selected||busy)return;setBusy(true);
      try{if(selected.size>5*1024*1024)throw Error('檔案超過 5 MB');const mime=selected.type||(/\.pdf$/i.test(selected.name)?'application/pdf':'');
        const response=await fetch(new URL('api/manage/files/'+encodeURIComponent(unit()),base),{method:'POST',headers:{'Content-Type':mime,'X-CSRF-Token':session.csrf,'X-File-Name':encodeURIComponent(selected.name)},body:selected});
        if(!response.headers.get('content-type')?.includes('application/json'))throw Error('上傳服務暫時無法使用。');const result=await response.json();if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'上傳失敗');
        if(active()){file={href:result.url,name:selected.name};drawFile();message('檔案已上傳，請儲存草稿或發布。');}
      }catch(err){if(active())message(err.message,true);}finally{if(active()){form.elements.file.value='';setBusy(false);}}
    };
    form.onsubmit=async event=>{event.preventDefault();if(busy)return;const status=event.submitter?.value||'draft';const value={...original,file,status,...Object.fromEntries(['title','summary','category','version','visibility','document_date'].map(k=>[k,form.elements[k].value.trim()]))};
      if(status==='published'&&!file.href){message('發布前請先選擇或上傳檔案。',true);return;}setBusy(true);
      try{const result=await api('manage/content/documents/'+encodeURIComponent(original.id),'PUT',{value,unit:unit(),revision:entry.revision});if(!active())return;message(status==='published'?'文件已發布，請由標示的呈現位置查閱。':status==='archived'?'文件已下架。':'文件草稿已儲存。');await onSaved(result);}catch(err){if(active())message(err.message,true);}finally{if(active())setBusy(false);}
    };
    target.querySelector('#document-back').onclick=()=>Promise.resolve(onBack()).catch(err=>message(err.message,true));const history=target.querySelector('#document-history');if(history)history.onclick=()=>Promise.resolve(onHistory()).catch(err=>message(err.message,true));drawFile();destination();
  }
  window.MedDocumentEditor={mount};
})();
