(function () {
  'use strict';

  const cache = new Map();
  const root = () => document.body.dataset.root || '.';
  async function load(name) {
    if (cache.has(name)) return cache.get(name);
    const response = await fetch(`${root()}/data/${name}.json`);
    if (!response.ok) throw new Error(`無法載入 ${name} 資料`);
    const value = await response.json();
    cache.set(name, value);
    return value;
  }

  async function getUnits() { return await load('units'); }
  async function getUnit(id = 'ai-center') {
    const units = await getUnits();
    return units.find(unit => unit.id === id || unit.slug === id);
  }
  async function getNews() { return await load('news'); }

  function isPublic(item) {
    return ['public', 'both'].includes(item.visibility) &&
      (!item.status || ['active', 'published', 'expired'].includes(item.status));
  }

  function publicUnit(unit) {
    return unit.id !== 'medresearch' && isPublic(unit) && unit.status === 'active';
  }

  function publicNews(items, includeExpired = true) {
    return items.filter((item) => isPublic(item) && (item.status === 'published' || (includeExpired && item.status === 'expired')));
  }

  function escapeHTML(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function resolveUnitCards(page, units, people) {
    if(page.id==='department-about' && people){
      const department=units.find(u=>u.id==='medresearch'&&isPublic(u)&&u.status==='active');
      if(!department)return {...page,summary:'目前未公開本部資料。',sections:[],groups:[]};
      const members=people.filter(p=>p.unit_id==='medresearch'&&isPublic(p)).sort((a,b)=>(a.display_order??0)-(b.display_order??0));
      const card=p=>({title:p.name,text:p.bio||'',tag:p.title||'',actions:p.profile_href?[{label:'查看公開介紹',href:p.profile_href}]:[],contact:''});
      const leaders=members.filter(p=>p.department_group==='leadership');
      const others=members.filter(p=>p.department_group!=='leadership');
      const original=page.groups||[];
      const organisation=original.find(g=>g.title==='組織與主管');
      const preserved=(organisation?.cards||[]).filter(c=>!c.person_id&&!['研究副院長','部主任'].includes(c.tag));
      page={...page,summary:department.short_description,
        sections:[{title:'本部簡介',content:department.full_description},{title:'本部執掌',content:department.purpose},{title:'發展目標',content:(department.goals||[]).join('；')}],
        groups:[{title:'本部介紹',text:department.full_description,cards:[{title:'本部執掌',text:department.purpose,actions:[]},{title:'發展目標',text:(department.goals||[]).join('；'),actions:[]}]},
          {title:'組織與主管',text:'',cards:[...leaders.map(card),...preserved]},
          {id:'department-members',title:'本部成員',text:'',cards:others.map(card)},
          ...original.filter(g=>!['本部介紹','組織與主管','本部成員'].includes(g.title))]};
    }
    return {...page, groups:(page.groups||[]).map(group=>({...group,cards:(group.cards||[]).map(card=>{
      // Only the dedicated unit directory cards use the unit summary. Other service
      // cards may link to a unit while explaining a different service.
      if(page.id!=='department-about')return card;
      const href=card.actions?.find(a=>/^unit\.html\?unit=/.test(a.href))?.href;
      const id=href?.match(/^unit\.html\?unit=([a-z0-9-]+)(?:[&#]|$)/)?.[1];
      const unit=units.find(u=>(u.id===id||u.slug===id)&&publicUnit(u));
      return id?(unit?{...card,title:unit.name,text:unit.short_description}:null):card;
    }).filter(Boolean)}))};
  }

  const statusLabels = { draft: '草稿', pending_review: '待確認', published: '已發布', expired: '已過期', archived: '已封存' };

  window.MedData = {
    load, getUnits, getUnit, getNews, publicNews, isPublic, publicUnit,
    escapeHTML, formatDate, statusLabels, resolveUnitCards
  };
})();
