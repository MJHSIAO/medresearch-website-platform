(function () {
  'use strict';

  const D = window.MedData;
  const root = () => document.body.dataset.root || '.';

  function currentFile() {
    const file = location.pathname.split('/').pop() || 'index.html';
    return file || 'index.html';
  }

  async function renderShell() {
    const site = await D.load('site');
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    if (header) {
      const current = currentFile();
      const links = site.navigation.map((item) => {
        const active = current === item.href.split('?')[0] || (current === 'unit.html' && item.href === 'units.html');
        return `<li><a href="${root()}/${item.href}"${active ? ' aria-current="page"' : ''}>${D.escapeHTML(item.label)}</a></li>`;
      }).join('');
      header.innerHTML = `
        <p class="demo-notice">${D.escapeHTML(site.notice)}</p>
        <div class="site-header"><div class="container header-row">
          <a class="brand" href="${root()}/index.html" aria-label="${D.escapeHTML(site.name)}首頁">
            <span class="brand-mark" aria-hidden="true">研</span>
            <span class="brand-copy"><strong>${D.escapeHTML(site.name)}</strong><span>Department of Medical Research</span></span>
          </a>
          <button class="menu-toggle" type="button" aria-label="開啟主選單" aria-expanded="false" aria-controls="main-navigation"><span aria-hidden="true">☰</span><span class="menu-label">選單</span></button>
          <nav class="main-nav" id="main-navigation" aria-label="主要導覽"><ul>${links}</ul></nav>
        </div></div>`;
      const toggle = header.querySelector('.menu-toggle');
      const nav = header.querySelector('.main-nav');
      const syncMenu = () => {
        const mobile = matchMedia('(max-width: 48rem)').matches;
        nav.hidden = mobile && toggle.getAttribute('aria-expanded') !== 'true';
      };
      toggle.addEventListener('click', () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? '關閉主選單' : '開啟主選單');
        document.body.classList.toggle('menu-open', open);
        syncMenu();
      });
      nav.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          toggle.setAttribute('aria-expanded', 'false');
          toggle.setAttribute('aria-label', '開啟主選單');
          document.body.classList.remove('menu-open');
          syncMenu();
          toggle.focus();
        }
      });
      matchMedia('(max-width: 48rem)').addEventListener('change', syncMenu);
      syncMenu();
    }
    if (footer) {
      footer.innerHTML = `<div class="site-footer"><div class="container footer-grid">
        <div><h2>${D.escapeHTML(site.name)}</h2><p>${D.escapeHTML(site.description)}</p><p><strong>資料說明：</strong>本版依醫學研究部原官網整理，最新規章、表單及聯絡資訊仍以官方來源為準。</p></div>
        <div><h3>網站導覽</h3><ul>${site.navigation.map((item) => `<li><a href="${root()}/${item.href}">${D.escapeHTML(item.label)}</a></li>`).join('')}</ul></div>
        <div><h3>聯絡資訊</h3><ul><li>${D.escapeHTML(site.contact.unit)}</li><li>${D.escapeHTML(site.contact.address)}</li><li>${D.escapeHTML(site.contact.phone)}</li><li><a href="${D.escapeHTML(site.source_url)}" target="_blank" rel="noopener">醫學研究部原官網 ↗</a></li></ul></div>
      </div><div class="container footer-bottom">© 2026 亞東紀念醫院 醫學研究部網站平台｜資料查核：${D.escapeHTML(site.source_checked_at)}</div></div>`;
    }
  }

  function newsCard(item, units) {
    const owner = item.owner_unit_id === 'medresearch' ? '醫學研究部' : (units.find((unit) => unit.id === item.owner_unit_id)?.name || '醫學研究部');
    return `<article class="card interactive">
      <div class="card-meta"><span class="tag ${item.status}">${D.statusLabels[item.status]}</span><span>${D.escapeHTML(item.category)}</span><span>${D.escapeHTML(owner)}</span></div>
      <h3><a href="${root()}/news-detail.html?id=${encodeURIComponent(item.id)}">${D.escapeHTML(item.title)}</a></h3>
      <p>${D.escapeHTML(item.summary)}</p>
      <div class="card-meta"><span>資料日期 ${D.formatDate(item.published_at)}</span>${item.event_date ? `<span>活動 ${D.formatDate(item.event_date)}</span>` : ''}</div>
    </article>`;
  }

  async function renderHome() {
    const [services, units, rawNews] = await Promise.all([D.load('services'), D.getUnits(), D.getNews()]);
    const serviceGrid = document.getElementById('service-grid');
    const newsGrid = document.getElementById('home-news');
    const unitGrid = document.getElementById('home-units');
    if (serviceGrid) {
      serviceGrid.innerHTML = services.map((service) => `<article class="card service-card interactive"><span class="service-number">${D.escapeHTML(service.icon)} / RESOURCE</span><div><h3><a href="${root()}/${service.href}">${D.escapeHTML(service.title)}</a></h3><p>${D.escapeHTML(service.description)}</p></div></article>`).join('');
    }
    const homeNews = D.publicNews(rawNews, false).filter((item) => item.featured || item.status === 'published').slice(0, 3);
    if (newsGrid) newsGrid.innerHTML = homeNews.map((item) => newsCard(item, units)).join('');
    if (unitGrid) {
      unitGrid.innerHTML = units
        .filter((unit) => ['public', 'both'].includes(unit.visibility) && unit.status === 'active')
        .sort((a, b) => a.display_order - b.display_order)
        .map((unit) => {
          const unitHref = unit.site_href ? `${root()}/${unit.site_href}` : `${root()}/unit.html?unit=${encodeURIComponent(unit.slug)}`;
          return `<article class="card interactive"><div class="unit-visual" role="img" aria-label="${D.escapeHTML(unit.hero_alt)}"><span>${D.escapeHTML(unit.name)}</span></div><h3><a href="${unitHref}" target="_blank" rel="noopener" aria-label="${D.escapeHTML(unit.name)}（另開新分頁）">${D.escapeHTML(unit.name)} <span aria-hidden="true">↗</span></a></h3><p>${D.escapeHTML(unit.short_description)}</p></article>`;
        })
        .join('');
    }
  }

  async function renderContentPage() {
    const id = new URLSearchParams(location.search).get('page') || 'research-services';
    const pages = await D.load('pages');
    const page = pages.find((entry) => entry.id === id) || pages[0];
    document.title = `${page.title}｜醫學研究部`;
    document.querySelectorAll('[data-page-title]').forEach((node) => { node.textContent = page.title; });
    const target = document.getElementById('content-page-body');
    if (target) {
      target.innerHTML = `<span class="eyebrow">${D.escapeHTML(page.eyebrow)}</span><h1>${D.escapeHTML(page.title)}</h1><p class="page-kicker">${D.escapeHTML(page.summary)}</p>${page.sections.map((section) => `<section><h2>${D.escapeHTML(section.title)}</h2><p>${D.escapeHTML(section.content)}</p></section>`).join('')}<div class="callout"><strong>資料來源</strong><p>本頁依醫學研究部官網整理，查核日期為 2026-09-01。正式規章、表單版本與申請方式請以原始頁面為準。</p><p><a class="button secondary" href="${D.escapeHTML(page.source_url)}" target="_blank" rel="noopener">前往官方來源 ↗</a></p></div>`;
    }
  }

  async function renderContact() {
    const site = await D.load('site');
    const target = document.getElementById('contact-details');
    if (target) {
      target.innerHTML = `<dl class="detail-list"><div><dt>聯絡單位</dt><dd>${D.escapeHTML(site.contact.unit)}</dd></div><div><dt>洽詢方式</dt><dd>${D.escapeHTML(site.contact.person)}</dd></div><div><dt>電話及分機</dt><dd>${D.escapeHTML(site.contact.phone)}</dd></div><div><dt>電子郵件</dt><dd>${D.escapeHTML(site.contact.email)}</dd></div><div><dt>地址</dt><dd>${D.escapeHTML(site.contact.address)}</dd></div><div><dt>交通資訊</dt><dd>${D.escapeHTML(site.contact.transport)}</dd></div></dl><p><a class="button secondary" href="${D.escapeHTML(site.source_url)}" target="_blank" rel="noopener">前往醫學研究部原官網 ↗</a></p>`;
    }
    const form = document.getElementById('contact-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const status = document.getElementById('contact-status');
      status.hidden = false;
      status.textContent = '此表單為前端介面展示，尚未連接院方寄信系統；請先使用上方官方聯絡資訊。';
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await renderShell();
      const page = document.body.dataset.page;
      if (page === 'home') await renderHome();
      if (page === 'content') await renderContentPage();
      if (page === 'contact') await renderContact();
    } catch (error) {
      console.error(error);
      const main = document.querySelector('main');
      if (main) main.insertAdjacentHTML('afterbegin', '<div class="container status-message error" role="alert">頁面資料暫時無法載入，請稍後再試。</div>');
    }
  });

  window.MedUI = { newsCard, renderShell };
})();

