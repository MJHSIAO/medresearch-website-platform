/* Shared public/management publication list; every write is authorized by the server. */
(function(){
  'use strict';
  const e=value=>window.MedData?window.MedData.escapeHTML(value??''):window.MedManagementShell.esc(value);
  function batch(text,category='期刊論文',runs){
    const chunks=text.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
    if(!chunks.length||chunks.length>50)throw Error('每批請貼上 1–50 筆，每筆之間空一行。');
    let offset=0;return chunks.map(citation=>{const start=text.indexOf(citation,offset);offset=start+citation.length;if(Array.from(citation).length>5000)throw Error('每筆成果最多 5000 字，請檢查分段。');return {citation,year:citation.match(/\b(?:18|19|20)\d{2}\b/)?.[0]||'',category,href:'',...(runs?{runs:window.MedMemberText.slice(runs,start,offset)}:{})};});
  }
  async function mount({target,api,path,manage=false,personName='',initial}){
    let page=1,year='',query='',data=initial,busy=false,editing=null;
    target.innerHTML=`<form class="publication-search"><label>搜尋研究成果<input name="q" maxlength="200" type="search" placeholder="標題、作者或期刊"></label><label>年份<select name="year"><option value="">全部年份</option></select></label><button type="submit" class="button secondary">搜尋</button></form><p class="publication-status" role="status"></p><div class="publication-items"></div><nav class="publication-pages" aria-label="成果分頁"><button type="button" class="button secondary" data-page="prev">上一頁</button><span></span><button type="button" class="button secondary" data-page="next">下一頁</button></nav>${manage?`<details class="publication-editor" open><summary>新增／編輯一筆成果</summary><form data-editor><label>研究成果完整引用文字<textarea name="citation" rows="5" required></textarea></label><p data-count role="status">0 / 5000 字</p><div class="profile-fields-grid"><label>年份（選填）<input name="year" inputmode="numeric" maxlength="4" placeholder="例如 2026"></label><label>成果類型<input name="category" value="期刊論文" maxlength="80" required></label></div><label>論文連結（選填）<input name="href" type="url" maxlength="2048" placeholder="https://..."></label><div class="actions"><button class="button" type="submit">儲存成果</button><button class="button secondary" type="button" data-clear>清空／新增另一筆</button></div></form></details><details class="publication-editor"><summary>批次貼上成果</summary><p>每筆引用文字之間空一行，每批最多 50 筆；保留完整文字、粗體及底線。年份會從內容辨識，可在新增後調整。</p><label>成果類型<input data-batch-category maxlength="80" value="期刊論文"></label><label>批次內容<textarea data-batch rows="8"></textarea></label><p data-batch-count role="status"></p><button class="button" type="button" data-import>新增這批成果</button></details>`:''}`;
    const search=target.querySelector('.publication-search'),status=target.querySelector('.publication-status'),list=target.querySelector('.publication-items'),pages=target.querySelector('.publication-pages');
    const form=target.querySelector('[data-editor]');
    const rich=manage?window.MedMemberText.editor({input:form.elements.citation}):null;
    const batchInput=manage?target.querySelector('[data-batch]'):null;
    const batchRich=manage?window.MedMemberText.editor({input:batchInput,limit:250000}):null;
    function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
    function lock(value){busy=value;target.querySelectorAll('button').forEach(b=>{b.disabled=value;});}
    function draw(){
      const selected=search.elements.year.value;
      search.elements.year.innerHTML='<option value="">全部年份</option>'+data.years.map(y=>`<option value="${e(y)}">${e(y)}</option>`).join('');search.elements.year.value=selected;
      list.innerHTML=data.items.length?`<ol start="${(data.page-1)*20+1}">${data.items.map((entry,index)=>{const p=manage?entry.value:entry;return `<li><div class="publication-meta">${p.year?`<span>${e(p.year)}</span>`:''}<span>${e(p.category)}</span></div><p class="publication-citation">${window.MedMemberText.citation(p,data.author_names||[])}</p>${p.href?`<a href="${e(p.href)}" target="_blank" rel="noopener">查看研究成果 ↗</a>`:''}${manage?`<div class="actions"><button type="button" class="button secondary" data-edit="${index}">編輯</button><button type="button" class="button secondary" data-delete="${index}">刪除</button></div>`:''}</li>`;}).join('')}</ol>`:'<p>目前沒有符合條件的成果。</p>';
      pages.querySelector('span').textContent=`第 ${data.page} / ${data.pages} 頁`;
      pages.querySelector('[data-page=prev]').disabled=data.page<=1;pages.querySelector('[data-page=next]').disabled=data.page>=data.pages;
      message(`符合 ${data.total} 筆 · 全部 ${data.all_total} 筆成果`);
    }
    async function load(){data=await api(path+'?'+new URLSearchParams({page:String(page),year,q:query}));page=data.page;draw();}
    async function run(action){if(busy)return;lock(true);try{await action();}catch(error){message(error.message,true);}finally{lock(false);if(data){pages.querySelector('[data-page=prev]').disabled=data.page<=1;pages.querySelector('[data-page=next]').disabled=data.page>=data.pages;}}}
    search.onsubmit=event=>{event.preventDefault();query=search.elements.q.value;year=search.elements.year.value;page=1;run(load);};
    pages.onclick=event=>{const button=event.target.closest('[data-page]');if(!button||button.disabled)return;page+=button.dataset.page==='next'?1:-1;run(load);};
    function clear(){editing=null;form.reset();form.elements.category.value='期刊論文';rich.set([]);form.elements.citation.dispatchEvent(new Event('input'));}
    async function confirmDelete(p){
      const dialog=document.createElement('dialog');dialog.className='file-picker publication-confirm';dialog.innerHTML=`<h2>刪除成果</h2><p>確定移除「${e(personName)}」的這筆成果？只影響此筆成果，不會刪除成員。</p><p>${e(p.citation.slice(0,160))}</p><div class="actions"><button type="button" class="button secondary" data-cancel autofocus>取消</button><button type="button" class="button" data-confirm>確認刪除</button></div>`;document.body.append(dialog);
      const previous=document.activeElement;return new Promise(resolve=>{dialog.onclose=()=>{const answer=dialog.returnValue==='yes';dialog.remove();previous?.focus();resolve(answer);};dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-confirm]').onclick=()=>dialog.close('yes');dialog.showModal();});
    }
    if(manage){
      form.elements.citation.oninput=()=>{const count=Array.from(form.elements.citation.value).length;target.querySelector('[data-count]').textContent=`${count} / 5000 字`;};
      form.onsubmit=event=>{event.preventDefault();if(!rich.validate())return;run(async()=>{const value={...Object.fromEntries(new FormData(form)),runs:rich.get()};if(editing)await api(path+'/'+encodeURIComponent(editing.value.id),'PUT',{value,revision:editing.revision});else await api(path,'POST',{items:[value]});clear();await load();message('成果已儲存。');});};
      target.querySelector('[data-clear]').onclick=clear;
      target.querySelector('[data-batch]').oninput=event=>{try{const items=batch(event.target.value,target.querySelector('[data-batch-category]').value);target.querySelector('[data-batch-count]').textContent=`準備新增 ${items.length} 筆`; }catch(error){target.querySelector('[data-batch-count]').textContent=error.message;}};
      target.querySelector('[data-import]').onclick=()=>run(async()=>{const items=batch(target.querySelector('[data-batch]').value,target.querySelector('[data-batch-category]').value,batchRich.get());await api(path,'POST',{items});batchRich.set([]);target.querySelector('[data-batch-count]').textContent='';await load();message(`已新增 ${items.length} 筆成果。`);});
      list.onclick=event=>{const edit=event.target.closest('[data-edit]'),remove=event.target.closest('[data-delete]');if(edit&&!busy){editing=data.items[Number(edit.dataset.edit)];for(const key of ['year','category','href'])form.elements[key].value=editing.value[key]||'';rich.set(editing.value.runs?.length?editing.value.runs:[{text:editing.value.citation}]);form.elements.citation.dispatchEvent(new Event('input'));target.querySelector('.publication-editor').open=true;rich.focus();}if(remove)run(async()=>{const entry=data.items[Number(remove.dataset.delete)];if(await confirmDelete(entry.value)){await api(path+'/'+encodeURIComponent(entry.value.id),'DELETE',{revision:entry.revision});if(editing?.value.id===entry.value.id)clear();await load();message('成果已移除。');}});};
    }
    if(data)draw();else await run(load);
  }
  window.MedMemberPublications={mount,batch};
})();
