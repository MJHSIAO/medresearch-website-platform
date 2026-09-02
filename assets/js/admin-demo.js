(function () {
  'use strict';

  const D = window.MedData;
  const roles = {
    'unit-editor': { label: '人工智慧中心編輯者', ownUnit: true, publish: false, allUnits: false, department: false, system: false },
    'unit-admin': { label: '人工智慧中心管理員', ownUnit: true, publish: true, allUnits: false, department: false, system: false },
    'department-admin': { label: '醫學研究部總管理員', ownUnit: true, publish: true, allUnits: true, department: true, system: false },
    'system-admin': { label: '系統管理員', ownUnit: false, publish: false, allUnits: true, department: false, system: true }
  };

  const navItems = [
    { href: 'index.html', label: '後台首頁', permission: 'any' },
    { href: 'news-edit.html', label: '新增最新消息', permission: 'content' },
    { href: 'news-list.html', label: '管理最新消息', permission: 'content' },
    { href: 'unit-profile.html', label: '修改單位介紹', permission: 'content' },
    { href: 'media.html', label: '圖片與附件', permission: 'content' },
    { href: '../ai-center/index.html', label: '預覽單位網站', permission: 'content', external: true },
    { href: 'audit-log.html', label: '操作紀錄', permission: 'audit' },
    { href: 'index.html#system-demo', label: '版型與系統設定', permission: 'system' }
  ];

  function getRoleId() { return localStorage.getItem(D.keys.role) || 'unit-editor'; }
  function getRole() { return roles[getRoleId()] || roles['unit-editor']; }
  function allowed(permission) {
    const role = getRole();
    if (permission === 'any') return true;
    if (permission === 'content') return role.ownUnit || role.department;
    if (permission === 'audit') return role.ownUnit || role.department || role.system;
    if (permission === 'system') return role.system;
    return false;
  }

  function renderShell() {
    const header = document.getElementById('admin-header');
    const sidebar = document.getElementById('admin-sidebar');
    if (!header || !sidebar) return;
    const current = location.pathname.split('/').pop() || 'index.html';
    header.innerHTML = `<div class="admin-topbar"><div class="container admin-topbar-row"><a class="admin-brand" href="index.html">醫學研究部｜內容管理 Demo</a><div class="button-row"><span class="admin-demo-label">此為 UI Demo，不代表正式權限驗證</span><button class="button secondary admin-mobile-toggle" id="admin-menu-toggle" type="button" aria-expanded="false" aria-controls="admin-sidebar">管理選單</button></div></div></div>`;
    sidebar.innerHTML = `<div class="role-box"><label for="role-switcher">示意角色切換</label><select id="role-switcher">${Object.entries(roles).map(([id, role]) => `<option value="${id}"${id === getRoleId() ? ' selected' : ''}>${role.label}</option>`).join('')}</select><small>切換只改變畫面示意，不是正式授權。</small></div><nav class="admin-nav" aria-label="後台功能"><ul>${navItems.filter((item) => allowed(item.permission)).map((item) => `<li><a href="${item.href}"${current === item.href.split('?')[0] ? ' aria-current="page"' : ''}${item.external ? ' target="_blank" rel="noopener"' : ''}>${item.label}</a></li>`).join('')}</ul></nav><p><button class="button ghost" id="reset-demo" type="button">重設示意資料</button></p>`;
    const switcher = document.getElementById('role-switcher');
    switcher.addEventListener('change', () => {
      localStorage.setItem(D.keys.role, switcher.value);
      D.addAudit(`切換示意角色為「${roles[switcher.value].label}」`);
      location.reload();
    });
    document.getElementById('reset-demo').addEventListener('click', () => {
      if (window.confirm('確定要清除所有瀏覽器內的 Demo 修改嗎？')) {
        D.resetDemo();
        location.href = 'index.html';
      }
    });
    const menuButton = document.getElementById('admin-menu-toggle');
    if (menuButton) {
      const sync = () => { sidebar.hidden = matchMedia('(max-width: 48rem)').matches && menuButton.getAttribute('aria-expanded') !== 'true'; };
      menuButton.addEventListener('click', () => { menuButton.setAttribute('aria-expanded', String(menuButton.getAttribute('aria-expanded') !== 'true')); sync(); });
      matchMedia('(max-width: 48rem)').addEventListener('change', sync);
      sync();
    }
  }

  function permissionBanner() {
    const target = document.getElementById('permission-note');
    if (target) target.innerHTML = `<strong>目前角色：${D.escapeHTML(getRole().label)}</strong><br>${getRole().allUnits ? '可查看全部單位範圍。' : '管理範圍僅限人工智慧中心。'}正式系統必須由後端驗證權限。`;
  }

  async function renderDashboard() {
    const actions = document.getElementById('admin-actions');
    if (!actions) return;
    const role = getRole();
    const departmentDemo = document.getElementById('department-demo');
    const systemDemo = document.getElementById('system-demo');
    if (departmentDemo) departmentDemo.hidden = !role.department;
    if (systemDemo) systemDemo.hidden = !role.system;
    const contentActions = [
      ['新增最新消息', 'news-edit.html', '建立草稿或送出確認'],
      ['管理最新消息', 'news-list.html', '查找與管理消息狀態'],
      ['修改單位介紹', 'unit-profile.html', '同步更新單位公開資訊'],
      ['圖片與附件', 'media.html', '瀏覽器端預覽示意'],
      ['修改服務項目', 'unit-profile.html#services', '維護單位服務內容'],
      ['管理成員', 'unit-profile.html#members', '維護主管及成員資料'],
      ['修改聯絡資訊', 'unit-profile.html#contact', '維護公開聯絡窗口'],
      ['預覽單位網站', '../ai-center/index.html', '檢視目前資料呈現']
    ];
    const systemActions = [
      ['版型管理', '#system-demo', '系統管理員示意入口'],
      ['帳號及角色', '#system-demo', '正式階段才會實作'],
      ['系統設定', '#system-demo', '正式階段才會實作'],
      ['操作紀錄', 'audit-log.html', '查看全站示意紀錄']
    ];
    const departmentActions = [
      ['管理醫研部首頁', '#department-demo', '推薦內容與首頁設定示意'],
      ['調整單位排序', '#department-demo', '結構性欄位示意'],
      ['推薦消息至主站', 'news-list.html', '檢視全站消息'],
      ['全站操作紀錄', 'audit-log.html', '查看所有示意紀錄']
    ];
    const set = role.system ? systemActions : (role.department ? [...contentActions.slice(0, 4), ...departmentActions] : contentActions);
    actions.innerHTML = set.map(([title, href, description]) => `<article class="card admin-action interactive"><h2><a href="${href}">${title}</a></h2><p>${description}</p></article>`).join('');
    const scope = document.getElementById('unit-scope');
    if (scope) {
      const units = await D.getUnits();
      if (role.allUnits) {
        scope.innerHTML = `<h2>${role.system ? '可檢視的系統範圍' : '可管理單位'}</h2><div class="table-wrap"><table><thead><tr><th>單位</th><th>網址代碼</th><th>狀態</th></tr></thead><tbody>${units.map((unit) => `<tr><td>${D.escapeHTML(unit.name)}</td><td>${D.escapeHTML(unit.slug)}</td><td>${unit.status === 'active' ? '啟用' : D.escapeHTML(unit.status)}</td></tr>`).join('')}</tbody></table></div>`;
      } else {
        scope.innerHTML = '<h2>管理範圍</h2><div class="card"><strong>人工智慧中心</strong><p>看不到其他單位的編輯入口。</p></div>';
      }
    }
  }

  async function renderUnitForm() {
    const form = document.getElementById('unit-form');
    if (!form) return;
    if (!allowed('content')) { form.replaceWith(denied('系統管理員畫面不提供一般內容編輯入口。')); return; }
    const unit = await D.getUnit('ai-center');
    const values = {
      name: unit.name, slug: unit.slug, short_description: unit.short_description,
      full_description: unit.full_description, purpose: unit.purpose,
      goals: unit.goals.join('\n'), services: unit.services.join('\n'),
      research_fields: unit.research_fields.join('\n'), members: unit.members.join('\n'),
      contact_person: unit.contact.person, contact_phone: unit.contact.phone,
      contact_email: unit.contact.email, contact_address: unit.contact.address,
      hero_alt: unit.hero_alt, updated_at: D.formatDate(unit.updated_at)
    };
    Object.entries(values).forEach(([name, value]) => { const control = form.elements[name]; if (control) control.value = value; });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const required = ['short_description', 'full_description', 'contact_person', 'hero_alt'];
      const invalid = required.filter((name) => !form.elements[name].value.trim());
      form.querySelectorAll('[aria-invalid="true"]').forEach((control) => control.removeAttribute('aria-invalid'));
      if (invalid.length) {
        invalid.forEach((name) => form.elements[name].setAttribute('aria-invalid', 'true'));
        showStatus('unit-save-status', '請完成所有必填欄位；錯誤不只以顏色表示。', true);
        form.elements[invalid[0]].focus();
        return;
      }
      const next = { ...unit,
        short_description: form.elements.short_description.value.trim(), full_description: form.elements.full_description.value.trim(), purpose: form.elements.purpose.value.trim(),
        goals: lines(form.elements.goals.value), services: lines(form.elements.services.value), research_fields: lines(form.elements.research_fields.value), members: lines(form.elements.members.value),
        contact: { person: form.elements.contact_person.value.trim(), phone: form.elements.contact_phone.value.trim(), email: form.elements.contact_email.value.trim(), address: form.elements.contact_address.value.trim() },
        hero_alt: form.elements.hero_alt.value.trim(), updated_at: new Date().toISOString(), updated_by: getRole().label
      };
      D.saveUnit(next);
      showStatus('unit-save-status', '已儲存於此瀏覽器的 localStorage。公開站預覽會同步使用同一筆單位資料。');
      form.elements.updated_at.value = D.formatDate(next.updated_at);
    });
  }

  async function renderNewsList() {
    const body = document.getElementById('admin-news-body');
    if (!body) return;
    if (!allowed('content')) { body.closest('.table-wrap').replaceWith(denied('此角色沒有一般內容管理入口。')); return; }
    const all = await D.getNews();
    const role = getRole();
    const visible = (role.allUnits ? all : all.filter((item) => item.owner_unit_id === 'ai-center')).sort((a,b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    body.innerHTML = visible.map((item) => `<tr><td><strong>${D.escapeHTML(item.title)}</strong><br><small>${D.escapeHTML(item.category)}</small></td><td>${item.owner_unit_id === 'medresearch' ? '醫學研究部' : D.escapeHTML(item.owner_unit_id)}</td><td><span class="tag ${item.status}">${D.statusLabels[item.status] || item.status}</span></td><td>${item.visibility === 'internal' ? '<span class="tag internal">院內</span>' : D.escapeHTML(item.visibility)}</td><td>${D.formatDate(item.updated_at)}</td><td>${role.allUnits || item.owner_unit_id === 'ai-center' ? '<a href="news-edit.html?id=' + encodeURIComponent(item.id) + '">編輯</a>' : '僅檢視'}</td></tr>`).join('');
    document.getElementById('admin-news-count').textContent = `顯示 ${visible.length} 則；${role.allUnits ? '全部單位' : '僅人工智慧中心'}`;
  }

  async function renderNewsForm() {
    const form = document.getElementById('news-form');
    if (!form) return;
    if (!allowed('content')) { form.replaceWith(denied('此角色沒有一般內容編輯入口。')); return; }
    const id = new URLSearchParams(location.search).get('id');
    const all = await D.getNews();
    const existing = all.find((item) => item.id === id);
    if (existing && !getRole().allUnits && existing.owner_unit_id !== 'ai-center') { form.replaceWith(denied('一般單位管理者不能修改其他單位消息。')); return; }
    if (existing) {
      const values = { title: existing.title, category: existing.category, summary: existing.summary, content: existing.content.join('\n\n'), cover_alt: existing.cover_alt, published_at: dateInput(existing.published_at), event_date: dateInput(existing.event_date), expires_at: dateInput(existing.expires_at), visibility: existing.visibility, status: existing.status };
      Object.entries(values).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value || ''; });
      form.elements.owner_unit.value = existing.owner_unit_id === 'medresearch' ? '醫學研究部（由登入身分帶入）' : '人工智慧中心（由登入身分帶入）';
    }
    document.querySelector('[data-publish-button]').hidden = !getRole().publish;
    form.addEventListener('click', (event) => {
      const button = event.target.closest('[data-save-action]');
      if (!button) return;
      event.preventDefault();
      const action = button.dataset.saveAction;
      if (action === 'cancel') { location.href = 'news-list.html'; return; }
      if (action === 'preview') { showStatus('news-save-status', '預覽示意：請先儲存草稿，再從消息列表開啟。'); return; }
      const required = ['title', 'summary', 'content'];
      const invalid = required.filter((name) => !form.elements[name].value.trim());
      form.querySelectorAll('[aria-invalid="true"]').forEach((control) => control.removeAttribute('aria-invalid'));
      if (invalid.length) {
        invalid.forEach((name) => form.elements[name].setAttribute('aria-invalid', 'true'));
        showStatus('news-save-status', '請填寫標題、摘要與內文後再儲存。', true);
        form.elements[invalid[0]].focus();
        return;
      }
      let status = action === 'publish' && getRole().publish ? 'published' : action === 'review' ? 'pending_review' : 'draft';
      const now = new Date().toISOString();
      const ownerId = existing?.owner_unit_id || 'ai-center';
      const item = { ...(existing || {}), id: existing?.id || `demo-news-${Date.now()}`, owner_unit_id: ownerId, related_unit_ids: existing?.related_unit_ids || [], category: form.elements.category.value, title: form.elements.title.value.trim(), summary: form.elements.summary.value.trim(), content: form.elements.content.value.split(/\n\s*\n/).filter(Boolean), cover_image: '', cover_alt: form.elements.cover_alt.value.trim() || '消息封面示意圖', attachments: existing?.attachments || [], visibility: form.elements.visibility.value, status, published_at: status === 'published' ? (form.elements.published_at.value || now) : (existing?.published_at || ''), event_date: form.elements.event_date.value, expires_at: form.elements.expires_at.value, created_at: existing?.created_at || now, updated_at: now, created_by: existing?.created_by || getRole().label, updated_by: getRole().label, featured: existing?.featured || false };
      D.saveNews(item);
      form.elements.status.value = status;
      showStatus('news-save-status', `已${status === 'published' ? '發布' : status === 'pending_review' ? '送出確認' : '儲存草稿'}；資料保留於此瀏覽器的 localStorage。`);
    });
  }

  function renderMedia() {
    const input = document.getElementById('media-file');
    if (!input) return;
    if (!allowed('content')) { input.closest('.card').replaceWith(denied('此角色沒有單位媒體管理入口。')); return; }
    input.addEventListener('change', () => {
      const file = input.files[0];
      const preview = document.getElementById('media-preview');
      if (!file) { preview.hidden = true; return; }
      const max = 5 * 1024 * 1024;
      if (file.size > max) { showStatus('media-status', '檔案超過 5 MB 示意限制，尚未上傳。', true); input.value = ''; return; }
      preview.hidden = false;
      preview.querySelector('[data-file-name]').textContent = file.name;
      preview.querySelector('[data-file-meta]').textContent = `${file.type || '未知格式'} · ${(file.size / 1024).toFixed(1)} KB`;
      const image = document.getElementById('image-preview');
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => { image.src = reader.result; image.alt = document.getElementById('media-alt').value || '尚未填寫替代文字的預覽圖片'; image.hidden = false; };
        reader.readAsDataURL(file);
      } else { image.hidden = true; }
      showStatus('media-status', '僅建立瀏覽器端預覽，檔案未上傳至伺服器。');
    });
    document.getElementById('remove-media').addEventListener('click', () => { input.value = ''; document.getElementById('media-preview').hidden = true; document.getElementById('image-preview').hidden = true; showStatus('media-status', '已移除瀏覽器端預覽。'); });
  }

  function renderAudit() {
    const body = document.getElementById('audit-body');
    if (!body) return;
    const entries = D.readLocal(D.keys.audit, []);
    const role = getRole();
    const visible = role.allUnits ? entries : entries.filter((entry) => ['unit-editor', 'unit-admin'].includes(entry.role));
    body.innerHTML = visible.length ? visible.map((entry) => `<tr><td>${D.formatDate(entry.time)} ${new Date(entry.time).toLocaleTimeString('zh-TW', {hour:'2-digit', minute:'2-digit'})}</td><td>${D.escapeHTML(roles[entry.role]?.label || entry.role)}</td><td>${D.escapeHTML(entry.action)}</td><td>localStorage Demo</td></tr>`).join('') : '<tr><td colspan="4">目前沒有示意操作紀錄。</td></tr>';
    document.getElementById('audit-scope').textContent = role.allUnits ? '顯示全站示意紀錄' : '僅顯示自己的單位示意紀錄';
  }

  function lines(value) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }
  function dateInput(value) { return value ? String(value).slice(0, 10) : ''; }
  function showStatus(id, message, error = false) { const target = document.getElementById(id); if (!target) return; target.hidden = false; target.classList.toggle('error', error); target.textContent = message; target.focus?.(); }
  function denied(message) { const box = document.createElement('div'); box.className = 'empty-state'; box.innerHTML = `<h2>此角色沒有這項功能</h2><p>${D.escapeHTML(message)}</p><a class="button secondary" href="index.html">返回後台首頁</a>`; return box; }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      renderShell(); permissionBanner();
      await renderDashboard(); await renderUnitForm(); await renderNewsList(); await renderNewsForm();
      renderMedia(); renderAudit();
    } catch (error) {
      console.error(error);
      const main = document.querySelector('.admin-main-inner');
      if (main) main.insertAdjacentHTML('afterbegin', '<div class="status-message error" role="alert">Demo 資料暫時無法載入，請重新整理。</div>');
    }
  });
})();

