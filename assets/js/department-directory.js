(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const url = (page, extra = '') => `content-page.html?page=${page}${extra}`;
  const supervisedUrl = id => url('governance', '&supervised=' + encodeURIComponent(id));
  async function prepare(page) {
    if (!['department-about','governance'].includes(page.id)) return page;
    document.body.classList.add('department-layout');
    const chart = await window.MedData.load('organization');
    const publicEntries = chart.supervised.filter(n => window.MedData.isPublic(n));
    const cards = publicEntries.map(n => {
      const legacyIndex=page.id==='governance'?page.groups[0]?.cards.findIndex(c=>c.title===n.label):-1;
      return {title:n.label,text:n.summary,tag:'業務督導・非隸屬編制',anchor_id:'supervised-'+n.id,legacy_anchor_ids:legacyIndex>=0?['governance-card-1-'+(legacyIndex+1)]:[],actions:[{label:'閱讀單位介紹',href:supervisedUrl(n.id)}]};
    });
    const group = {id:'department-supervised',title:'督導單位',text:'依醫學研究部組織架構，以下七個單位屬業務督導範圍，與隸屬單位分開呈現。',layout:'supervised-directory',cards};
    if (page.id === 'department-about') {
      // Respect the shared parent/public filter: never restore a hidden department.
      if (!page.groups.length) return page;
      return {...page,groups:[...page.groups.map((g,i)=>g.cards.some(c=>c.icon_unit_id)?{...g,legacy_anchor_id:g.id||`resource-group-${i+1}`,id:'department-units',layout:'unit-directory',text:'研究行政、實驗資源與臨床應用，共同支持研究發展。'}:g),group]};
    }
    const selected = params.get('supervised');
    if (!selected) {
      const existing=page.groups[0]?.cards||[];
      const additional=existing.filter(c=>!chart.supervised.some(n=>n.label===c.title));
      return {...page,title:'督導單位',eyebrow:'Research Governance',summary:'認識七個督導單位的任務與公開資訊，查找研究倫理、受試者保護、動物照護及生物安全相關入口。',groups:[{...group,id:'resource-group-1',cards:[...cards,...additional]},...page.groups.slice(1)]};
    }
    const entry = publicEntries.find(n=>n.id===selected);
    if (!entry) return {...page,title:'找不到單位介紹',summary:'請返回督導單位列表選擇公開單位。',groups:[{title:'單位列表',cards:[{title:'督導單位',text:'查看七個督導單位。',actions:[{label:'返回列表',href:url('governance')}]}]}]};
    return {...page,title:entry.label,eyebrow:'Research Governance',summary:entry.summary,source_url:entry.source_url,source_checked_at:entry.source_checked_at,groups:[
      {id:'supervised-introduction',title:'單位介紹',layout:'supervised-detail',cards:[{title:'定位與宗旨',text:entry.introduction,actions:[]},{title:'主要任務',text:'依原官網公開介紹整理。',items:entry.responsibilities,actions:[]}]},
      {id:'supervised-source',title:'相關資訊與來源',layout:'supervised-detail',cards:[{title:'公開資訊',text:entry.source_note+' 原頁更新：'+entry.source_updated_at+'；本次查核：'+entry.source_checked_at+'。',actions:[{label:'查看原官網',href:entry.source_url},...(entry.resource_links||[])]},{title:'繼續瀏覽',text:'返回督導單位列表，或查看醫學研究部的組織與隸屬單位。',actions:[{label:'督導單位列表',href:url('governance')},{label:'返回部門介紹',href:url('department-about','#department-supervised')}]}]}
    ]};
  }
  function finish(target,page) {
    if (!['department-about','governance'].includes(page.id)) return;
    if(page.id==='department-about') target.querySelector('.resource-header').insertAdjacentHTML('beforeend','<nav class="department-section-nav" aria-label="部門介紹快速導覽"><a href="#department-units">隸屬單位</a><a href="#department-supervised">督導單位</a></nav>');
    document.title=`${page.title}｜醫學研究部`;
    document.querySelectorAll('[data-page-title]').forEach(n=>{n.textContent=page.title;});
    if(location.hash)requestAnimationFrame(()=>{const node=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(node){node.tabIndex=-1;node.focus({preventScroll:true});node.scrollIntoView({block:'start'});}});
  }
  window.MedDepartmentDirectory={prepare,finish,supervisedUrl};
})();
