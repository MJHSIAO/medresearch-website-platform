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
    return isPublic(unit) && unit.status === 'active';
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

  const statusLabels = { draft: '草稿', pending_review: '待確認', published: '已發布', expired: '已過期', archived: '已封存' };

  window.MedData = {
    load, getUnits, getUnit, getNews, publicNews, isPublic, publicUnit,
    escapeHTML, formatDate, statusLabels
  };
})();
