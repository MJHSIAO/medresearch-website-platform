/* Document editing uses the existing authenticated content and upload APIs. */
(function(){
  'use strict';
  function mount({target,entry,session,base,api,message,onSaved,onBack,onHistory}){
    const {esc, badge}=window.MedManagementShell,original=entry.value;
    const units=[...session.units,...(session.profile.role==='unit_admin'?[]:[{id:'medresearch',name:'醫學研究部'}])];
    let file={...original.file},busy=false;
    const chosen=original.owner_unit_id||units[0]?.id;
    const opts=(values,selected)=>values.map(([v,l])=>`<option value="${esc(v)}"${v===selected?' selected':''}>${esc(l)}</option>`).join('');
    target.innerHTML=`<h2>${entry.revision?'編輯文件':'新增文件'}</h2><p>目前狀態：${badge(original.status)}${original.is_demo?' · 此項為示意文件；換上正式檔案後會移除示意標記。':''}</p><form id="document-editor"><label>所屬單位${entry.revision?`<input value="${esc(units.find(u=>u.id===chosen)?.name||chosen)}" readonly>`:`<select name="unit">${opts(units.map(u=>[u.id,u.name]),chosen)}</select>`}</label><label>文件名稱<input name="title" required maxlength="160" value="${esc(original.title)}"></label><label>文件說明<textarea name="summary" required maxlength="1000" rows="3">${esc(original.summary)}</textarea></label><div class="grid"><label>文件類型<select name="category">${opts(['作業文件','申請表單','檢核清單'].map(x=>[x,x]),original.category)}</select></label><label>版本<input name="version" required maxlength="80" value="${esc(original.version)}"></label></div><fieldset><legend>文件檔案</legend><label>上傳／更換檔案<input name="file" type="file" accept="application/pdf,image/png,image/jpeg"></label><p>PDF、PNG 或 JPEG，每個檔案上限 5 MB。選檔後上傳，儲存或發布後才建立文件關聯。</p><div id="document-file"></div></fieldset><div class="actions"><button type="submit" value="draft">${original.status==='published'?'轉為草稿（停止公開）':'儲存草稿'}</button><button type="submit" value="published">${original.status==='published'?'發布更新':'發布'}</button>${entry.revision?'<button type="submit" value="archived">下架</button>':''}<button type="button" id="document-back">返回列表</button>${entry.revision?'<button type="button" id="document-history">查看歷史版本</button>':''}</div></form>`;
    const form=target.querySelector('form'),fileBox=target.querySelector('#document-file');
    const active=()=>target.isConnected&&target.querySelector('form')===form;
    function setBusy(value){busy=value;form.querySelectorAll('button,input[type=file],select[name=unit]').forEach(x=>x.disabled=value);}
    function drawFile(){fileBox.replaceChildren();if(!file.href){fileBox.textContent='尚未選擇檔案';return;}const a=document.createElement('a');a.textContent=file.name||'查看檔案';a.href=new URL(file.href,base);a.target='_blank';a.rel='noopener';fileBox.append(a);const remove=document.createElement('button');remove.type='button';remove.textContent='移除檔案';remove.onclick=()=>{file={};drawFile();};fileBox.append(remove);}
    if(form.elements.unit)form.elements.unit.onchange=()=>{file={};drawFile();message('所屬單位已變更，請重新選擇該單位的檔案。');};
    form.elements.file.onchange=async()=>{
      const selected=form.elements.file.files[0];if(!selected||busy)return;
      const unit=original.owner_unit_id||form.elements.unit.value;setBusy(true);
      try{
        if(selected.size>5*1024*1024)throw Error('檔案超過 5 MB');
        const mime=selected.type||(/\.pdf$/i.test(selected.name)?'application/pdf':/\.png$/i.test(selected.name)?'image/png':/\.jpe?g$/i.test(selected.name)?'image/jpeg':'');
        if(!['application/pdf','image/png','image/jpeg'].includes(mime))throw Error('只支援 PDF、PNG 或 JPEG');
        const response=await fetch(new URL('api/manage/files/'+encodeURIComponent(unit),base),{method:'POST',headers:{'Content-Type':mime,'X-CSRF-Token':session.csrf,'X-File-Name':encodeURIComponent(selected.name)},body:selected});
        if(!response.headers.get('content-type')?.includes('application/json'))throw Error('上傳服務暫時無法使用，請稍後再試。');
        const result=await response.json();if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'上傳失敗');
        if(!active())return;file={href:result.url,name:selected.name};drawFile();message('檔案已上傳，請儲存草稿或發布。');
      }catch(error){if(active())message(error.message,true);}finally{if(active()){form.elements.file.value='';setBusy(false);}}
    };
    form.onsubmit=async event=>{
      event.preventDefault();if(busy)return;const status=event.submitter?.value||'draft';
      const value={...original,file,title:form.elements.title.value.trim(),summary:form.elements.summary.value.trim(),category:form.elements.category.value,version:form.elements.version.value.trim(),status};
      if(status==='published'&&!file.href){message('發布前請先上傳檔案。',true);return;}
      const unit=original.owner_unit_id||form.elements.unit.value;setBusy(true);
      try{const result=await api('manage/content/documents/'+encodeURIComponent(original.id),'PUT',{value,unit,revision:entry.revision});if(!active())return;message(status==='published'?'文件已發布，可從公開文件表單頁查閱。':status==='archived'?'文件已下架。':'文件草稿已儲存。');await onSaved(result);}catch(error){if(active())message(error.message,true);}finally{if(active())setBusy(false);}
    };
    target.querySelector('#document-back').onclick=()=>Promise.resolve(onBack()).catch(e=>message(e.message,true));
    const history=target.querySelector('#document-history');if(history)history.onclick=()=>Promise.resolve(onHistory()).catch(e=>message(e.message,true));drawFile();
  }
  window.MedDocumentEditor={mount};
})();
