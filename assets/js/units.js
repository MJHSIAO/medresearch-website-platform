(function () {
  'use strict';
  const D = window.MedData;
  const root = () => document.body.dataset.root || '.';
  const publicUnit = (unit) => ['public', 'both'].includes(unit.visibility) && unit.status === 'active';

  function unitUrl(unit) {
    return unit.site_href ? `${root()}/${unit.site_href}` : `${root()}/unit.html?unit=${encodeURIComponent(unit.slug)}`;
  }

  function renderExternalLink(item) {
    const note = item.note ? `<span>${D.escapeHTML(item.note)}</span>` : '<span>前往官方資訊</span>';
    return `<a class="unit-resource-link" href="${D.escapeHTML(item.href)}" target="_blank" rel="noopener"><strong>${D.escapeHTML(item.label)} <span aria-hidden="true">↗</span></strong>${note}</a>`;
  }

  function renderSpecialSection(section, index) {
    const sectionClass = index % 2 === 0 ? 'section section-tint' : 'section';
    return `<section class="${sectionClass}" id="${D.escapeHTML(section.id)}"><div class="container unit-section-grid"><div><span class="eyebrow">${D.escapeHTML(section.eyebrow || '單位特色')}</span><h2>${D.escapeHTML(section.title)}</h2>${section.intro ? `<p>${D.escapeHTML(section.intro)}</p>` : ''}</div><ul class="unit-info-list">${(section.items || []).map((item) => `<li>${D.escapeHTML(item)}</li>`).join('')}</ul></div></section>`;
  }

  async function renderUnits() {
    const target = document.getElementById('units-grid');
    if (!target) return;
    const units = await D.getUnits();
    target.innerHTML = units
      .filter(publicUnit)
      .sort((a, b) => a.display_order - b.display_order)
      .map((unit) => {
        const href = unitUrl(unit);
        const unitName = D.escapeHTML(unit.name);
        const newTabLabel = `${unitName}（另開新分頁）`;
        const buttonLabel = unit.id === 'ai-center' ? '進入中心官網' : '進入單位子站';
        return `<article class="card interactive"><div class="unit-visual" role="img" aria-label="${D.escapeHTML(unit.hero_alt)}"><span>${unitName}</span></div><h2><a href="${href}" target="_blank" rel="noopener" aria-label="${newTabLabel}">${unitName} <span aria-hidden="true">↗</span></a></h2><p>${D.escapeHTML(unit.short_description)}</p><div class="button-row"><a class="button secondary" href="${href}" target="_blank" rel="noopener" aria-label="${newTabLabel}">${buttonLabel} ↗</a><a class="button ghost" href="${D.escapeHTML(unit.source_url)}" target="_blank" rel="noopener">原官網 ↗</a></div></article>`;
      })
      .join('');
  }

  async function renderUnit() {
    const target = document.getElementById('unit-content');
    if (!target) return;
    const slug = new URLSearchParams(location.search).get('unit') || 'academic-office';
    const [unit, allUnits, allNews, people] = await Promise.all([D.getUnit(slug), D.getUnits(), D.getNews(), D.load('people')]);
    if (unit.site_href) { location.replace(`${root()}/${unit.site_href}`); return; }

    const publicPeople = people.filter((person) => person.unit_id === unit.id && person.visibility !== 'internal');
    const news = D.publicNews(allNews, false).filter((item) => item.owner_unit_id === unit.id || item.related_unit_ids?.includes(unit.id)).slice(0, 3);
    const resources = Array.isArray(unit.resource_links) ? unit.resource_links : [];
    const specialSections = Array.isArray(unit.special_sections) ? unit.special_sections : [];
    const otherUnits = allUnits.filter((entry) => publicUnit(entry) && entry.id !== unit.id);
    const checkedAt = unit.source_checked_at || '2026-09-04';
    const membersMarkup = publicPeople.length
      ? publicPeople.map((person) => `<article class="card unit-member-card"><span class="unit-member-mark" aria-hidden="true">${D.escapeHTML(person.name.slice(0, 1))}</span><div><h3>${D.escapeHTML(person.name)}</h3><p><strong>${D.escapeHTML(person.title)}</strong></p><p>${D.escapeHTML(person.bio)}</p></div></article>`).join('')
      : unit.members.map((member) => `<article class="card unit-member-card"><span class="unit-member-mark" aria-hidden="true">研</span><div><h3>${D.escapeHTML(member)}</h3><p>姓名與職務依原醫研部官網整理。</p></div></article>`).join('');

    document.title = `${unit.name}｜醫學研究部隸屬單位`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', unit.short_description);
    document.querySelectorAll('[data-unit-page-crumb]').forEach((node) => { node.textContent = unit.name; });

    const navItems = [
      ['單位介紹', '#unit-about'],
      ['主要業務', '#unit-services'],
      ...(specialSections.length ? [['特色資訊', `#${specialSections[0].id}`]] : []),
      ['成員', '#unit-members'],
      ['最新消息', '#unit-news'],
      ['聯絡資訊', '#unit-contact']
    ];

    target.innerHTML = `<div class="unit-subsite">
      <div class="unit-site-bar"><div class="container unit-site-bar-inner"><a class="unit-site-name" href="${root()}/unit.html?unit=${encodeURIComponent(unit.slug)}">${D.escapeHTML(unit.name)}</a><nav class="unit-site-nav" aria-label="${D.escapeHTML(unit.name)}網站導覽"><ul>${navItems.map(([label, href]) => `<li><a href="${href}">${D.escapeHTML(label)}</a></li>`).join('')}<li><a href="${root()}/units.html" target="_blank" rel="noopener">其他單位 ↗</a></li></ul></nav></div></div>

      <section class="unit-hero unit-hero-site"><div class="container unit-hero-grid"><div><span class="eyebrow">亞東紀念醫院・醫學研究部</span><h1>${D.escapeHTML(unit.name)}</h1><p class="hero-statement">${D.escapeHTML(unit.short_description)}</p><div class="button-row"><a class="button" href="#unit-services">查看主要業務</a><a class="button secondary" href="#unit-contact">聯絡單位</a><a class="button ghost" href="${D.escapeHTML(unit.source_url)}" target="_blank" rel="noopener">核對原官網 ↗</a></div></div><aside class="unit-identity-card" aria-label="單位定位"><span class="unit-identity-mark" aria-hidden="true">${D.escapeHTML(unit.name.slice(0, 2))}</span><strong>${D.escapeHTML(unit.template_label || '研究支援單位')}</strong><p>${D.escapeHTML(unit.full_description)}</p><small>原頁面更新：${D.formatDate(unit.source_updated_at)}</small></aside></div></section>

      ${resources.length ? `<section class="unit-quick-section" aria-labelledby="unit-resources-title"><div class="container"><div class="section-heading"><div><span class="eyebrow">Quick Access</span><h2 id="unit-resources-title">常用資訊入口</h2><p>依原醫研部官網可確認的公開連結整理；院內文件仍可能需要院內權限。</p></div></div><div class="unit-resource-grid">${resources.map(renderExternalLink).join('')}</div></div></section>` : ''}

      <section class="section" id="unit-about"><div class="container unit-overview-grid"><div><span class="eyebrow">About</span><h2>單位介紹與成立宗旨</h2><p class="unit-lead">${D.escapeHTML(unit.full_description)}</p><div class="unit-purpose-panel"><h3>成立宗旨</h3><p>${D.escapeHTML(unit.purpose)}</p></div></div><div><h3>發展目標</h3><ol class="unit-goal-list">${unit.goals.map((goal, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><strong>${D.escapeHTML(goal)}</strong></li>`).join('')}</ol><p><a href="${root()}/unit-about.html?unit=${encodeURIComponent(unit.slug)}">閱讀完整單位介紹 →</a></p></div></div></section>

      <section class="section section-tint" id="unit-services"><div class="container"><div class="section-heading"><div><span class="eyebrow">Services</span><h2>${D.escapeHTML(unit.service_heading || '主要業務與服務')}</h2><p>以下項目依原官網業務、辦法或資訊入口歸納，正式申請條件仍以官方公告為準。</p></div></div><div class="grid grid-3">${unit.services.map((service, index) => `<article class="card unit-service-card"><span>${String(index + 1).padStart(2, '0')}</span><h3>${D.escapeHTML(service)}</h3></article>`).join('')}</div></div></section>

      <section class="section highlight-band"><div class="container"><div class="section-heading"><div><span class="eyebrow">Focus</span><h2>${D.escapeHTML(unit.name)}重點領域</h2></div></div><div class="stat-line">${unit.research_fields.slice(0, 3).map((field) => `<div><strong>${D.escapeHTML(field)}</strong><span>依公開業務內容整理</span></div>`).join('')}</div></div></section>

      ${specialSections.map(renderSpecialSection).join('')}

      <section class="section" id="unit-members"><div class="container"><div class="section-heading"><div><span class="eyebrow">Team</span><h2>單位成員</h2><p>姓名與職稱依原醫研部官網公開頁面整理。</p></div></div><div class="grid grid-2 unit-member-grid">${membersMarkup}</div></div></section>

      <section class="section section-tint" id="unit-news"><div class="container"><div class="section-heading"><div><span class="eyebrow">News</span><h2>${D.escapeHTML(unit.name)}相關消息</h2><p>只顯示公開且已發布的共用消息資料。</p></div><a href="${root()}/news.html">瀏覽全部消息</a></div><div class="grid grid-3">${news.length ? news.map((item) => window.MedUI.newsCard(item, [unit])).join('') : '<div class="empty-state"><p>目前沒有可確認的公開消息，請由官方來源查看最新資訊。</p></div>'}</div></div></section>

      <section class="section" id="unit-contact"><div class="container unit-contact-grid"><div><span class="eyebrow">Contact</span><h2>聯絡${D.escapeHTML(unit.name)}</h2><p>未在原官網公開的聯絡欄位維持「請依官方頁面洽詢」，不以示意資料代替。</p><div class="unit-source-note"><strong>資料查核</strong><span>原頁面更新：${D.formatDate(unit.source_updated_at)}</span><span>本版查核：${D.formatDate(checkedAt)}</span></div></div><div class="contact-panel"><h3>${D.escapeHTML(unit.contact.person)}</h3><dl class="unit-contact-list"><div><dt>電話</dt><dd>${D.escapeHTML(unit.contact.phone)}</dd></div><div><dt>電子郵件</dt><dd>${D.escapeHTML(unit.contact.email)}</dd></div><div><dt>位置</dt><dd>${D.escapeHTML(unit.contact.address)}</dd></div></dl><p><a class="button secondary" href="${D.escapeHTML(unit.source_url)}" target="_blank" rel="noopener">前往單位原官網 ↗</a></p></div></div></section>

      <section class="unit-network"><div class="container unit-network-inner"><div><span class="eyebrow">Medical Research Network</span><h2>返回醫研部或查看其他單位</h2><p>跨單位連結會另開新分頁，保留目前子站。</p></div><div class="button-row"><a class="button secondary" href="${root()}/index.html" target="_blank" rel="noopener">醫研部首頁 ↗</a><a class="button secondary" href="${root()}/units.html" target="_blank" rel="noopener">全部隸屬單位 ↗</a></div></div><div class="container unit-network-list" aria-label="其他隸屬單位">${otherUnits.map((entry) => `<a href="${unitUrl(entry)}" target="_blank" rel="noopener">${D.escapeHTML(entry.name)} ↗</a>`).join('')}</div></section>
    </div>`;
  }

  async function renderUnitAbout() {
    const target = document.getElementById('unit-about-content');
    if (!target) return;
    const slug = new URLSearchParams(location.search).get('unit') || 'academic-office';
    const [unit, people] = await Promise.all([D.getUnit(slug), D.load('people')]);
    const publicPeople = people.filter((person) => person.unit_id === unit.id && person.visibility !== 'internal');
    if (unit.site_about_href) { location.replace(`${root()}/${unit.site_about_href}`); return; }
    document.title = `${unit.name}完整介紹｜醫學研究部`;
    document.querySelector('[data-unit-crumb]').textContent = unit.name;
    target.innerHTML = `<div class="prose"><span class="eyebrow">單位完整介紹</span><h1>${D.escapeHTML(unit.name)}</h1><p class="page-kicker">${D.escapeHTML(unit.full_description)}</p><h2>成立宗旨</h2><p>${D.escapeHTML(unit.purpose)}</p><h2>發展目標</h2><ul>${unit.goals.map((item) => `<li>${D.escapeHTML(item)}</li>`).join('')}</ul><h2>主要業務與服務內容</h2><ul>${unit.services.map((item) => `<li>${D.escapeHTML(item)}</li>`).join('')}</ul><h2>重點領域與特色</h2><ul>${unit.research_fields.map((item) => `<li>${D.escapeHTML(item)}</li>`).join('')}</ul><h2>主管及成員</h2>${publicPeople.length ? publicPeople.map((person) => `<div class="card person-card"><h3>${D.escapeHTML(person.name)}</h3><p><strong>${D.escapeHTML(person.title)}</strong></p><p>${D.escapeHTML(person.bio)}</p></div>`).join('') : `<ul>${unit.members.map((member) => `<li>${D.escapeHTML(member)}</li>`).join('')}</ul>`}<p><a class="button secondary" href="${root()}/unit.html?unit=${encodeURIComponent(unit.slug)}">返回單位子站</a></p></div><aside><div class="card source-card"><span class="tag">官方資料</span><h2>資料來源</h2><p>內容依醫學研究部單位原官網整理。</p><p><strong>原頁面更新：</strong>${D.formatDate(unit.source_updated_at)}<br><strong>本版查核：</strong>${D.formatDate(unit.source_checked_at || '2026-09-04')}</p><p><a class="button secondary" href="${D.escapeHTML(unit.source_url)}" target="_blank" rel="noopener">前往官方頁面 ↗</a></p></div></aside>`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await renderUnits();
      await renderUnit();
      await renderUnitAbout();
    } catch (error) {
      console.error(error);
      const main = document.querySelector('main');
      if (main) main.insertAdjacentHTML('afterbegin', '<div class="container status-message error" role="alert">單位資料暫時無法載入，請稍後再試。</div>');
    }
  });
})();