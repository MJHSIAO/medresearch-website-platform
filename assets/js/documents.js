/* One catalogue component for the public directory, unit sites and protected intranet. */
(function(){
  'use strict';
  async function render({target,page,D,unitId='',embedded=false,internal=false,base:providedBase}){
    const esc=D.escapeHTML,base=providedBase||new URL((document.body.dataset.root||'.')+'/',location.href);
    const [records,units]=await Promise.all([internal?fetch(new URL('api/internal/documents',base),{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('無法載入院內文件，請重新登入。');return (await response.json()).items;}):D.load('documents'),D.getUnits()]);
    const active=new Set(units.filter(D.publicUnit).map(u=>u.id));active.add('medresearch');
    const docs=records.filter(d=>d.status==='published'&&d.visibility===(internal?'internal':'public')&&active.has(d.owner_unit_id)&&(!unitId||d.owner_unit_id===unitId));
    const unitName=id=>id==='medresearch'?'醫學研究部':units.find(u=>u.id===id)?.name||id;
    const valid=d=>/^(media\/[a-f0-9]{32}\.(pdf|png|jpg)|assets\/documents\/biobank\/[0-9]+\.pdf)$/.test(d.file?.href||'');
    const dateOf=d=>Object.prototype.hasOwnProperty.call(d,'document_date')?d.document_date:d.updated_at;
    const endpoint=d=>new URL('api/documents/'+encodeURIComponent(d.id)+'/download',base);
    const titleTag=embedded?'h2':'h1',cardTag=embedded?'h3':'h2';
    target.classList.add('documents-page');
    target.innerHTML=`<div class="docs-intro"><div><span class="eyebrow">${esc(page.eyebrow||'DOCUMENTS & FORMS')}</span><${titleTag}>${esc(page.title)}</${titleTag}></div>${docs.some(d=>d.is_demo)?'<span class="demo-label">含示意文件，非正式送件資料</span>':''}</div><p class="page-kicker">${esc(page.summary)}</p><div class="docs-tools${unitId?' docs-tools-scoped':''}"><label>搜尋文件<input id="doc-search" type="search" placeholder="輸入名稱或關鍵字"></label>${unitId?'':`<label>負責單位<select id="doc-unit"><option value="">全部單位</option>${[...new Set(docs.map(d=>d.owner_unit_id))].map(id=>`<option value="${esc(id)}">${esc(unitName(id))}</option>`).join('')}</select></label>`}<label>文件類型<select id="doc-kind"><option value="">全部類型</option><option>作業文件</option><option>申請表單</option><option>檢核清單</option></select></label></div><p id="doc-count" role="status"></p><div id="doc-list" class="docs-list"></div><dialog id="doc-dialog" aria-labelledby="doc-dialog-title"><div class="dialog-bar"><strong id="doc-dialog-title">文件預覽</strong><a id="doc-open" target="_blank" rel="noopener">另開檢視</a><button id="doc-close" type="button">關閉 ✕</button></div><p class="doc-preview-help">若瀏覽器未顯示內容，請按「另開檢視」，或關閉預覽後下載文件。</p><iframe id="doc-frame" title="文件內容"></iframe></dialog>`;
    const search=target.querySelector('#doc-search'),unit=target.querySelector('#doc-unit'),kind=target.querySelector('#doc-kind'),list=target.querySelector('#doc-list'),dialog=target.querySelector('#doc-dialog'),frame=target.querySelector('#doc-frame');
    function draw(){const q=search.value.trim().toLocaleLowerCase();const shown=docs.filter(d=>(!unit?.value||d.owner_unit_id===unit.value)&&(!kind.value||d.category===kind.value)&&(!q||`${d.title} ${unitName(d.owner_unit_id)} ${d.summary} ${d.source_note||''}`.toLocaleLowerCase().includes(q))).sort((a,b)=>(dateOf(b)||'').localeCompare(dateOf(a)||''));
      target.querySelector('#doc-count').textContent=`共 ${shown.length} 份文件`;
      list.innerHTML=shown.length?shown.map(d=>`<article class="doc-card"><div class="doc-top"><span class="doc-icon">${esc(d.category)}</span><span>${esc(unitName(d.owner_unit_id))}</span>${d.is_demo?'<span class="demo-label">示意</span>':''}</div><${cardTag}>${esc(d.title)}</${cardTag}><p>${esc(d.summary)}</p>${d.source_note&&!d.summary.includes(d.source_note)?`<p class="doc-source-note">原始來源說明：${esc(d.source_note)}</p>`:''}<div class="doc-meta">${esc(d.version)} · ${dateOf(d)?esc(D.formatDate(dateOf(d))):'日期待確認'} · ${esc(d.file?.type||'')} ${Math.ceil((d.file?.size||0)/1024)} KB</div>${d.source_url&&/^https:\/\//.test(d.source_url)?`<p class="doc-source"><a href="${esc(d.source_url)}" target="_blank" rel="noopener">原官網文件 ↗</a>${d.source_checked_at?` · 來源查核 ${esc(D.formatDate(d.source_checked_at))}`:''}</p>`:''}<div class="doc-actions">${valid(d)?`<button type="button" data-id="${esc(d.id)}">預覽文件</button><a href="${esc(endpoint(d).href)}" download>下載${d.is_demo?'範例':'文件'} ↓</a>`:'<span>檔案暫時無法使用，請聯絡負責單位。</span>'}</div></article>`).join(''):'<p>目前沒有符合條件的已發布文件。</p>';
    }
    const query=new URLSearchParams(location.search);search.value=embedded?'':query.get('q')||'';if(unit)unit.value=query.get('unit')||'';
    search.oninput=draw;if(unit)unit.onchange=draw;kind.onchange=draw;
    let trigger;
    list.onclick=event=>{const button=event.target.closest('button[data-id]');if(!button)return;const d=docs.find(x=>x.id===button.dataset.id);if(!d||!valid(d))return;trigger=button;
      const url=endpoint(d);url.searchParams.set('inline','true');
      target.querySelector('#doc-dialog-title').textContent=d.title;target.querySelector('#doc-open').href=url.href;frame.src=url.href;dialog.showModal();};
    target.querySelector('#doc-close').onclick=()=>dialog.close();dialog.onclose=()=>{frame.removeAttribute('src');trigger?.focus();};draw();
  }
  window.MedDocuments={render};
})();
