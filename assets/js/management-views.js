/* Live management views. No fixture data or client-side role selection. */
(function(){
  'use strict';
  function create({session,base,api,shell,onEdit,onNew,onGrant,onImport,message}){
    const {esc:e,icon,badge,heading,action,table,date}=window.MedManagementShell;
    const workspace=document.getElementById('workspace');
    const names={documents:'文件表單',news:'消息與發布',units:'單位資料',people:'單位成員',pages:'一般內容頁',services:'首頁服務',site:'網站資訊與導覽',theme:'共用外觀設定'};
    const roles={unit_admin:'單位管理員',site_admin:'醫研部總管理員',system_admin:'系統管理員'};
    let ticket=0,current='overview',entries=[],filter='all',query='',grants=[];
    const unitName=shell.unitName;
    const safeUrl=path=>{try{const url=new URL(path,base);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}};
    const editButton=(kind,index)=>`<button type="button" class="edit-button" data-edit="${index}" data-kind="${kind}">編輯</button>`;
    const getContent=async kind=>(await api('manage/content/'+kind)).items;
    function frame(title,description,content,actions=''){shell.frame(title,description,content,actions);}
    function timeSort(a,b){return (Date.parse(b.value.updated_at||b.value.published_at)||0)-(Date.parse(a.value.updated_at||a.value.published_at)||0);}
    function newsRows(items){return items.map(entry=>{const item=entry.value;return `<tr><td><div class="title-cell"><span class="document-icon">${icon('file')}</span><div><div class="message-title" title="${e(item.title)}">${e(item.title)}</div><div class="message-category">${e(item.category||'一般公告')} · ${item.visibility==='internal'?'僅院內':'公開消息'}</div></div></div></td><td class="unit-name">${e(unitName(item.owner_unit_id))}</td><td>${badge(item.status)}</td><td class="date-cell">${e(date(item.updated_at||item.published_at))}</td><td>${editButton('news',entries.indexOf(entry))}</td></tr>`;}).join('');}
    function newsTable(items){return table(['消息內容','所屬單位','狀態','更新日期',''],newsRows(items));}
    function logsHtml(items){return items.length?items.map(item=>`<div class="activity-row"><span class="activity-dot"></span><div><p>${e(item.action)} · ${e(item.id)}</p><small>${e(item.actor)} · ${e(date(item.time,true))}${item.unit?' · '+e(unitName(item.unit)):''}</small></div></div>`).join(''):'<p class="empty">目前沒有操作紀錄。</p>';}
    async function overview(serial){
      const [news,logs,stats]=await Promise.all([getContent('news'),api('manage/audit'),Promise.all([loadAnalytics(),api('manage/analytics')]).then(([,data])=>data).catch(()=>null)]);if(serial!==ticket)return;
      entries=news.sort(timeSort);
      const published=news.filter(i=>i.value.status==='published').length,drafts=news.filter(i=>['draft','pending_review'].includes(i.value.status)).length;
      const metric=(symbol,label,count,unit,note)=>`<article class="metric"><span class="metric-icon">${icon(symbol)}</span><div><div class="metric-label">${label}</div><div class="metric-value">${count}<small>${unit}</small></div><div class="metric-foot">${note}</div></div></article>`;
      const quick=(symbol,title,subtitle,destination)=>`<button type="button" class="quick-action" data-action="${destination}">${icon(symbol)}<span><strong>${title}</strong><small>${subtitle}</small></span><span class="arrow">${icon('arrow')}</span></button>`;
      frame('管理工作台',session.profile.role==='unit_admin'?'維護獲授權單位的消息、內容與成員。':'集中管理消息、單位內容與人員權限。',
        `<section class="metrics" aria-label="管理概況">${metric('file','已發布消息',published,'則','包含授權範圍內已發布的院內外消息')}${metric('clock','草稿待處理',drafts,'則','可接續編輯與發布')}${metric('building','管理單位',session.units.length,'個','目前獲授權的單位範圍')}</section>
        ${stats?window.MedManagementAnalytics.summary(stats):`<section class="panel analytics-summary"><div class="panel-heading"><p>瀏覽統計暫時無法取得。</p>${action('重試統計','analytics','chart',false)}</div></section>`}
        <div class="workspace-grid"><div><section class="panel"><div class="panel-heading"><div><h2>最近更新的消息</h2><p class="panel-subtitle">掌握內容進度，快速接續編輯。</p></div>${action('全部消息','news','arrow',false)}</div>${newsTable(entries.slice(0,4))}<div class="table-footer"><span>顯示最近 ${Math.min(entries.length,4)} 筆，共 ${entries.length} 筆消息</span></div></section><section class="panel activity-panel"><div class="panel-heading"><h2>近期操作</h2>${action('查看紀錄','audit','history',false)}</div>${logsHtml(logs.items.slice(0,3))}</section></div>
        <aside class="side-stack"><section class="panel"><div class="panel-heading"><h2>快速操作</h2></div><div class="quick-actions">${quick('plus','建立新消息','發布公告、活動與研究資訊','new-news')}${quick('building','維護單位資料','更新介紹與聯絡資訊','units')}${shell.valid('grants')?quick('shield','管理人員權限','設定角色與管理單位','grants'):quick('people','維護成員名單','更新本單位公開成員','people')}</div></section><section class="panel scope-panel"><div class="scope-heading">${icon('shield')}目前管理範圍</div><h3>${e(session.label)}</h3><p>${e(shell.scope||'尚無授權單位')}</p><p>${session.profile.role==='unit_admin'?'僅能維護獲授權單位的內容與附件。':session.profile.role==='system_admin'?'可管理全部單位、人員授權與系統設定。':'可跨單位維護內容，並管理單位管理員授權。'}</p></section></aside></div>`,action('新增消息','new-news'));
    }
    function filteredNews(){return entries.filter(entry=>(filter==='all'||entry.value.status===filter)&&`${entry.value.title}${unitName(entry.value.owner_unit_id)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));}
    function updateNews(){const selected=filteredNews();const container=document.getElementById('news-table');if(container)container.innerHTML=newsTable(selected);const count=document.getElementById('news-count');if(count)count.textContent=`顯示 ${selected.length} 筆，共 ${entries.length} 筆消息`;workspace.querySelectorAll('[data-filter]').forEach(button=>{const active=button.dataset.filter===filter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}
    function showNews(){
      frame('消息與發布','從草稿到發布，讓每則消息都清楚有序。',`<section class="panel"><div class="filter-bar"><div class="filter-tabs" aria-label="消息狀態">${[['all','全部消息'],['published','已發布'],['draft','草稿'],['archived','已下架']].map(([v,label])=>`<button type="button" class="filter-tab" data-filter="${v}">${label}</button>`).join('')}</div><label class="search-field">${icon('search')}<input id="news-search" aria-label="搜尋消息標題或單位" placeholder="搜尋標題或單位" value="${e(query)}"></label></div><div id="news-table"></div><div class="table-footer"><span id="news-count"></span></div></section>`,action('匯入舊消息','import-news','upload',false)+action('新增消息','new-news'));
      updateNews();document.getElementById('news-search').oninput=event=>{query=event.target.value;updateNews();};
    }
    function showUnits(){frame('單位資料','維護授權範圍內的單位介紹、服務與聯絡資訊。',`<div class="unit-grid">${entries.map((entry,index)=>{const u=entry.value;return `<article class="unit-card"><div class="unit-card-top"><span class="unit-symbol">${e(u.name.slice(0,1))}</span>${badge(u.status)}</div><div><h2>${e(u.name)}</h2><p>${e(u.short_description||'')}</p></div><div class="unit-card-footer">${editButton('units',index)}${action('管理消息','news','arrow',false)}</div></article>`;}).join('')||'<p class="empty">目前沒有獲授權的單位。</p>'}</div>`);}
    function showPeople(){frame('單位成員','維護各單位的公開成員與職務資訊。',`<section class="panel">${table(['姓名','職務','所屬單位','顯示範圍',''],entries.map((entry,index)=>{const p=entry.value;return `<tr><td>${e(p.name)}</td><td>${e(p.title||'—')}</td><td class="unit-name">${e(unitName(p.unit_id))}</td><td>${e(p.visibility==='internal'?'僅院內':p.visibility==='both'?'院內外':'公開')}</td><td>${editButton('people',index)}</td></tr>`;}).join(''))}</section>`,action('新增成員','new-people'));}
    function showDocuments(){frame('文件表單','新增、上傳與發布文件；草稿與下架項目不會出現在公開網站。',`<section class="panel">${table(['文件名稱','所屬單位','類型／版本','狀態',''],entries.map((entry,index)=>{const d=entry.value;return `<tr><td>${e(d.title)}${d.is_demo?'（示意）':''}</td><td>${e(unitName(d.owner_unit_id))}</td><td>${e(d.category)} · ${e(d.version)}</td><td>${badge(d.status)}</td><td>${editButton('documents',index)}</td></tr>`;}).join(''))}</section>`,action('新增文件','new-documents'));}
    function showRecords(kind){frame(names[kind],'選擇要維護的內容，所有修改皆保存於伺服器。',`<section class="panel">${table(['內容名稱','說明',''],entries.map((entry,index)=>`<tr><td>${e(entry.value.name||entry.value.title||names[kind])}</td><td class="unit-name">${e(entry.value.summary||entry.value.description||'')}</td><td>${editButton(kind,index)}</td></tr>`).join(''))}</section>`);}
    async function showGrants(serial){
      const data=await api('manage/grants');if(serial!==ticket)return;grants=data.items;
      const rows=(data.bootstrap||[]).map(id=>`<tr><td>${e(id)}</td><td>系統管理員</td><td>全部單位</td><td>${badge('active')}</td><td class="date-cell">伺服器保留帳號</td></tr>`).join('')+grants.map((g,index)=>`<tr><td>${e(g.identity)}</td><td>${e(roles[g.role])}</td><td class="unit-name">${e(g.role==='unit_admin'?g.units.map(unitName).join('、'):'全部單位')}</td><td>${badge(g.active?'active':'inactive')}</td><td><button type="button" class="edit-button" data-grant="${index}">調整／停用</button></td></tr>`).join('');
      frame('人員權限','依人員設定角色與管理範圍。',`<section class="panel"><div class="panel-heading"><div><h2>管理人員</h2><p class="panel-subtitle">角色由登入身分決定。${session.profile.role==='site_admin'?'您可維護單位管理員的授權。':'伺服器保留管理員須由維運調整。'}</p></div></div>${table(['員工識別值','角色','管理範圍','狀態',''],rows)}</section>`,action('新增授權','new-grant'));
    }
    async function showMedia(serial){
      const data=await api('manage/files');if(serial!==ticket)return;
      const units=[...session.units];if(session.profile.role!=='unit_admin')units.push({id:'medresearch',name:'醫學研究部'});
      frame('檔案與附件','查看授權範圍內的圖片與文件；消息也可在編輯表單直接上傳。',`<section class="panel upload-panel"><form id="library-upload"><label>所屬單位<select name="unit">${units.map(u=>`<option value="${e(u.id)}">${e(u.name)}</option>`).join('')}</select></label><label>選擇檔案<input type="file" name="file" accept="image/png,image/jpeg,application/pdf" required></label><button type="submit" class="button primary">${icon('upload')}上傳檔案</button><p class="panel-subtitle">PNG、JPEG 或 PDF，每個檔案最多 5 MB。未被發布內容引用的檔案不會公開。</p></form></section><div class="file-grid">${data.items.map(file=>`<article class="file-card"><div class="file-preview">${file.mime.startsWith('image/')?`<img src="${e(safeUrl(file.url))}" alt="${e(file.name)}" loading="lazy">`:icon('file')}</div><div class="file-card-copy"><strong>${e(file.name)}</strong><small>${e(unitName(file.unit))} · ${Math.ceil(file.size/1024)} KB</small><a class="text-link" href="${e(safeUrl(file.url))}" target="_blank" rel="noopener">查看檔案 ${icon('external')}</a></div></article>`).join('')||'<p class="empty">目前沒有上傳檔案。</p>'}</div>`);
      const form=document.getElementById('library-upload');form.onsubmit=async event=>{
        event.preventDefault();const submit=form.querySelector('[type=submit]');const file=form.elements.file.files[0];if(!file)return;
        try{submit.disabled=true;if(file.size>5*1024*1024)throw Error('檔案超過 5 MB');
          const response=await fetch(new URL('api/manage/files/'+encodeURIComponent(form.elements.unit.value),base),{method:'POST',headers:{'Content-Type':file.type,'X-CSRF-Token':session.csrf,'X-File-Name':encodeURIComponent(file.name)},body:file});
          if(!response.headers.get('content-type')?.includes('application/json'))throw Error('上傳服務暫時無法使用，請稍後再試。');
          const result=await response.json();if(!response.ok)throw Error(result.detail||'上傳失敗');
          if(serial!==ticket)return;message('檔案已保存到伺服器。');await render('media',false);
        }catch(error){message(error.message,true);}finally{submit.disabled=false;}
      };
    }
    let analyticsLoading;
    async function loadAnalytics(){
      if(window.MedManagementAnalytics)return;
      if(!analyticsLoading)analyticsLoading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('assets/js/management-analytics.js',base);script.onload=resolve;script.onerror=()=>{analyticsLoading=null;script.remove();reject(Error('統計介面載入失敗，請重新整理。'));};document.head.append(script);});
      await analyticsLoading;
    }
    async function render(id,clear=true,newsFilter){
      if(!shell.valid(id)){message('您沒有此功能的管理權限。',true);return;}
      current=id;const serial=++ticket;filter=newsFilter||'all';query='';shell.select(id);history.replaceState(null,'','#'+id);if(clear)message('');workspace.innerHTML='<p class="empty">正在載入資料…</p>';
      if(id==='overview'){await overview(serial);return;}
      if(id==='analytics'){
        await loadAnalytics();if(serial!==ticket)return;
        frame('瀏覽統計','了解網站使用情況，掌握受到關注的內容。','<div id="management-analytics"></div>');
        await window.MedManagementAnalytics.mount({target:document.getElementById('management-analytics'),api,session,message,isCurrent:()=>serial===ticket});return;
      }
      if(id==='grants'){await showGrants(serial);return;}
      if(id==='media'){await showMedia(serial);return;}
      if(id==='announcements'){
        if(!window.MedAnnouncementManager)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('assets/js/announcement-manager.js',base);script.onload=resolve;script.onerror=()=>reject(Error('公告管理載入失敗，請重新整理。'));document.head.append(script);});
        if(serial!==ticket)return;
        frame('跑馬燈公告','管理全站上方的公告文字；啟用後顯示於前台。','<div id="announcement-manager"></div>');
        await window.MedAnnouncementManager.mount({target:document.getElementById('announcement-manager'),api,message,base,isCurrent:()=>serial===ticket});return;
      }
      if(id==='audit'){const logs=await api('manage/audit');if(serial===ticket)frame('操作紀錄','依管理範圍查看最近 500 筆操作。',`<section class="panel"><div class="panel-heading"><h2>最近操作</h2></div>${logsHtml(logs.items)}</section>`);return;}
      const result=await getContent(id);if(serial!==ticket)return;entries=result;
      if(id==='documents'){entries.sort(timeSort);showDocuments();}
      else if(id==='news'){entries.sort(timeSort);showNews();}
      else if(id==='units')showUnits();else if(id==='people')showPeople();
      else if(['site','theme'].includes(id)&&entries.length)await onEdit(id,entries[0]);else showRecords(id);
    }
    workspace.addEventListener('click',event=>{
      const edit=event.target.closest('[data-edit]'),grant=event.target.closest('[data-grant]'),tab=event.target.closest('[data-filter]');
      if(edit){const entry=entries[Number(edit.dataset.edit)];if(entry)Promise.resolve(onEdit(edit.dataset.kind,entry)).catch(error=>message(error.message,true));return;}
      if(grant){onGrant(grants[Number(grant.dataset.grant)]);return;}
      if(tab){filter=tab.dataset.filter;updateNews();return;}
      const id=event.target.closest('[data-action]')?.dataset.action;if(!id)return;
      if(id==='new-documents'){Promise.resolve(onNew('documents')).catch(error=>message(error.message,true));return;}
      if(id==='new-news'||id==='new-people'){Promise.resolve(onNew(id==='new-news'?'news':'people')).catch(error=>message(error.message,true));return;}
      if(id==='new-grant'){onGrant({identity:'',role:'unit_admin',units:[],active:true});return;}
      if(id==='import-news'){Promise.resolve(onImport()).catch(error=>message(error.message,true));return;}
      render(id).catch(error=>message(error.message,true));
    });
    return {render,invalidate(){return ++ticket;},token:()=>ticket,isCurrent:serial=>serial===ticket,current:()=>current};
  }
  window.MedManagementViews={create};
})();
