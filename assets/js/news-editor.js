/* A focused message form. Data and uploads are saved through authenticated APIs. */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const categories = ['一般公告','研究服務','課程活動','儀器設備','研究成果','研究誠信','研討會','課程資訊'];
  const labels = {draft:'草稿',published:'已發布',expired:'過期',archived:'已下架',pending_review:'待確認'};
  function day(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get = type => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function publicationDate(selected, original, action, now = new Date().toISOString()) {
    if (original && day(original) === selected) return original;
    if (!selected || (!original && selected === day(now))) return action === 'published' ? now : '';
    return `${selected}T00:00:00+08:00`;
  }
  function buildValue(original, fields, files, cover, action, now) {
    for (const key of ['title','summary','paragraphs']) {
      if (!String(fields[key] || '').trim()) throw Error('請填寫標題、摘要與本文。');
    }
    return {...original, title:fields.title.trim(),summary:fields.summary.trim(),
      content:fields.paragraphs.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean),
      category:fields.category,visibility:fields.visibility,status:action,
      published_at:publicationDate(fields.published_at, original.published_at, action, now),
      expires_at:fields.expires_at === day(original.expires_at) ? (original.expires_at || '') : fields.expires_at,
      event_date:fields.event_date === day(original.event_date) ? (original.event_date || '') : fields.event_date,
      attachments:files.map(file => ({...file})), cover_image:cover.src,
      cover_alt:cover.src ? (fields.cover_alt.trim() || `${fields.title.trim()}相關圖片`) : (original.cover_image ? '' : (original.cover_alt || '')),
      ...(typeof fields.featured === 'boolean' ? {featured:fields.featured} : {})};
  }
  const selectOptions = (values, selected) => values.map(([v, text]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(text)}</option>`).join('');
  function isImage(file) { return /^image\/(png|jpeg)$/.test(file.mime || '') || /\.(png|jpe?g)(?:[?#]|$)/i.test(file.href || ''); }
  function mount({target,entry,session,base,api,message,onSaved,onBack,onHistory}) {
    const original = entry.value;
    const attachments = (original.attachments || []).map(file => ({...file}));
    const cover = {src:original.cover_image || ''};
    const units = [...session.units];
    if (session.profile.role !== 'unit_admin') units.push({id:'medresearch',name:'醫學研究部'});
    const chosen = original.owner_unit_id || units[0]?.id;
    const ownerName = units.find(unit => unit.id === chosen)?.name || '原所屬單位';
    const category = original.category || '一般公告';
    const choices = [...new Set([...categories, category])];
    const published = original.status === 'published';
    const publishLabel = published ? '發布更新' : '發布';
    const draftLabel = published ? '轉為草稿（停止公開）' : '儲存草稿';
    const publication = original.published_at && !day(original.published_at) ? original.published_at : '';
    target.innerHTML = `<h2>${entry.revision ? '編輯消息' : '新增消息'}</h2><p>目前狀態：${labels[original.status] || '草稿'}。請填寫標題、摘要與本文，其餘項目可選擇或留用預設值。</p>
      <form id="news-editor">
        <div class="grid"><label>所屬單位${entry.revision ? `<input value="${esc(ownerName)}" readonly>` : `<select name="unit">${selectOptions(units.map(u=>[u.id,u.name]),chosen)}</select>`}</label>
        <label>分類<select name="category">${selectOptions(choices.map(c=>[c,c]),category)}</select></label></div>
        <label>標題 <span aria-hidden="true">*</span><input name="title" required value="${esc(original.title)}"></label>
        <label>摘要 <span aria-hidden="true">*</span><textarea name="summary" rows="3" required>${esc(original.summary)}</textarea></label>
        <label>本文 <span aria-hidden="true">*</span><textarea name="paragraphs" rows="10" required aria-describedby="paragraph-help">${esc((original.content || []).join('\n\n'))}</textarea></label>
        <small id="paragraph-help">段落之間留一個空白行。</small>
        <fieldset><legend>上傳圖片／檔案及附件（選填）</legend>
          <label>選擇檔案<input type="file" name="files" multiple accept="image/png,image/jpeg,application/pdf" aria-describedby="upload-help"></label>
          <small id="upload-help">可多選 PNG、JPEG 或 PDF，每個檔案上限 5 MB。選取後上傳，儲存消息時一併附加。</small>
          <div id="news-files"></div>
        </fieldset>
        <fieldset><legend>消息列表預覽圖片（選填）</legend><p>可從已上傳的圖片選擇；不選也可以發布。</p><div id="news-cover"></div>
          <label id="cover-description">圖片說明<input name="cover_alt" value="${esc(original.cover_alt)}" aria-describedby="cover-help"><small id="cover-help">供無法看見圖片的讀者了解內容，例如「活動海報」。未填時使用消息標題作為基本說明。</small></label>
        </fieldset>
        <div class="grid"><label>發布日期<input name="published_at" type="date" value="${esc(day(original.published_at) || day(new Date().toISOString()))}"><small>預設今天；可用日曆選擇。此欄是顯示日期，不提供預約發布。</small></label>
        <label>截止日期（選填）<input name="expires_at" type="date" value="${esc(day(original.expires_at))}"><small>留空表示不設期限。</small></label></div>
        ${publication ? '<p class="error">原發布日期格式無法辨識，請在儲存前重新選擇日期。</p>' : ''}
        <details><summary>其他發布設定</summary><label>顯示範圍<select name="visibility">${selectOptions([['public','公開網站'],['internal','僅院內'],['both','院內外皆顯示']],original.visibility || 'public')}</select></label>
          <label>活動日期（選填）<input name="event_date" type="date" value="${esc(day(original.event_date))}"></label>
          ${session.profile.role !== 'unit_admin' ? `<label><input type="checkbox" name="featured"${original.featured ? ' checked' : ''}>首頁推薦</label>` : ''}
        </details>
        <div class="actions">${published ? `<button type="submit" name="action" value="published">${publishLabel}</button><button type="submit" name="action" value="draft">${draftLabel}</button>` : `<button type="submit" name="action" value="draft">${draftLabel}</button><button type="submit" name="action" value="published">${publishLabel}</button>`}
          ${entry.revision && ['published','expired'].includes(original.status) ? '<button type="submit" name="action" value="archived">下架</button>' : ''}
          <button type="button" id="news-back">返回列表</button>
        </div>
      </form><div id="news-history"></div>`;
    const form = target.querySelector('#news-editor');
    const fileList = target.querySelector('#news-files');
    const coverBox = target.querySelector('#news-cover');
    const coverDescription = target.querySelector('#cover-description');
    let busy = false;
    const active = () => target.querySelector('#news-editor') === form;
    const safeUrl = path => { if(typeof path!=='string'||!path)return '';try { const url=new URL(path,base);return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
    function control(label, action, parent) {
      const b=document.createElement('button');b.type='button';b.textContent=label;
      b.onclick=()=>Promise.resolve().then(action).catch(error=>message(error.message,true));b.disabled=busy;parent.append(b);return b;
    }
    function drawCover() {
      coverBox.replaceChildren();
      coverDescription.hidden=!cover.src;
      if (!cover.src) { coverBox.textContent='未選擇預覽圖片';return; }
      const img=document.createElement('img');img.src=safeUrl(cover.src);img.alt='選定的預覽圖片';img.className='news-edit-thumbnail';coverBox.append(img);
      control('不使用預覽圖片',()=>{cover.src='';drawCover();},coverBox);
    }
    function drawFiles() {
      fileList.replaceChildren();
      for (const [index,file] of attachments.entries()) {
        const row=document.createElement('div');row.className='news-edit-file';
        if(isImage(file) && file.href) { const img=document.createElement('img');img.src=safeUrl(file.href);img.alt=file.name || '上傳圖片';img.className='news-edit-thumbnail';row.append(img); }
        const text=document.createElement('span');text.textContent=file.name || '既有附件';row.append(text);
        if(file.href && safeUrl(file.href)) { const link=document.createElement('a');link.href=safeUrl(file.href);link.textContent='查看檔案';link.target='_blank';link.rel='noopener';row.append(link); }
        if(isImage(file) && file.href) control('用作列表預覽',()=>{cover.src=file.href;if(!form.elements.cover_alt.value.trim())form.elements.cover_alt.value=form.elements.title.value.trim() || file.name || '消息圖片';drawCover();},row);
        control('移除此附件',()=>{attachments.splice(index,1);drawFiles();message('附件已從表單移除，儲存消息後生效。');},row);
        fileList.append(row);
      }
    }
    function setBusy(value) {
      busy=value;
      for(const input of form.querySelectorAll('button,input[type=file],select[name=unit]')) input.disabled=value;
      for(const button of fileList.querySelectorAll('button'))button.disabled=value;
      for(const button of coverBox.querySelectorAll('button'))button.disabled=value;
    }
    form.elements.files.onchange = async () => {
      const files=[...form.elements.files.files];
      if(!files.length)return;
      const unit=entry.revision ? original.owner_unit_id : form.elements.unit.value;
      setBusy(true);
      let failed=false;
      for(const file of files) {
        try {
          if(file.size>5*1024*1024)throw Error('檔案超過 5 MB');
          const mime=file.type || (/\.pdf$/i.test(file.name)?'application/pdf':/\.png$/i.test(file.name)?'image/png':/\.jpe?g$/i.test(file.name)?'image/jpeg':'');
          if(!['image/png','image/jpeg','application/pdf'].includes(mime))throw Error('只支援 PNG、JPEG 或 PDF');
          const response=await fetch(new URL(`api/manage/files/${encodeURIComponent(unit)}`,base),{method:'POST',headers:{'Content-Type':mime,'X-CSRF-Token':session.csrf,'X-File-Name':encodeURIComponent(file.name)},body:file});
          if(!response.headers.get('content-type')?.includes('application/json'))throw Error(response.status===413?'檔案超過伺服器允許的上傳大小。':'上傳服務暫時無法使用，請稍後再試。');
          const result=await response.json();
          if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'上傳失敗');
          attachments.push({name:file.name,href:result.url,type:mime==='application/pdf'?'PDF':mime==='image/png'?'PNG':'JPEG',mime,size:`${Math.ceil(file.size/1024)} KB`});
        } catch(error) { failed=true;if(active())message(`${file.name}：${error.message}`,true); }
      }
      if(!active())return;
      setBusy(false);form.elements.files.value='';drawFiles();
      if(!failed)message('檔案已上傳，請儲存草稿或發布以附加到消息。');
    };
    form.onsubmit=async event=>{
      event.preventDefault();
      if(busy)return;
      const action=event.submitter?.value || (published?'published':'draft');
      const fields=Object.fromEntries(['title','summary','paragraphs','category','visibility','published_at','expires_at','event_date','cover_alt'].map(key=>[key,form.elements[key].value]));
      if(form.elements.featured)fields.featured=form.elements.featured.checked;
      try {
        const value=buildValue(original,fields,attachments,cover,action);
        const unit=entry.revision?original.owner_unit_id:form.elements.unit.value;
        setBusy(true);
        const result=await api(`manage/content/news/${encodeURIComponent(original.id)}`,'PUT',{value,revision:entry.revision,unit});
        if(!active())return;
        message(action==='published'?'消息已發布並保存到伺服器。':action==='archived'?'消息已下架。':'草稿已保存到伺服器。');
        await onSaved(result);
      } catch(error) { if(active())message(error.message,true); }
      finally { if(active())setBusy(false); }
    };
    target.querySelector('#news-back').onclick=()=>Promise.resolve().then(onBack).catch(error=>message(error.message,true));
    drawFiles();drawCover();
    if(entry.revision)control('查看歷史版本',onHistory,target.querySelector('#news-history'));
  }
  window.MedNewsEditor = {mount,day,publicationDate,buildValue};
})();
