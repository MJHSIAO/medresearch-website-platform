(async function(){
  const base = new URL('../../', document.currentScript.src);
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
