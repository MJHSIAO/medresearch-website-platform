(function () {
  'use strict';

  const cache = new Map();
  const root = () => document.body.dataset.root || '.';
  const keys = {
    unitPrefix: 'medresearch_demo_unit_',
    news: 'medresearch_demo_news',
    role: 'medresearch_demo_role',
    audit: 'medresearch_demo_audit'
  };

  async function load(name) {
    if (cache.has(name)) return cache.get(name);
    const response = await fetch(`${root()}/data/${name}.json`);
    if (!response.ok) throw new Error(`無法載入 ${name} 資料`);
    const value = await response.json();
    cache.set(name, value);
    return value;
  }

  function readLocal(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn('Demo 資料讀取失敗，改用預設資料。', error);
      return fallback;
    }
  }

  function writeLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async function getUnits() {
    const base = await load('units');
    return base.map((unit) => ({ ...unit, ...readLocal(`${keys.unitPrefix}${unit.id}`, {}) }));
  }

  async function getUnit(id = 'ai-center') {
    const units = await getUnits();
    return units.find((unit) => unit.id === id || unit.slug === id) || units[0];
  }

  async function getNews() {
    const base = await load('news');
    const added = readLocal(keys.news, []);
    const ids = new Set(added.map((item) => item.id));
    return [...added, ...base.filter((item) => !ids.has(item.id))];
  }

  function saveUnit(unit) {
    writeLocal(`${keys.unitPrefix}${unit.id}`, unit);
    addAudit(`更新「${unit.name}」單位資料`);
  }

  function saveNews(item) {
    const items = readLocal(keys.news, []);
    const next = [item, ...items.filter((entry) => entry.id !== item.id)];
    writeLocal(keys.news, next);
    addAudit(`${item.id.startsWith('demo-') ? '新增' : '更新'}消息「${item.title}」`);
  }

  function addAudit(action) {
    const entries = readLocal(keys.audit, []);
    const role = localStorage.getItem(keys.role) || 'unit-editor';
    entries.unshift({ id: `audit-${Date.now()}`, action, role, time: new Date().toISOString() });
    writeLocal(keys.audit, entries.slice(0, 50));
  }

  function resetDemo() {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('medresearch_demo_')) localStorage.removeItem(key);
    });
  }

  function publicNews(items, includeExpired = true) {
    return items.filter((item) => ['public', 'both'].includes(item.visibility) && (item.status === 'published' || (includeExpired && item.status === 'expired')));
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
    load, getUnits, getUnit, getNews, saveUnit, saveNews, publicNews, resetDemo,
    readLocal, writeLocal, addAudit, escapeHTML, formatDate, statusLabels, keys
  };
})();
