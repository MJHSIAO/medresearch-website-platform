(function () {
  'use strict';
  const D = window.MedData;
  const root = () => document.body.dataset.root || '.';
  const text = (value) => Array.isArray(value) ? value.map(text).join(' ') : String(value || '');
  const normalize = (value) => text(value).normalize('NFKC').trim().toLowerCase();
  const unitHref = (unit) => `${root()}/${unit.site_href || `unit.html?unit=${encodeURIComponent(unit.slug)}`}`;

  function buildIndex(site, units, people, news) {
    const publicUnits = units.filter(D.publicUnit);
    const byId = new Map(publicUnits.map((unit) => [unit.id, unit]));
    const entries = publicUnits.map((unit) => ({
      type: '單位', title: unit.name, summary: unit.short_description,
      body: text([unit.full_description, unit.purpose, unit.goals, unit.services, unit.research_fields]),
      href: unitHref(unit), newTab: true
    }));
    for (const person of people.filter(D.isPublic)) {
      const unit = byId.get(person.unit_id);
      if (!unit) continue;
      entries.push({ type: '成員', title: person.name,
        summary: text([person.title, person.bio]), body: unit.name,
        href: unit.site_about_href ? `${root()}/${unit.site_about_href}` : `${unitHref(unit)}#unit-members`, newTab: true });
    }
    for (const item of D.publicNews(news, true)) {
      if (item.owner_unit_id !== 'medresearch' && !byId.has(item.owner_unit_id)) continue;
      entries.push({ type: '最新消息', title: item.title, summary: item.summary,
        body: text([item.content, item.body, item.category, item.published_at, D.formatDate(item.published_at), item.event_date]),
        href: `${root()}/news-detail.html?id=${encodeURIComponent(item.id)}` });
    }
    // site.json is public site metadata, not administrative or draft content.
    entries.push({ type: '網站資訊', title: site.name, summary: site.description,
      body: text([site.platform_name, site.contact?.unit, site.contact?.address, ...Object.values(site.principles || {})]), href: `${root()}/index.html` });
    return entries;
  }

  function search(entries, query) {
    const term = normalize(query);
    if (!term) return [];
    return entries.map((entry) => {
      const title = normalize(entry.title);
      const score = title === term ? 100 : title.includes(term) ? 75 : normalize(entry.summary).includes(term) ? 50 : normalize(entry.body).includes(term) ? 25 : 0;
      return { ...entry, score };
    }).filter((entry) => entry.score).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh-Hant'));
  }

  async function render() {
    const target = document.getElementById('search-results');
    if (!target) return;
    const input = document.getElementById('site-query');
    const query = (new URLSearchParams(location.search).get('q') || '').trim();
    input.value = query;
    const count = document.getElementById('search-count');
    if (!query) { count.textContent = '請輸入搜尋關鍵字'; return; }
    document.getElementById('search-title').textContent = `搜尋「${query}」`;
    document.title = `搜尋「${query}」｜醫學研究部`;
    try {
      const sources = await Promise.all([D.load('site'), D.getUnits(), D.load('people'), D.getNews()]);
      const results = search(buildIndex(...sources), query);
      count.textContent = `共找到 ${results.length} 筆結果（依相關程度排序）`;
      if (!results.length) { target.innerHTML = '<div class="empty-state">找不到符合條件的內容，請嘗試其他關鍵字。</div>'; return; }
      target.innerHTML = `<ol class="search-results">${results.map((entry) => `<li class="card"><span class="tag">${D.escapeHTML(entry.type)}</span><h2><a href="${D.escapeHTML(entry.href)}"${entry.newTab ? ' target="_blank" rel="noopener"' : ''}>${D.escapeHTML(entry.title)}${entry.newTab ? ' ↗<span class="sr-only">（另開新分頁）</span>' : ''}</a></h2><p>${D.escapeHTML(text(entry.summary || entry.body).slice(0, 180))}${text(entry.summary || entry.body).length > 180 ? '…' : ''}</p></li>`).join('')}</ol>`;
    } catch (error) {
      count.textContent = '搜尋資料暫時無法載入，請重新整理後再試。';
      console.error(error);
    }
  }
  window.MedSearch = { buildIndex, search };
  document.addEventListener('DOMContentLoaded', render);
})();
