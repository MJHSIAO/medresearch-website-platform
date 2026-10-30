/* Read-only adapter for retiring the former browser-local message store. */
(function () {
  'use strict';
  function parse(raw) {
    const input = JSON.parse(raw || '[]');
    if (!Array.isArray(input)) throw Error('舊消息資料格式不正確，請保留原資料並聯絡維運。');
    const seen = new Set();
    const items = [];
    let skipped = 0;
    for (const item of input) {
      if (!item || typeof item !== 'object' || !/^demo-news-\d+$/.test(item.id || '') ||
          typeof item.title !== 'string' || !item.title.trim() || !Array.isArray(item.content) ||
          !item.content.every(p => typeof p === 'string') || seen.has(item.id)) {
        skipped++;
        continue;
      }
      seen.add(item.id);
      // Draft import preserves the original URL without publishing unreviewed content.
      items.push({ ...item, content: [...item.content], status: 'draft',
        visibility: ['public', 'internal', 'both'].includes(item.visibility) ? item.visibility : 'public',
        attachments: Array.isArray(item.attachments) ? item.attachments : [] });
    }
    return { items, skipped };
  }
  window.MedLegacyNews = { parse };
})();
