/* Shared public document catalogue. Only published public records are rendered. */
(function(){
  'use strict';
  async function render({target,page,D}){
    target.classList.add('documents-page');
    const esc=D.escapeHTML,root=document.body.dataset.root||'.';
    const base=new URL(root+'/',location.href);
    const [records,units]=await Promise.all([D.load('documents'),D.getUnits()]);
    const docs=records.filter(d=>d.status==='published'&&d.visibility==='public');
    const unitName=id=>id==='medresearch'?'醫學研究部':units.find(u=>u.id===id)?.name||id;
    const urlFor=file=>{const path=file?.href||'';return /^(media\/[a-f0-9]{32}\.(pdf|png|jpg)|assets\/documents\/demo\/[a-z-]+\.html)$/.test(path)?new URL(path,base).href:'';};
    target.innerHTML=`<div class="docs-intro"><div><span class="eyebrow">${esc(page.eyebrow||'DOCUMENTS & FORMS')}</span><h1>${esc(page.title)}</h1></div>${docs.some(d=>d.is_demo)?'<span class="demo-label">含示意文件，非正式送件資料</span>':''}</div><p class="page-kicker">${esc(page.summary)}</p><div class="docs-tools"><label>搜尋文件<input id="doc-search" type="search" placeholder="輸入名稱、單位或關鍵字"></label><label>負責單位<select id="doc-unit"><option value="">全部單位</option>${[...new Set(docs.map(d=>d.owner_unit_id))].map(id=>`<option value="${esc(id)}">${esc(unitName(id))}</option>`).join('')}</select></label><label>文件類型<select id="doc-kind"><option value="">全部類型</option><option>作業文件</option><option>申請表單</option><option>檢核清單</option></select></label></div><p id="doc-count" role="status"></p><div id="doc-list" class="docs-list"></div><dialog id="doc-dialog" aria-labelledby="doc-dialog-title"><div class="dialog-bar"><strong id="doc-dialog-title">文件預覽</strong><a id="doc-open" target="_blank" rel="noopener">另開檢視</a><button id="doc-close" type="button">關閉 ✕</button></div><p class="doc-preview-help">若瀏覽器未顯示內容，請按「另開檢視」，或關閉預覽後下載文件。</p><iframe id="doc-frame" title="文件內容"></iframe></dialog>`;
    const search=target.querySelector('#doc-search'),unit=target.querySelector('#doc-unit'),kind=target.querySelector('#doc-kind'),list=target.querySelector('#doc-list'),dialog=target.querySelector('#doc-dialog'),frame=target.querySelector('#doc-frame');
    function draw(){
      const q=search.value.trim().toLocaleLowerCase();
      const shown=docs.filter(d=>(!unit.value||d.owner_unit_id===unit.value)&&(!kind.value||d.category===kind.value)&&(!q||`${d.title} ${unitName(d.owner_unit_id)} ${d.summary}`.toLocaleLowerCase().includes(q)));
      target.querySelector('#doc-count').textContent=`共 ${shown.length} 份文件`;
      list.innerHTML=shown.length?shown.map(d=>{const url=urlFor(d.file);return `<article class="doc-card"><div class="doc-top"><span class="doc-icon">${esc(d.category)}</span><span>${esc(unitName(d.owner_unit_id))}</span>${d.is_demo?'<span class="demo-label">示意</span>':''}</div><h2>${esc(d.title)}</h2><p>${esc(d.summary)}</p><div class="doc-meta">${esc(d.version)} · ${esc(D.formatDate(d.updated_at))} · ${esc(d.file?.type||'')} ${Math.ceil((d.file?.size||0)/1024)} KB</div><div class="doc-actions">${url?`<button type="button" data-id="${esc(d.id)}">預覽文件</button><a href="${esc(url)}" download>下載${d.is_demo?'範例':'文件'} ↓</a>`:'<span>檔案暫時無法使用，請聯絡負責單位。</span>'}</div></article>`;}).join(''):'<p>沒有符合的文件，請調整關鍵字或篩選條件。</p>';
    }
    search.value=new URLSearchParams(location.search).get('q')||'';search.addEventListener('input',draw);unit.addEventListener('change',draw);kind.addEventListener('change',draw);
    list.addEventListener('click',event=>{const b=event.target.closest('button[data-id]');if(!b)return;const d=docs.find(x=>x.id===b.dataset.id);const href=urlFor(d.file);if(!href)return;const url=new URL(href);if(d.file.href.startsWith('media/'))url.searchParams.set('inline','true');target.querySelector('#doc-dialog-title').textContent=d.title;target.querySelector('#doc-open').href=url.href;frame.src=url.href;dialog.showModal();});
    target.querySelector('#doc-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>frame.removeAttribute('src'));draw();
  }
  window.MedDocuments={render};
})();
