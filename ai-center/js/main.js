/**
 * 人工智慧中心｜公開網站共用互動
 * 本子站沿用人工智慧中心官網第一版視覺，並從醫學研究部共用單位資料同步基本介紹與聯絡資訊。
 */
document.addEventListener("DOMContentLoaded", async () => {
  buildNavigation();
  buildFooter();
  setupMobileNavigation();
  await renderManagedContent();
  setupDemoContactForm();
  setupRevealAnimation();
  updateYear();
});

function pageArea() {
  return document.body.dataset.area || "public";
}

function buildNavigation() {
  const menu = document.querySelector(".nav-list");
  const content = window.AICenterContent;
  if (!menu || !content) return;
  const current = location.pathname.split("/").pop() || "index.html";
  menu.innerHTML = content.publicNavigation.map((item) => {
    const active = item.href.split("#")[0] === current;
    const newTabAttributes = item.newTab ? ' target="_blank" rel="noopener"' : "";
    return `<li><a class="nav-link${active ? " is-active" : ""}" href="${item.href}"${newTabAttributes}${active ? ' aria-current="page"' : ""}>${item.label}</a></li>`;
  }).join("");
  document.querySelectorAll(".site-header .brand__text small").forEach((label) => {
    label.textContent = "AI GOVERNANCE & CLINICAL IMPLEMENTATION";
  });
}

function buildFooter() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="brand" href="index.html">
            <span class="brand__mark" aria-hidden="true"></span>
            <span class="brand__text">人工智慧中心<small>醫學研究部隸屬單位</small></span>
          </a>
          <p>整合醫療專業與人工智慧，推動安全、可信且可落地的智慧醫療應用。</p>
        </div>
        <div>
          <h3>網站入口</h3>
          <ul class="footer-links">
            <li><a href="index.html">人工智慧中心首頁</a></li>
            <li><a href="../index.html" target="_blank" rel="noopener">醫學研究部首頁 ↗</a></li>
            <li><a href="../units.html" target="_blank" rel="noopener">醫學研究部隸屬單位 ↗</a></li>
            <li><a href="../admin-demo/">內容管理 Demo</a></li>
          </ul>
        </div>
        <div>
          <h3>資料說明</h3>
          <ul class="footer-links">
            <li>基本介紹與聯絡資訊由醫研部共用資料同步</li>
            <li>申請條件及正式流程仍以院方公告為準</li>
            <li>表單為前端展示，不會送出或儲存資料</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span data-current-year></span> 亞東紀念醫院 人工智慧中心</span>
        <a href="../index.html" target="_blank" rel="noopener">前往醫學研究部 ↗</a>
      </div>
    </div>`;
}

function setupMobileNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-list");
  if (!toggle || !menu) return;
  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "開啟網站選單");
    menu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  };
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    toggle.setAttribute("aria-label", open ? "開啟網站選單" : "關閉網站選單");
    menu.classList.toggle("is-open", !open);
    document.body.classList.toggle("menu-open", !open);
  });
  menu.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  window.addEventListener("resize", () => { if (innerWidth > 1040) close(); });
}

async function loadPlatformUnit() {
  try {
    const response = await fetch("../data/units.json");
    if (!response.ok) throw new Error("無法讀取醫研部單位資料");
    const units = await response.json();
    const base = units.find((unit) => unit.id === "ai-center");
    if (!base) return null;
    let override = {};
    try {
      override = JSON.parse(localStorage.getItem("medresearch_demo_unit_ai-center") || "{}");
    } catch (error) {
      console.warn("人工智慧中心示意覆寫資料格式錯誤，已改用預設資料。", error);
    }
    return { ...base, ...override, contact: { ...base.contact, ...(override.contact || {}) } };
  } catch (error) {
    console.warn("目前無法同步醫學研究部單位資料，已使用子站預設內容。", error);
    return null;
  }
}

async function renderManagedContent() {
  const content = window.AICenterContent;
  if (!content) return;
  const unit = await loadPlatformUnit();
  const contact = unit?.contact ? {
    description: content.contact.description,
    person: unit.contact.person || content.contact.person,
    extension: unit.contact.phone || content.contact.extension,
    email: unit.contact.email || content.contact.email,
    location: unit.contact.address || content.contact.location,
  } : content.contact;

  setText("[data-content-name]", unit?.name || content.intro.name);
  setText("[data-content-slogan]", content.intro.slogan);
  setText("[data-content-description]", unit?.full_description || content.intro.description);
  setText("[data-usage-notice]", content.usageNotice);
  setText("[data-contact-description]", contact.description);
  Object.entries(contact).forEach(([key, value]) => setText(`[data-contact-${key}]`, value));

  const strategies = document.querySelector("[data-strategy-grid]");
  if (strategies) {
    strategies.innerHTML = content.strategies.map((item) => `<article class="strategy-panel reveal"><span class="strategy-panel__number">${item.number}</span><h3>${item.title}</h3><p>${item.description}</p></article>`).join("");
  }

  const services = document.querySelector("[data-services-grid]");
  const serviceItems = unit?.services?.length ? unit.services : content.services;
  if (services) {
    services.innerHTML = serviceItems.map((item, index) => `<li class="service-item reveal"><span>${String(index + 1).padStart(2, "0")}</span><strong>${item}</strong></li>`).join("");
  }
}

function setText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
}

function setupDemoContactForm() {
  const form = document.querySelector("[data-demo-form]");
  const message = document.querySelector("[data-form-message]");
  if (!form || !message) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      message.textContent = "請完成所有必填欄位。";
      return;
    }
    message.textContent = "這是前端展示表單，資料未送出。正式洽詢請依上方中心聯絡資訊辦理。";
  });
}

function setupRevealAnimation() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.08 });
  items.forEach((item) => observer.observe(item));
}

function updateYear() {
  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
}
