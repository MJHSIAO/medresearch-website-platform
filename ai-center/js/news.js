/**
 * 人工智慧中心｜公開消息
 * 與醫學研究部共用 data/news.json 及內容管理 Demo 的瀏覽器覆寫資料。
 */
(function () {
  "use strict";

  const UNIT_ID = "ai-center";
  const LOCAL_NEWS_KEY = "medresearch_demo_news";

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const items = await loadNews();
      renderLists(items);
      renderDetail(items);
    } catch (error) {
      console.error(error);
      document.querySelectorAll("[data-news-list], [data-news-detail]").forEach((target) => {
        target.innerHTML = '<div class="empty-state"><strong>消息暫時無法載入</strong><p>請稍後再試，或返回醫學研究部最新消息。</p></div>';
      });
    }
  });

  async function loadNews() {
    const response = await fetch("../data/news.json");
    if (!response.ok) throw new Error("無法讀取醫學研究部消息資料");
    const base = await response.json();
    let added = [];
    try {
      added = JSON.parse(localStorage.getItem(LOCAL_NEWS_KEY) || "[]");
      if (!Array.isArray(added)) added = [];
    } catch (error) {
      console.warn("消息示意覆寫資料格式錯誤，已改用預設資料。", error);
    }
    const addedIds = new Set(added.map((item) => item.id));
    return [...added, ...base.filter((item) => !addedIds.has(item.id))]
      .filter((item) => ["public", "both"].includes(item.visibility))
      .filter((item) => ["published", "expired"].includes(item.status))
      .filter((item) => item.owner_unit_id === UNIT_ID || item.related_unit_ids?.includes(UNIT_ID))
      .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)));
  }

  function renderLists(items) {
    document.querySelectorAll("[data-news-list]").forEach((container) => {
      const home = container.dataset.newsHome === "true";
      const limit = Number(container.dataset.newsLimit) || items.length;
      const visible = items.filter((item) => !home || item.status === "published").slice(0, limit);
      container.innerHTML = visible.length ? visible.map(card).join("") :
        '<div class="empty-state"><strong>目前沒有可顯示的消息</strong><p>請稍後再回來查看。</p></div>';
    });
  }

  function card(item) {
    const expired = item.status === "expired";
    return `<article class="news-card${item.featured && !expired ? " news-card--pinned" : ""}">
      <div class="news-card__meta">
        <time datetime="${escapeHtml(dateOnly(item.published_at))}">${formatDate(item.published_at)}</time>
        <span class="tag">${escapeHtml(item.category)}</span>
        ${item.featured && !expired ? '<span class="pin-label">精選</span>' : ""}
        ${expired ? '<span class="status-pill status-pill--expired">歷史消息</span>' : ""}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <a class="text-button" href="news-detail.html?id=${encodeURIComponent(item.id)}">閱讀完整內容 <span aria-hidden="true">→</span></a>
    </article>`;
  }

  function renderDetail(items) {
    const target = document.querySelector("[data-news-detail]");
    if (!target) return;
    const id = new URLSearchParams(location.search).get("id");
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      target.innerHTML = '<div class="empty-state"><h1>找不到此消息</h1><p>內容可能尚未發布、已撤下，或不屬於人工智慧中心。</p></div>';
      return;
    }
    target.innerHTML = `<article class="detail-article">
      <div class="news-card__meta">
        <span class="tag">${escapeHtml(item.category)}</span>
        <time datetime="${escapeHtml(dateOnly(item.published_at))}">${formatDate(item.published_at)}</time>
        ${item.status === "expired" ? '<span class="status-pill status-pill--expired">歷史消息</span>' : ""}
      </div>
      <h1>${escapeHtml(item.title)}</h1>
      <p class="detail-summary">${escapeHtml(item.summary)}</p>
      <div class="detail-content">${(item.content || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>
      <dl class="detail-meta">
        <div><dt>發布單位</dt><dd>${item.owner_unit_id === UNIT_ID ? "人工智慧中心" : "醫學研究部"}</dd></div>
        <div><dt>資料日期</dt><dd>${formatDate(item.published_at)}</dd></div>
      </dl>
      ${item.source_url ? `<p><a class="button button--outline" href="${escapeHtml(item.source_url)}" target="_blank" rel="noopener">前往官方來源 ↗</a></p>` : ""}
    </article>`;
    document.title = `${item.title}｜人工智慧中心`;
  }

  function dateOnly(value) {
    return String(value || "").slice(0, 10);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return dateOnly(value).replaceAll("-", ".");
    return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
})();
