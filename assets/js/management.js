(async function () {
  'use strict';
  const base = new URL('../../', document.currentScript.src);
  const workspace = document.getElementById('workspace');
  const status = document.getElementById('status');
  const names = {units:'單位資料',news:'消息與發布',people:'單位成員',pages:'一般內容頁',services:'首頁服務',site:'網站資訊與導覽',theme:'共用外觀設定'};
  const roles = {unit_admin:'單位管理員',site_admin:'醫研部總管理員',system_admin:'系統管理員'};
  let session;
  const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const message = (text, error=false) => {status.textContent=text;status.className=error?'error':'';};
  async function api(path, method='GET', data) {
    const response = await fetch(new URL('api/'+path,base), {method,headers:{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||''},body:data===undefined?undefined:JSON.stringify(data)});
    const result=await response.json();
    if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'操作失敗，請檢查欄位或重新登入。');
    return result;
  }
  function button(label, action, parent=workspace) {const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>Promise.resolve(action()).catch(e=>message(e.message,true));parent.append(b);return b;}
  function field(key,label,value='',type='text'){return `<label>${esc(label)}${type==='textarea'?`<textarea name="${key}">${esc(value)}</textarea>`:`<input name="${key}" type="${type}" value="${esc(value)}">`}</label>`;}
  function options(values,current){return values.map(([v,l])=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(l)}</option>`).join('');}
  function unitOptions(current){const units=[...session.units];if(session.profile.role!=='unit_admin')units.push({id:'medresearch',name:'醫學研究部'});return options(units.map(u=>[u.id,u.name]),current);}
  function submit(form, action){form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');b.disabled=true;try{await action();}catch(err){message(err.message,true);}finally{b.disabled=false;}};}
  async function list(kind){
    const result=await api('manage/content/'+kind); workspace.innerHTML=`<h2>${names[kind]}</h2>`;
    if(['news','people'].includes(kind))button('新增'+(kind==='news'?'消息':'成員'),()=>edit(kind,{value:{id:(kind==='news'?'news-':'person-')+crypto.randomUUID(),...(kind==='news'?{title:'',summary:'',category:'',content:[],visibility:'public',status:'draft',attachments:[],cover_image:'',cover_alt:'',published_at:'',expires_at:''}:{name:'',title:'',bio:'',visibility:'public'})},revision:null}));
    for(const entry of result.items){const row=document.createElement('article');row.className='item';row.innerHTML=`<h3>${esc(entry.value.name||entry.value.title||names[kind])}</h3><p>${esc(entry.value.status||'')} ${esc(entry.value.visibility||'')}</p>`;button('編輯',()=>edit(kind,entry),row);workspace.append(row);}
  }
  async function legacyNews() {
    if (!window.MedLegacyNews) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('assets/js/legacy-news.js', base);
      script.onload = resolve;
      script.onerror = () => reject(Error('無法載入舊消息匯入功能，請重新載入或確認部署。'));
      document.head.append(script);
    });
    // Migration reads existing records only; all new writes use the authenticated API.
    let raw;
    try { raw = window.localStorage.getItem('medresearch_demo_news'); }
    catch { throw Error('瀏覽器禁止讀取舊資料；不影響新版消息保存，請由維運協助取回舊資料。'); }
    const {items, skipped} = window.MedLegacyNews.parse(raw);
    const saved = await api('manage/content/news');
    const existing = new Set(saved.items.map(entry => entry.value.id));
    const authorized = new Set(session.units.map(unit => unit.id));
    if (session.profile.role !== 'unit_admin') authorized.add('medresearch');
    workspace.innerHTML = '<h2>匯入舊消息到伺服器</h2><p>這裡只讀取此瀏覽器原有的舊消息。請先預覽，再匯入為伺服器草稿；確認內容後可於「消息與發布」發布。匯入不會刪除舊資料，也不會自動覆蓋已有消息。</p>';
    if (skipped) { const p=document.createElement('p');p.textContent=`有 ${skipped} 筆格式不完整或重複資料未列入，原資料仍保留。`;workspace.append(p); }
    if (!items.length) { const p=document.createElement('p');p.textContent='這個瀏覽器找不到可匯入的舊消息。請用原本發布時的電腦、瀏覽器及使用者設定檔開啟本管理中心。';workspace.append(p); }
    for (const item of items) {
      const row=document.createElement('article');row.className='item';
      row.innerHTML=`<h3>${esc(item.title)}</h3><p>原消息編號：${esc(item.id)}</p>`;
      if (existing.has(item.id)) { const p=document.createElement('p');p.textContent='伺服器已有此消息，將保留現有內容。';row.append(p); }
      else if (item.owner_unit_id && !authorized.has(item.owner_unit_id)) { const p=document.createElement('p');p.textContent='此消息所屬單位不在您的授權範圍，請由系統管理員處理。';row.append(p); }
      else button('預覽並匯入', () => previewLegacyNews(item), row);
      workspace.append(row);
    }
  }
  function previewLegacyNews(item) {
    const preferred = session.units.some(unit => unit.id === item.owner_unit_id) ||
      (session.profile.role !== 'unit_admin' && item.owner_unit_id === 'medresearch') ? item.owner_unit_id : undefined;
    workspace.innerHTML=`<h2>匯入舊消息：${esc(item.title)}</h2><p>${esc(item.summary || '')}</p>${item.content.map(p=>`<p>${esc(p)}</p>`).join('')}<p>匯入後保留原消息編號及原發布日期，先存為草稿；圖片與附件請在發布前核對，僅有瀏覽器預覽的檔案需要重新上傳。</p><form id="legacy-import"><label>所屬單位<select name="unit">${unitOptions(preferred)}</select></label><button type="submit">匯入為伺服器草稿</button></form>`;
    const form=document.getElementById('legacy-import');
    submit(form,async()=>{
      const result=await api(`manage/content/news/${encodeURIComponent(item.id)}`,'PUT',{
        value:item, unit:form.elements.unit.value, revision:null
      });
      message('舊消息已保存到伺服器，原網址編號保留。請核對內容，再選擇發布。');
      await edit('news',result);
    });
    button('返回舊消息列表',legacyNews);
  }
  async function edit(kind,entry){
    const v=entry.value; const editable={}; const lists={services:'主要業務（每行一項）',goals:'發展目標（每行一項）',research_fields:'研究領域（每行一項）'};
    const labels={name:'名稱',title:'標題',summary:'摘要',short_description:'簡介',full_description:'完整介紹',purpose:'成立宗旨',bio:'簡介',category:'分類',cover_image:'封面圖片路徑',cover_alt:'圖片替代文字',notice:'網站頂端公告',description:'說明',display_order:'排序',published_at:'發布日期',expires_at:'截止日期',accent:'主色（例如 #125c4b）',width:'版面寬度（1100、1200、1320）'};
    let fields='';
    for(const [key,label] of Object.entries(labels)){
      if(!(key in v))continue;
      if(kind==='units'&&session.profile.role==='unit_admin'&&['name','display_order'].includes(key))continue;
      editable[key]=typeof v[key];fields+=field(key,label,v[key],['summary','short_description','full_description','purpose','bio','description'].includes(key)?'textarea':key==='display_order'?'number':'text');
    }
    for(const [key,label] of Object.entries(lists))if(Array.isArray(v[key])&&v[key].every(x=>typeof x==='string'))fields+=field('list_'+key,label,v[key].join('\n'),'textarea');
    if(kind==='units')for(const [key,label] of Object.entries({person:'聯絡窗口',phone:'電話',email:'電子郵件',address:'地址'}))fields+=field('contact_'+key,label,v.contact?.[key]||'');
    if(kind==='news')fields+=field('paragraphs','本文（空白行分段）',(v.content||[]).join('\n\n'),'textarea')+`<label>狀態<select name="status">${options([['draft','草稿'],['published','發布'],['expired','過期'],['archived','下架／封存'],['pending_review','待確認']],v.status)}</select></label>`;
    if(['news','people'].includes(kind))fields+=`<label>顯示範圍<select name="visibility">${options([['public','公開'],['internal','僅院內'],['both','院內外']],v.visibility)}</select></label>`;
    if(kind==='news'&&session.profile.role!=='unit_admin')fields+=`<label><input type="checkbox" name="featured" ${v.featured?'checked':''}>首頁推薦</label>`;
    if(!entry.revision)fields=`<label>所屬單位<select name="unit">${unitOptions()}</select></label>`+fields;
    workspace.innerHTML=`<h2>編輯${names[kind]}</h2><form id="editor">${fields}<details><summary>進階內容欄位（服務、聯絡資料、段落、附件與選單等）</summary><p>保留原有欄位結構；上方表單欄位會覆蓋此處對應值。</p><label>完整內容 JSON<textarea name="advanced" rows="18">${esc(JSON.stringify(v,null,2))}</textarea></label></details><button type="submit">儲存${kind==='news'?'／套用發布狀態':''}</button></form><div id="edit-actions" class="actions"></div><div id="versions"></div>`;
    const form=document.getElementById('editor');
    submit(form,async()=>{
      const value=JSON.parse(form.elements.advanced.value);
      for(const [key,type] of Object.entries(editable))value[key]=type==='number'?Number(form.elements[key].value):form.elements[key].value;
      for(const key of Object.keys(lists))if(form.elements['list_'+key])value[key]=form.elements['list_'+key].value.split('\n').filter(Boolean);
      if(kind==='units')for(const key of ['person','phone','email','address']){value.contact||={};value.contact[key]=form.elements['contact_'+key].value;}
      if(kind==='news'){value.content=form.elements.paragraphs.value.split(/\n\s*\n/).filter(Boolean);value.status=form.elements.status.value;if(form.elements.featured)value.featured=form.elements.featured.checked;}
      if(form.elements.visibility)value.visibility=form.elements.visibility.value;
      const result=await api(`manage/content/${kind}/${encodeURIComponent(v.id)}`,'PUT',{value,revision:entry.revision,unit:form.elements.unit?.value});
      message('已儲存至伺服器。公開內容將於重新載入網站後更新。');await edit(kind,result);
    });
    const actions=document.getElementById('edit-actions');button('返回列表',()=>list(kind),actions);
    if(entry.revision)button('查看歷史版本',async()=>{
      const versions=await api(`manage/history/${kind}/${encodeURIComponent(v.id)}`);const target=document.getElementById('versions');target.innerHTML='<h3>歷史版本</h3><p>先檢視內容，再載入編輯表單並按儲存完成回復。</p>';
      for(const h of versions.items.reverse()){const d=document.createElement('details');d.innerHTML=`<summary>${esc(h.time)}</summary><pre>${esc(JSON.stringify(h.value,null,2))}</pre>`;button('載入此版本',()=>edit(kind,{value:h.value,revision:entry.revision}),d);target.append(d);}
    },actions);
  }
  async function grants(){
    const result=await api('manage/grants');workspace.innerHTML='<h2>人員權限</h2><p>輸入院方驗證欄位對應的員編／識別值，指定角色及單位。儲存後立即生效。</p>';
    button('新增人員授權',()=>grantForm({identity:'',role:'unit_admin',units:[],active:true}));
    for(const id of result.bootstrap){const p=document.createElement('p');p.textContent=`${id}：系統管理員（伺服器保留帳號）`;workspace.append(p);}
    for(const g of result.items){const row=document.createElement('article');row.className='item';row.innerHTML=`<h3>${esc(g.identity)}</h3><p>${roles[g.role]} · ${g.active?'啟用':'停用'} · ${esc(g.units.map(id=>session.units.find(u=>u.id===id)?.name||id).join('、'))}</p>`;button('調整／停用',()=>grantForm(g),row);workspace.append(row);}
  }
  function grantForm(g){
    workspace.innerHTML=`<h2>${g.revision?'調整':'新增'}人員授權</h2><form id="grant">${field('identity','員編／識別值',g.identity)}<label>角色<select name="role">${options(Object.entries(roles).filter(([k])=>session.profile.role==='system_admin'||k==='unit_admin'),g.role)}</select></label><fieldset><legend>管理單位（單位管理員必選，可複選）</legend>${session.units.map(u=>`<label><input type="checkbox" name="units" value="${esc(u.id)}" ${g.units.includes(u.id)?'checked':''}>${esc(u.name)}</label>`).join('')}</fieldset><label><input type="checkbox" name="active" ${g.active?'checked':''}>啟用此授權</label><button type="submit">儲存授權</button></form>`;
    const form=document.getElementById('grant');if(g.revision)form.elements.identity.readOnly=true;
    submit(form,async()=>{await api('manage/grants','PUT',{identity:form.elements.identity.value,role:form.elements.role.value,units:[...form.querySelectorAll('[name=units]:checked')].map(x=>x.value),active:form.elements.active.checked,revision:g.revision||null});message('授權已更新，所有後續操作會立即使用新權限。');await grants();});
    button('返回人員列表',grants);
  }
  function media(){workspace.innerHTML=`<h2>圖片與附件</h2><form id="upload"><label>所屬單位<select name="unit">${unitOptions()}</select></label><label>檔案（PNG、JPEG、PDF，上限 5 MB）<input type="file" name="file" accept="image/png,image/jpeg,application/pdf" required></label><button type="submit">上傳</button></form><p>上傳完成後，將檔案路徑填入封面或附件欄位。未被發布內容引用的檔案不會公開。</p><div id="uploaded"></div>`;
    const form=document.getElementById('upload');submit(form,async()=>{const file=form.elements.file.files[0];if(file.size>5*1024*1024)throw Error('檔案超過 5 MB');const response=await fetch(new URL('api/manage/files/'+form.elements.unit.value,base),{method:'POST',headers:{'Content-Type':file.type,'X-CSRF-Token':session.csrf},body:file});const data=await response.json();if(!response.ok)throw Error(data.detail);document.getElementById('uploaded').textContent=`已上傳：${data.url}。附件格式：${JSON.stringify({name:file.name,href:data.url})}`;message('檔案已保存。');});}
  try{
    for(const [id,path] of [['home',''],['internal','internal'],['logout','auth/logout']])document.getElementById(id).href=new URL(path,base);
    session=await api('manage');document.getElementById('identity').textContent=`${session.profile.identity} · ${session.label}`;
    const tabs=document.getElementById('tabs');
    for(const kind of session.kinds)button(names[kind],()=>list(kind),tabs);
    button('匯入舊消息',legacyNews,tabs);
    if(session.profile.role!=='unit_admin')button('人員權限',grants,tabs);
    button('圖片與附件',media,tabs);button('操作紀錄',async()=>{const result=await api('manage/audit');workspace.innerHTML='<h2>操作紀錄</h2>';for(const a of result.items){const p=document.createElement('p');p.textContent=`${a.time} · ${a.actor} · ${a.action} · ${a.kind}/${a.id}`;workspace.append(p);}},tabs);
    await list('units');
  }catch(error){message(error.message,true);}
})();
