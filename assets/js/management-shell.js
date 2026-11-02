/* Presentation helpers; permissions always come from the authenticated server. */
(function(){
  'use strict';
  const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    file:'M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Zm0 0v7h7M7 13h10M7 17h7',
    building:'M4 21V5h10v16M14 10h6v11M8 9h2M8 13h2M8 17h2M17 14h1M17 18h1M2 21h20',
    people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    image:'M3 3h18v18H3Zm5 5h.01M21 15l-5-5L5 21',shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7Zm-4 9 3 3 5-5',
    history:'M3 11a9 9 0 1 1 2.4 7.1M3 4v7h7M12 7v5l3 2',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
    external:'M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    plus:'M12 5v14M5 12h14',arrow:'M5 12h14M14 7l5 5-5 5',menu:'M4 6h16M4 12h16M4 18h16',search:'M21 21l-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14',
    upload:'M12 16V3M7 8l5-5 5 5M4 16v5h16v-5',clock:'M12 8v4l3 2M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.file}"></path></svg>`;
  const labels={draft:'草稿',published:'已發布',expired:'過期',archived:'已下架',pending_review:'待確認',active:'使用中',inactive:'停用'};
  function badge(value){return `<span class="status-badge ${esc(value)}">${esc(labels[value]||value||'—')}</span>`;}
  function heading(title,description,actions=''){return `<section class="page-heading"><div><div class="eyebrow">MEDICAL RESEARCH ADMINISTRATION</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="heading-actions">${actions}</div></section>`;}
  function action(label,id,symbol='plus',primary=true){return `<button type="button" class="button${primary?' primary':''}" data-action="${esc(id)}">${icon(symbol)}${esc(label)}</button>`;}
  function table(headers,rows){return `<div class="table-container"><table class="data-table"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty">目前沒有資料。</td></tr>`}</tbody></table></div>`;}
  function date(value,withTime=false){if(!value)return '—';const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))return value;return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',...(withTime?{hour:'2-digit',minute:'2-digit',hour12:false}:{})}).format(parsed);}
  function navItems(session){
    const items=[{id:'overview',label:'工作台',icon:'home'}];
    for(const [id,label,symbol] of [['news','消息與發布','file'],['units','單位資料','building'],['people','單位成員','people']])if(session.kinds.includes(id))items.push({id,label,icon:symbol});
    items.push({id:'media',label:'檔案與附件',icon:'image'});
    for(const [id,label] of [['pages','一般內容頁'],['services','首頁服務']])if(session.kinds.includes(id))items.push({id,label,icon:'file'});
    if(['site_admin','system_admin'].includes(session.profile.role))items.push({id:'grants',label:'人員權限',icon:'shield',group:'管理設定'});
    items.push({id:'audit',label:'操作紀錄',icon:'history'});
    if(session.kinds.includes('site'))items.push({id:'site',label:'網站資訊與導覽',icon:'settings'});
    if(session.profile.role==='system_admin'&&session.kinds.includes('theme'))items.push({id:'theme',label:'共用外觀設定',icon:'settings'});
    return items;
  }
  function create(session,base,onNavigate){
    const items=navItems(session),nav=document.getElementById('primary-nav');
    const own=session.profile.role==='unit_admin',scope=own?session.units.map(u=>u.name).join('、'):'全部單位';
    document.getElementById('role-label').textContent=session.label;
    document.getElementById('unit-label').textContent=scope||'尚無授權單位';document.getElementById('unit-label').title=scope;
    document.getElementById('scope-label').textContent=own?'僅限獲授權的單位':'跨單位管理範圍';
    document.getElementById('identity').textContent=session.label;
    nav.innerHTML=items.map(item=>`${item.group?`<div class="nav-group-label">${item.group}</div>`:''}<button type="button" class="nav-item" data-route="${item.id}">${icon(item.icon)}<span>${item.label}</span></button>`).join('');
    for(const [id,path] of [['home',''],['internal','internal'],['logout','auth/logout']])document.getElementById(id).href=new URL(path,base);
    document.querySelectorAll('[data-icon]').forEach(node=>{node.innerHTML=icon(node.dataset.icon);});
    const sidebar=document.getElementById('sidebar'),shade=document.getElementById('sidebar-shade'),toggle=document.getElementById('menu-toggle');
    function close(){const inside=sidebar.contains(document.activeElement);sidebar.classList.remove('open');shade.classList.remove('visible');toggle.setAttribute('aria-expanded','false');sidebar.inert=innerWidth<=800;if(inside&&sidebar.inert)toggle.focus();}
    toggle.onclick=()=>{const open=sidebar.classList.toggle('open');shade.classList.toggle('visible',open);toggle.setAttribute('aria-expanded',String(open));sidebar.inert=!open&&innerWidth<=800;if(open)nav.querySelector('.active')?.focus();};
    shade.onclick=close;document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    window.addEventListener('resize',()=>{if(innerWidth>800)close();else sidebar.inert=!sidebar.classList.contains('open');});
    close();
    nav.onclick=event=>{const id=event.target.closest('[data-route]')?.dataset.route;if(id){close();onNavigate(id);}};
    const unitName=id=>id==='medresearch'?'醫學研究部':session.units.find(u=>u.id===id)?.name||id||'—';
    return {items,scope,unitName,
      select(id){const current=items.find(item=>item.id===id);nav.querySelectorAll('[data-route]').forEach(button=>{const active=button.dataset.route===id;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});document.getElementById('breadcrumb-current').textContent=current?.label||'消息匯入';close();},
      valid:id=>items.some(item=>item.id===id),
      frame(title,description,html,actions=''){document.getElementById('workspace').innerHTML=heading(title,description,actions)+html;}
    };
  }
  window.MedManagementShell={esc,icon,badge,heading,action,table,date,create};
})();
