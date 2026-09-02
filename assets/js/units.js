(function () {
  'use strict';
  const D = window.MedData;
  const root = () => document.body.dataset.root || '.';

  async function renderUnits() {
    const target = document.getElementById('units-grid');
    if (!target) return;
    const units = await D.getUnits();
    target.innerHTML = units
      .filter((unit) => ['public', 'both'].includes(unit.visibility) && unit.status === 'active')
      .sort((a, b) => a.display_order - b.display_order)
      .map((unit) => {
        const unitHref = unit.site_href ? `${root()}/${unit.site_href}` : `${root()}/unit.html?unit=${encodeURIComponent(unit.slug)}`;
        const unitName = D.escapeHTML(unit.name);
        const newTabLabel = `${unitName}（另開新分頁）`;
        return `<article class="card interactive"><div class="unit-visual" role="img" aria-label="${D.escapeHTML(unit.hero_alt)}"><span>${unitName}</span></div><h2><a href="${unitHref}" target="_blank" rel="noopener" aria-label="${newTabLabel}">${unitName} <span aria-hidden="true">↗</span></a></h2><p>${D.escapeHTML(unit.short_description)}</p><div class="button-row"><a class="button secondary" href="${unitHref}" target="_blank" rel="noopener" aria-label="${newTabLabel}">${unit.site_href ? "進入中心官網" : "查看單位資訊"} ↗</a><a class="button ghost" href="${D.escapeHTML(unit.source_url)}" target="_blank" rel="noopener">原官網 ↗</a></div></article>`;
      })
      .join('');
  }

  async function renderUnit() {
    const target = document.getElementById('unit-content');
    if (!target) return;
    const slug = new URLSearchParams(location.search).get('unit') || 'ai-center';
    const [unit, allNews] = await Promise.all([D.getUnit(slug), D.getNews()]);
    const news = D.publicNews(allNews, false).filter((item) => item.owner_unit_id === unit.id || item.related_unit_ids?.includes(unit.id)).slice(0, 3);
    if (unit.site_href) { location.replace(`${root()}/${unit.site_href}`); return; }
    document.title = `${unit.name}｜醫學研究部`;
    target.innerHTML = `<section class="unit-hero"><div class="container unit-hero-grid"><div><span class="eyebrow">醫學研究部隸屬單位</span><h1>${D.escapeHTML(unit.name)}</h1><p class="page-kicker">${D.escapeHTML(unit.short_description)}</p><div class="button-row"><a class="button" href="${root()}/unit-about.html?unit=${encodeURIComponent(unit.slug)}">完整介紹</a><a class="button secondary" href="#unit-contact">聯絡單位</a><a class="button ghost" href="${D.escapeHTML(unit.source_url)}" target="_blank" rel="noopener">官方來源 ↗</a></div></div><div class="unit-visual" role="img" aria-label="${D.escapeHTML(unit.hero_alt)}"><span>研究・轉譯・照護</span></div></div></section>
      <section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow">主要業務</span><h2>服務與資訊入口</h2></div></div><div class="grid grid-3">${unit.services.map((service) => `<article class="card service-summary"><span class="service-dot" aria-hidden="true"></span><h3>${D.escapeHTML(service)}</h3></article>`).join('')}</div></div></section>
      <section class="section highlight-band"><div class="container"><div class="section-heading"><div><span class="eyebrow">重點領域與特色</span><h2>${D.escapeHTML(unit.name)}的研究角色</h2></div></div><div class="stat-line">${unit.research_fields.slice(0, 3).map((field) => `<div><strong>${D.escapeHTML(field)}</strong><span>依官方單位資訊整理</span></div>`).join('')}</div></div></section>
      <section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow">公開消息</span><h2>${D.escapeHTML(unit.name)}相關動態</h2></div><a href="${root()}/news.html">瀏覽全部消息</a></div><div class="grid grid-3">${news.length ? news.map((item) => window.MedUI.newsCard(item, [unit])).join('') : '<div class="empty-state"><p>目前沒有可確認的公開消息，請由官方來源查看最新資訊。</p></div>'}</div></div></section>
      <section class="section section-tint" id="unit-contact"><div class="container grid grid-2"><div><span class="eyebrow">聯絡資訊</span><h2>與${D.escapeHTML(unit.name)}聯繫</h2><p>以下為原官網可確認的公開資訊；未公開的欄位不以示意內容代替。</p><p><small>官方頁面更新：${D.formatDate(unit.source_updated_at)}</small></p></div><div class="contact-panel"><h3>${D.escapeHTML(unit.contact.person)}</h3><p>${D.escapeHTML(unit.contact.phone)}<br>${D.escapeHTML(unit.contact.email)}<br>${D.escapeHTML(unit.contact.address)}</p><p><a href="${D.escapeHTML(unit.source_url)}" target="_blank" rel="noopener">查看單位原官網 ↗</a></p></div></div></section>`;
  }

  async function renderUnitAbout() {
    const target = document.getElementById('unit-about-content');
    if (!target) return;
    const slug = new URLSearchParams(location.search).get('unit') || 'ai-center';
    const [unit, people] = await Promise.all([D.getUnit(slug), D.load('people')]);
    const publicPeople = people.filter((person) => person.unit_id === unit.id && person.visibility !== 'internal');
    if (unit.site_about_href) { location.replace(`${root()}/${unit.site_about_href}`); return; }
    document.title = `${unit.name}完整介紹｜醫學研究部`;
    document.querySelector('[data-unit-crumb]').textContent = unit.name;
    target.innerHTML = `<div class="prose"><span class="eyebrow">單位完整介紹</span><h1>${D.escapeHTML(unit.name)}</h1><p class="page-kicker">${D.escapeHTML(unit.full_description)}</p><h2>成立宗旨</h2><p>${D.escapeHTML(unit.purpose)}</p><h2>發展目標</h2><ul>${unit.goals.map((item) => `<li>${D.escapeHTML(item)}</li>`).join('')}</ul><h2>主要業務與服務內容</h2><ul>${unit.services.map((item) => `<li>${D.escapeHTML(item)}</li>`).join('')}</ul><h2>重點領域與特色</h2><ul>${unit.research_fields.map((item) => `<li>${D.escapeHTML(item)}</li>`).join('')}</ul><h2>主管及成員</h2>${publicPeople.length ? publicPeople.map((person) => `<div class="card person-card"><h3>${D.escapeHTML(person.name)}</h3><p><strong>${D.escapeHTML(person.title)}</strong></p><p>${D.escapeHTML(person.bio)}</p></div>`).join('') : `<ul>${unit.members.map((member) => `<li>${D.escapeHTML(member)}</li>`).join('')}</ul>`}<p><a class="button secondary" href="${root()}/unit.html?unit=${encodeURIComponent(unit.slug)}">返回單位首頁</a></p></div><aside><div class="card source-card"><span class="tag">官方資料</span><h2>資料來源</h2><p>內容依醫學研究部單位原官網整理。</p><p><strong>原頁面更新：</strong>${D.formatDate(unit.source_updated_at)}<br><strong>本版查核：</strong>2026/09/01</p><p><a class="button secondary" href="${D.escapeHTML(unit.source_url)}" target="_blank" rel="noopener">前往官方頁面 ↗</a></p></div></aside>`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await renderUnits();
      await renderUnit();
      await renderUnitAbout();
    } catch (error) {
      console.error(error);
    }
  });
})();

