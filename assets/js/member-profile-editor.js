/* Extends the existing member form; publications save independently through scoped APIs. */
(function(){
 'use strict';
 const limits={english_name:200,introduction:20000,positions:10000,education:10000,experience:10000,research_fields:10000,achievements:20000,email:200,phone:100};
 const labels={english_name:'英文姓名／學位',introduction:'完整介紹',positions:'現職',education:'學歷',experience:'經歷',research_fields:'研究領域／專長',achievements:'研究成果／榮譽／專利',email:'公開電子郵件',phone:'公開電話／分機'};
 function mount({target,person,base,api,unit,saved,message}){
   const e=window.MedManagementShell.esc,original=person.profile||{};let photo=original.photo_href||'';
   const fields=Object.entries(labels).map(([key,label])=>`<label>${label}${['english_name','email','phone'].includes(key)?`<input data-profile="${key}" value="${e(original[key]||'')}">`:`<textarea data-profile="${key}" rows="${key==='introduction'?5:4}">${e(original[key]||'')}</textarea>`}</label><small data-count="${key}" role="status"></small>`).join('');
   target.innerHTML=`<details class="member-profile-editor" open><summary>本站個人介紹</summary><label><input type="checkbox" data-enabled ${original.enabled?'checked':''}>啟用本站個人介紹頁（依成員與單位公開狀態顯示）</label><div class="profile-photo"><div data-photo></div><label>上傳個人照片<input type="file" accept="image/png,image/jpeg" data-upload></label><div class="actions"><button type="button" data-choose>選用同單位照片</button><button type="button" data-remove>移除照片</button></div><small>PNG／JPEG，最多 5 MB；照片在儲存成員後套用。</small></div>${fields}<label>院方醫師介紹連結（選填）<input data-doctor type="url" value="${e(original.doctor_href||'')}" maxlength="2048"></label><label>其他外部連結（每行「名稱 | 網址」）<textarea data-links rows="3">${e((original.links||[]).map(l=>l.label+' | '+l.href).join('\n'))}</textarea></label><small>最多 20 筆；名稱 100 字內，網址 2048 字內。</small><p><button type="button" class="button secondary" data-publications>管理論文與成果</button></p><p>論文獨立儲存，每位成員最多 2000 筆、每筆 5000 字；可批次貼上，前台可搜尋、篩選年份與分頁。</p>${person.profile_import_note?`<details><summary>資料核對記錄</summary><p>${e(person.profile_import_note)}</p></details>`:''}</details>`;
   const photoBox=target.querySelector('[data-photo]');
   function drawPhoto(){photoBox.innerHTML=photo?`<img src="${e(new URL(photo,base).href)}" alt="${e(person.name||'成員')}的照片" class="news-edit-thumbnail">`:'<p>尚未設定照片。</p>';}
   drawPhoto();
   for(const [key,limit] of Object.entries(limits)){
     const input=target.querySelector(`[data-profile="${key}"]`),count=target.querySelector(`[data-count="${key}"]`);
     const check=()=>{const length=Array.from(input.value).length;count.textContent=`${length} / ${limit} 字`;input.setCustomValidity(length>limit?`${labels[key]}最多 ${limit} 字`:'');};input.oninput=check;check();
   }
   target.querySelector('[data-remove]').onclick=()=>{photo='';drawPhoto();};
   target.querySelector('[data-choose]').onclick=async()=>{try{await window.MedFilePicker.choose({base,api,unit:unit(),accept:['image/png','image/jpeg'],onChoose:file=>{photo=file.href;drawPhoto();}});}catch(error){message(error.message,true);}};
   target.querySelector('[data-upload]').onchange=async event=>{
     const input=event.target,file=input.files[0];if(!file)return;input.disabled=true;
     try{if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024)throw Error('請使用 5 MB 以內的 PNG 或 JPEG 照片');const result=await api('manage/files/'+encodeURIComponent(unit()),'POST',file,{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name)});photo=result.url;drawPhoto();message('照片已上傳，請儲存成員以套用。');}catch(error){message(error.message,true);}finally{input.disabled=false;input.value='';}
   };
   target.querySelector('[data-publications]').onclick=async()=>{
     if(!saved){message('請先儲存成員，再管理論文成果。',true);return;}
     const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='file-picker member-publication-dialog';dialog.setAttribute('aria-labelledby','member-publications-title');dialog.innerHTML=`<h2 id="member-publications-title">${e(person.name)}｜論文與成果</h2><p>此處的新增、編輯與刪除會獨立儲存，不需再按成員表單的儲存。</p><button type="button" class="button secondary" data-close>關閉</button><div data-list></div>`;
     dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();previous?.focus();};document.body.append(dialog);dialog.showModal();
     try{await window.MedMemberPublications.mount({target:dialog.querySelector('[data-list]'),api,path:'manage/people/'+encodeURIComponent(person.id)+'/publications',manage:true,personName:person.name});}catch(error){message(error.message,true);}
   };
   return {value(){
     const profile={...original,enabled:target.querySelector('[data-enabled]').checked,photo_href:photo,doctor_href:target.querySelector('[data-doctor]').value.trim(),links:[]};
     for(const key of Object.keys(limits))profile[key]=target.querySelector(`[data-profile="${key}"]`).value.trim();
     const rows=target.querySelector('[data-links]').value.split('\n').filter(s=>s.trim());if(rows.length>20)throw Error('外部連結最多 20 筆');
     for(const row of rows){const separator=row.indexOf('|');if(separator<1)throw Error('外部連結請使用「名稱 | 網址」');profile.links.push({label:row.slice(0,separator).trim(),href:row.slice(separator+1).trim()});}
     return profile;
   }};
 }
 window.MedMemberProfileEditor={mount};
})();
