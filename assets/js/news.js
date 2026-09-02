(function () {
  'use strict';
  const D = window.MedData;
  const root = () => document.body.dataset.root || '.';
  let visibleCount = 4;

  async function renderList() {
    const list = document.getElementById('news-results');
    if (!list) return;
    const [all, units] = await Promise.all([D.getNews(), D.getUnits()]);
    const publicItems = D.publicNews(all, true).sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
    const keyword = document.getElementById('news-keyword');
    const unit = document.getElementById('news-unit');
    const category = document.getElementById('news-category');
    const year = document.getElementById('news-year');
    const status = document.getElementById('news-status');

    unit.innerHTML += units.filter((entry) => ['public', 'both'].includes(entry.visibility)).map((entry) => `<option value="${D.escapeHTML(entry.id)}">${D.escapeHTML(entry.name)}</option>`).join('');
    const categories = [...new Set(publicItems.map((item) => item.category))];
    category.innerHTML += categories.map((value) => `<option value="${D.escapeHTML(value)}">${D.escapeHTML(value)}</option>`).join('');
    const years = [...new Set(publicItems.map((item) => String(item.published_at).slice(0, 4)).filter(Boolean))];
    year.innerHTML += years.map((value) => `<option value="${value}">${value}</option>`).join('');
    const queryCategory = new URLSearchParams(location.search).get('category');
    if (queryCategory && categories.includes(queryCategory)) category.value = queryCategory;

    function update(reset = true) {
      if (reset) visibleCount = 4;
      const term = keyword.value.trim().toLowerCase();
      const filtered = publicItems.filter((item) => {
        const haystack = `${item.title} ${item.summary} ${item.category}`.toLowerCase();
        return (!term || haystack.includes(term)) && (!unit.value || item.owner_unit_id === unit.value) && (!category.value || item.category === category.value) && (!year.value || String(item.published_at).startsWith(year.value)) && (!status.value || item.status === status.value);
      });
      document.getElementById('news-count').textContent = `共 ${filtered.length} 則`;
      list.innerHTML = filtered.slice(0, visibleCount).map((item) => window.MedUI.newsCard(item, units)).join('') || '<div class="empty-state"><h2>沒有符合條件的消息</h2><p>請調整關鍵字或篩選條件。</p></div>';
      const more = document.getElementById('load-more');
      more.hidden = filtered.length <= visibleCount;
      more.onclick = () => { visibleCount += 4; update(false); };
    }
    [keyword, unit, category, year, status].forEach((control) => control.addEventListener(control === keyword ? 'input' : 'change', () => update(true)));
    document.getElementById('clear-filters').addEventListener('click', () => {
      [keyword, unit, category, year, status].forEach((control) => { control.value = ''; });
      update(true);
      keyword.focus();
    });
    update(true);
  }

  async function renderDetail() {
    const target = document.getElementById('news-detail');
    if (!target) return;
    const id = new URLSearchParams(location.search).get('id') || 'news-femh45-symposium';
    const [all, units] = await Promise.all([D.getNews(), D.getUnits()]);
    const item = D.publicNews(all, true).find((entry) => entry.id === id);
    if (!item) {
      target.innerHTML = '<div class="empty-state"><h1>找不到這則公開消息</h1><p>消息可能尚未發布、僅限院內或不存在。</p><a class="button" href="news.html">返回最新消息</a></div>';
      return;
    }
    const owner = item.owner_unit_id === 'medresearch' ? '醫學研究部' : (units.find((entry) => entry.id === item.owner_unit_id)?.name || '醫學研究部');
    const related = D.publicNews(all, true).filter((entry) => entry.id !== item.id && (entry.category === item.category || entry.owner_unit_id === item.owner_unit_id)).slice(0, 2);
    document.title = `${item.title}｜醫學研究部`;
    document.querySelector('[data-detail-crumb]').textContent = item.title;
    target.innerHTML = `<article>
      <div class="card-meta"><span class="tag ${item.status}">${D.statusLabels[item.status]}</span><span>${D.escapeHTML(item.category)}</span></div>
      <h1>${D.escapeHTML(item.title)}</h1>
      <p class="page-kicker">${D.escapeHTML(item.summary)}</p>
      <dl class="detail-list"><div><dt>所屬單位</dt><dd>${D.escapeHTML(owner)}</dd></div><div><dt>資料日期</dt><dd>${D.formatDate(item.published_at)}</dd></div><div><dt>最後更新</dt><dd>${D.formatDate(item.updated_at)}</dd></div>${item.event_date ? `<div><dt>活動日期</dt><dd>${D.formatDate(item.event_date)}</dd></div>` : ''}${item.expires_at ? `<div><dt>資料效期</dt><dd>${D.formatDate(item.expires_at)}</dd></div>` : ''}</dl>
      <div class="article-visual" role="img" aria-label="${D.escapeHTML(item.cover_alt)}"><span>${D.escapeHTML(item.category)}｜官方資訊摘要</span></div>
      <div class="prose">${item.content.map((paragraph) => `<p>${D.escapeHTML(paragraph)}</p>`).join('')}</div>
      ${item.attachments?.length ? `<section><h2>附件</h2><ul class="attachment-list">${item.attachments.map((file) => `<li><span><strong>${D.escapeHTML(file.name)}</strong><br><small>${D.escapeHTML(file.type)} · ${D.escapeHTML(file.size)}</small></span></li>`).join('')}</ul></section>` : ''}
      <div class="callout"><strong>資料核對</strong><p>本頁為原官網內容摘要，詳細資訊、附件及後續異動請以前往官方來源查閱為準。</p></div>
      <div class="button-row"><a class="button secondary" href="${root()}/news.html">返回列表</a>${item.source_url ? `<a class="button" href="${D.escapeHTML(item.source_url)}" target="_blank" rel="noopener">前往官方來源 ↗</a>` : ''}</div>
    </article><aside><div class="card"><h2>相關消息</h2>${related.length ? related.map((entry) => `<p><a href="${root()}/news-detail.html?id=${encodeURIComponent(entry.id)}">${D.escapeHTML(entry.title)}</a><br><small>${D.formatDate(entry.published_at)}</small></p>`).join('') : '<p>目前沒有相關消息。</p>'}</div></aside>`;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await renderList();
      await renderDetail();
    } catch (error) {
      console.error(error);
    }
  });
})();
