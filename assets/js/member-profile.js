(function(){
 'use strict';
 const D=window.MedData,e=D.escapeHTML;
 function safeLink(href){try{const url=new URL(href,location.href);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}}
 function render(person,unit,count){
   const profile=person.profile,sections=[['introduction','個人介紹'],['positions','現職'],['research_fields','研究領域／專長'],['education','學歷'],['experience','經歷'],['achievements','研究成果／榮譽／專利']].filter(([key])=>profile[key]?.trim());
   const back=safeLink(unit.href)||'content-page.html?page=department-about';
   const links=(profile.links||[]).filter(l=>safeLink(l.href));
   return `<header class="member-profile-hero"><div>${profile.photo_href?`<img class="member-portrait" src="${e(safeLink(profile.photo_href))}" alt="${e(person.name)}的照片">`:`<span class="member-monogram" aria-hidden="true">${e(Array.from(person.name)[0])}</span>`}</div><div><p class="eyebrow">${e(unit.name)}</p><h1>${e(person.name)}</h1>${profile.english_name?`<p class="member-english">${e(profile.english_name)}</p>`:''}<p class="member-role">${e(person.title)}</p>${person.bio?`<p>${e(person.bio)}</p>`:''}${profile.email?`<p>電子郵件：${e(profile.email)}</p>`:''}${profile.phone?`<p>電話／分機：${e(profile.phone)}</p>`:''}<div class="button-row"><a class="button secondary" href="${e(back)}">返回成員列表</a>${profile.doctor_href&&safeLink(profile.doctor_href)?`<a class="button secondary" href="${e(profile.doctor_href)}" target="_blank" rel="noopener">院方醫師介紹 ↗</a>`:''}</div></div></header><nav class="member-section-nav" aria-label="個人介紹目錄">${sections.map(([key,label])=>`<a href="#member-${key}">${label}</a>`).join('')}${count?'<a href="#member-publications">論文與成果</a>':''}</nav><div class="member-profile-sections">${sections.map(([key,label])=>`<section id="member-${key}" class="card"><h2>${label}</h2>${key==='introduction'?`<p class="member-long-text">${e(profile[key])}</p>`:`<ul>${profile[key].split('\n').filter(s=>s.trim()).map(s=>`<li>${e(s)}</li>`).join('')}</ul>`}</section>`).join('')}${count?'<section id="member-publications" class="card"><h2>論文與成果</h2><div id="member-publication-list"></div></section>':''}${links.length?`<section class="card"><h2>相關連結</h2><ul>${links.map(l=>`<li><a href="${e(l.href)}" target="_blank" rel="noopener">${e(l.label)} ↗</a></li>`).join('')}</ul></section>`:''}</div>`;
 }
 document.addEventListener('DOMContentLoaded',async()=>{
   const host=document.getElementById('member-profile-body');if(!host)return;
   const identifier=new URLSearchParams(location.search).get('id');
   async function api(path){const response=await fetch('api/'+path,{cache:'no-store'});if(!response.ok)throw Error(response.status===404?'找不到公開的成員介紹。':'目前無法載入成員資料，請稍後再試。');return response.json();}
   try{
     if(!identifier)throw Error('請從成員列表選擇人員。');
     const path='people/'+encodeURIComponent(identifier);const [data,pubs]=await Promise.all([api(path),api(path+'/publications')]);
     host.innerHTML=render(data.person,data.unit,pubs.all_total);document.title=data.person.name+'｜成員介紹｜醫學研究部';document.querySelector('[data-member-name]').textContent=data.person.name;
     const target=document.getElementById('member-publication-list');if(target)await window.MedMemberPublications.mount({target,api,path:path+'/publications',initial:pubs});
   }catch(error){host.replaceChildren();const p=document.createElement('p');p.className='empty-state';p.textContent=error.message;host.append(p);const a=document.createElement('a');a.href='content-page.html?page=department-about';a.textContent='返回部門介紹';host.append(a);}
 });
 window.MedMemberProfile={render};
})();
