/* Extends the existing member form; publications save independently through scoped APIs. */
(function(){
 'use strict';
 const limits={english_name:200,introduction:20000,positions:10000,education:10000,experience:10000,research_fields:10000,honors:20000,patents:20000,email:200,phone:100};
 const labels={english_name:'英文姓名／學位',introduction:'完整介紹',positions:'現職',education:'學歷',experience:'經歷',research_fields:'研究領域／專長',honors:'榮譽',patents:'專利',email:'公開電子郵件',phone:'公開電話／分機'};
 function mount({target,person,base,api,unit,saved,message}){
   const e=window.MedManagementShell.esc,original=person.profile||{};let photo=original.photo_href||'';
   const fieldLabels={...labels},fieldLimits={...limits};
   if(original.legacy_activities&&!original.introduction?.includes(original.legacy_activities)){fieldLabels.legacy_activities='其他事績（既有內容）';fieldLimits.legacy_activities=20000;}
   const fields=Object.entries(fieldLabels).map(([key,label])=>`<label>${label}${['english_name','email','phone'].includes(key)?`<input data-profile="${key}" value="${e(original[key]||'')}">`:`<textarea data-profile="${key}" rows="${key==='introduction'?5:4}">${e(original[key]||'')}</textarea>`}</label><small data-count="${key}" role="status"></small>`).join('');
   target.innerHTML=`<details class="member-profile-editor" open><summary>本站個人介紹</summary><label><input type="checkbox" data-enabled ${original.enabled?'checked':''}>啟用本站個人介紹頁（依成員與單位公開狀態顯示）</label><div class="profile-photo"><div data-photo></div><label>上傳個人照片<input type="file" accept="image/png,image/jpeg" data-upload></label><div class="actions"><button type="button" data-choose>選用同單位照片</button><button type="button" data-remove>移除照片</button></div><small>PNG／JPEG，最多 5 MB；照片在儲存成員後套用。</small></div>${fields}<label>作者姓名寫法（每行一種）<textarea data-author-names rows="4">${e((original.author_names||[]).join('\n'))}</textarea></label><small>最多 20 種，每種 200 字。請填完整英文姓名及實際使用的縮寫；儲存成員後，研究成果會自動粗體標示這些姓名與中文姓名。</small>${original.achievements?`<details><summary>既有合併欄位備份（唯讀）</summary><p class="member-long-text">${e(original.achievements)}</p><p>舊文字保留供核對；請在上方榮譽、專利或完整介紹編輯現在要呈現的內容。</p></details>`:''}<label>院方醫師介紹連結（選填）<input data-doctor type="url" value="${e(original.doctor_href||'')}" maxlength="2048"></label><label>其他外部連結（每行「名稱 | 網址」）<textarea data-links rows="3">${e((original.links||[]).map(l=>l.label+' | '+l.href).join('\n'))}</textarea></label><small>最多 20 筆；名稱 100 字內，網址 2048 字內。</small><p><button type="button" class="button secondary" data-publications>管理研究成果</button></p><p>研究成果獨立儲存，每位成員最多 2000 筆、每筆 5000 字；可批次貼上，前台可搜尋、篩選年份與分頁。</p>${person.profile_import_note?`<details><summary>資料核對記錄</summary><p>${e(person.profile_import_note)}</p></details>`:''}</details>`;
   const photoBox=target.querySelector('[data-photo]');
   function drawPhoto(){photoBox.innerHTML=photo?`<img src="${e(new URL(photo,base).href)}" alt="${e(person.name||'成員')}的照片" class="news-edit-thumbnail">`:'<p>尚未設定照片。</p>';}
   drawPhoto();
   for(const [key,limit] of Object.entries(fieldLimits)){
     const input=target.querySelector(`[data-profile="${key}"]`),count=target.querySelector(`[data-count="${key}"]`);
     const check=()=>{const length=Array.from(input.value).length;count.textContent=`${length} / ${limit} 字`;input.setCustomValidity(length>limit?`${fieldLabels[key]}最多 ${limit} 字`:'');};input.oninput=check;check();
   }
   target.querySelector('[data-remove]').onclick=()=>{photo='';drawPhoto();};
   target.querySelector('[data-choose]').onclick=async()=>{try{await window.MedFilePicker.choose({base,api,unit:unit(),accept:['image/png','image/jpeg'],onChoose:file=>{photo=file.href;drawPhoto();}});}catch(error){message(error.message,true);}};
   target.querySelector('[data-upload]').onchange=async event=>{
     const input=event.target,file=input.files[0];if(!file)return;input.disabled=true;
     try{if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024)throw Error('請使用 5 MB 以內的 PNG 或 JPEG 照片');const result=await api('manage/files/'+encodeURIComponent(unit()),'POST',file,{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)});photo=result.url;drawPhoto();message('照片已上傳，請儲存成員以套用。');}catch(error){message(error.message,true);}finally{input.disabled=false;input.value='';}
   };
   target.querySelector('[data-publications]').onclick=async()=>{
     if(!saved){message('請先儲存成員，再管理研究成果。',true);return;}
     const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='file-picker member-publication-dialog';dialog.setAttribute('aria-labelledby','member-publications-title');dialog.innerHTML=`<div class="member-publication-header"><h2 id="member-publications-title">${e(person.name)}｜研究成果</h2><button type="button" class="button secondary" data-close>關閉</button></div><div class="member-publication-body"><p>此處的新增、編輯與刪除會獨立儲存，不需再按成員表單的儲存。</p><div data-list></div></div>`;
     dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();previous?.focus();};document.body.append(dialog);dialog.showModal();
     try{await window.MedMemberPublications.mount({target:dialog.querySelector('[data-list]'),api,path:'manage/people/'+encodeURIComponent(person.id)+'/publications',manage:true,personName:person.name});}catch(error){message(error.message,true);}
   };
   return {value(){
     const profile={...original,enabled:target.querySelector('[data-enabled]').checked,photo_href:photo,author_names:target.querySelector('[data-author-names]').value.split('\n').map(s=>s.trim()).filter(Boolean),doctor_href:target.querySelector('[data-doctor]').value.trim(),links:[]};
     for(const key of Object.keys(fieldLimits))profile[key]=target.querySelector(`[data-profile="${key}"]`).value.trim();
     const rows=target.querySelector('[data-links]').value.split('\n').filter(s=>s.trim());if(rows.length>20)throw Error('外部連結最多 20 筆');
     for(const row of rows){const separator=row.indexOf('|');if(separator<1)throw Error('外部連結請使用「名稱 | 網址」');profile.links.push({label:row.slice(0,separator).trim(),href:row.slice(separator+1).trim()});}
     return profile;
   }};
 }
 window.MedMemberProfileEditor={mount};
})();
