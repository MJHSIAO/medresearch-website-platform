(async function(){
  const base = new URL('../../', document.currentScript.src);
  const documents=document.getElementById('internal-documents');
  window.MedDocuments.render({target:documents,D:window.MedData,base,embedded:true,internal:true,page:{title:'院內文件下載',summary:'僅院內登入人員可查閱；可依單位、類型及關鍵字篩選。'}}).catch(error=>{documents.textContent=error.message;});
  const response = await fetch(new URL('api/internal/news', base));
  const target = document.getElementById('internal-news');
  if (!response.ok) { target.textContent='無法載入院內消息，請重新登入。'; return; }
  const {items}=await response.json();
  target.textContent=items.length?'':'目前沒有院內消息。';
  for(const item of items){const article=document.createElement('article');const title=document.createElement('h3');title.textContent=item.title;article.append(title);
    for(const text of item.content||[]){const p=document.createElement('p');p.textContent=text;article.append(p);}
    for(const file of item.attachments||[]){if(!file.href)continue;const a=document.createElement('a');a.textContent=file.name||'下載附件';a.href=new URL(file.href,base);article.append(a);}
    target.append(article);
  }
})();
