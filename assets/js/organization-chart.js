(function () {
  'use strict';
  const D = window.MedData;
  const esc = D.escapeHTML;
  async function open(button) {
    button.disabled = true;
    let chart, units, pages;
    try { [chart, units, pages] = await Promise.all([D.load('organization'), D.getUnits(), D.load('pages')]); }
    catch {
      button.disabled = false;
      let error = button.parentElement.querySelector('[data-chart-error]');
      if (!error) { error = document.createElement('p'); error.dataset.chartError = ''; error.setAttribute('role','alert'); button.parentElement.append(error); }
      error.textContent = '組織架構暫時無法載入，請稍後再試。';
      return;
    }
    button.disabled = false;
    const unit = id => units.find(u => u.id === id && D.isPublic(u) && u.status === 'active');
    const href = id => id === 'medresearch' ? 'content-page.html?page=department-about' : `unit-about.html?unit=${encodeURIComponent(id)}`;
    const governance = pages.find(p => p.id === 'governance');
    const supervisionHref = item => {
      if(window.MedDepartmentDirectory && item.id) return window.MedDepartmentDirectory.supervisedUrl(item.id);
      for (let i=0;i<(governance?.groups||[]).length;i++) {
        const cardIndex = governance.groups[i].cards.findIndex(c=>c.title===item.label);
        if (cardIndex !== -1) return `content-page.html?page=governance#governance-card-${i+1}-${cardIndex+1}`;
      }
      return 'content-page.html?page=governance';
    };
    const nodes = chart.affiliated.filter(n => unit(n.unit_id));
    const link = (n, label, url) => {
      const [x,y,w,h] = n.rect;
      return `<a class="organization-hotspot" href="${esc(url)}" style="left:${x/chart.width*100}%;top:${y/chart.height*100}%;width:${w/chart.width*100}%;height:${h/chart.height*100}%" aria-label="${esc(label)}"><span class="sr-only">${esc(label)}</span></a>`;
    };
    const unitLink = n => `<a href="${href(n.unit_id)}">${esc(unit(n.unit_id).name)}</a>`;
    const dialog = document.createElement('dialog');
    dialog.className = 'organization-dialog organization-fit';
    dialog.setAttribute('aria-labelledby','organization-dialog-title');
    dialog.innerHTML = `<div class="organization-dialog-heading"><h2 id="organization-dialog-title">醫學研究部組織架構</h2><button type="button" class="button secondary" data-chart-close autofocus>關閉</button></div>
      <div class="organization-chart-tools"><p id="organization-chart-hint">點選圖中單位可閱讀介紹。可放大並在圖內捲動，或使用下方文字導覽。</p><button type="button" class="button secondary" data-chart-fit aria-pressed="true">放大閱讀</button></div>
      <div class="organization-chart-scroll" tabindex="0" role="region" aria-label="組織架構圖，可左右捲動" aria-describedby="organization-chart-hint"><div class="organization-chart-canvas"><img src="${esc(D.departmentChart)}" alt="醫學研究部組織架構圖：左側隸屬單位以實線連接，右側督導單位以虛線連接；完整層級見下方文字導覽。" width="${chart.width}" height="${chart.height}">
      ${link({rect:[510,148,480,88]},'醫學研究部介紹',href(chart.parent_unit_id))}
      ${nodes.map(n=>link(n,unit(n.unit_id).name+'介紹',href(n.unit_id)) + n.children.filter(c=>c.unit_id&&unit(c.unit_id)&&c.rect).map(c=>link(c,unit(c.unit_id).name+'介紹',href(c.unit_id))).join('')).join('')}
      ${chart.supervised.map(n=>link(n,n.label+'介紹',supervisionHref(n))).join('')}</div></div>
      <details class="organization-text"><summary>組織架構文字導覽與單位連結</summary><p><strong>${esc(unit(chart.parent_unit_id)?.name || '醫學研究部')}</strong></p><div class="organization-text-columns"><section><h3>隸屬單位</h3><p>醫學研究部之正式組織編制（實線）</p><ul>${nodes.map(n=>`<li>${window.MedUI.unitIcon(n.unit_id)}${unitLink(n)}${n.children.length?`<ul>${n.children.map(c=>c.unit_id ? (unit(c.unit_id)?`<li>${unitLink(c)}</li>`:'') : `<li>${esc(c.label)}</li>`).join('')}</ul>`:''}</li>`).join('')}</ul></section><section><h3>督導單位</h3><p>業務督導・非隸屬編制（虛線）</p><ul>${chart.supervised.map(n=>`<li><a href="${esc(supervisionHref(n))}">${esc(n.label)}</a></li>`).join('')}</ul></section></div></details>`;
    dialog.querySelector('[data-chart-close]').onclick = () => dialog.close();
    const pan = bindPan(dialog);
    if (pan) dialog.querySelector('#organization-chart-hint').textContent = '點選單位可閱讀介紹。放大後可按住滑鼠左鍵拖曳，也可聚焦圖面後用方向鍵捲動。';
    dialog.querySelector('[data-chart-fit]').onclick = event => {
      const fit = dialog.classList.toggle('organization-fit');
      event.currentTarget.setAttribute('aria-pressed', String(fit));
      event.currentTarget.textContent = fit ? '放大閱讀' : '顯示完整圖';
      pan?.reset();
    };
    dialog.addEventListener('close', () => { dialog.remove(); button.focus(); });
    document.body.append(dialog);
    dialog.showModal();
    if (matchMedia('(max-width:600px)').matches) dialog.querySelector('details').open = true;
  }
  function bindPan(dialog) {
    const region=dialog.querySelector('.organization-chart-scroll');
    let active=null, suppressClickUntil=0;
    region.classList.add('organization-pan-enabled','organization-pan-fit');
    const stop=()=>{
      if(active && region.hasPointerCapture(active.id))region.releasePointerCapture(active.id);
      active=null;region.classList.remove('organization-panning');
    };
    region.addEventListener('dragstart',event=>event.preventDefault());
    region.addEventListener('pointerdown',event=>{
      if(event.pointerType!=='mouse'||event.button!==0||dialog.classList.contains('organization-fit'))return;
      active={id:event.pointerId,x:event.clientX,y:event.clientY,left:region.scrollLeft,top:region.scrollTop,dragged:false};
    });
    region.addEventListener('pointermove',event=>{
      if(!active||event.pointerId!==active.id)return;
      const dx=event.clientX-active.x,dy=event.clientY-active.y;
      if(!active.dragged && Math.hypot(dx,dy)<6)return;
      if(!active.dragged){active.dragged=true;region.setPointerCapture(active.id);region.classList.add('organization-panning');}
      event.preventDefault();region.scrollLeft=active.left-dx;region.scrollTop=active.top-dy;
    });
    region.addEventListener('pointerup',event=>{
      if(active?.id!==event.pointerId)return;
      if(active.dragged)suppressClickUntil=performance.now()+500;
      stop();
    });
    region.addEventListener('pointercancel',stop);
    region.addEventListener('lostpointercapture',()=>{active=null;region.classList.remove('organization-panning');});
    region.addEventListener('pointerleave',()=>{if(active&&!active.dragged)stop();});
    region.addEventListener('click',event=>{
      if(event.detail!==0 && performance.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();suppressClickUntil=0;}
    },true);
    dialog.addEventListener('close',stop);
    return {reset(){stop();region.classList.toggle('organization-pan-fit',dialog.classList.contains('organization-fit'));}};
  }
  window.MedOrganizationChart = { open, bindPan };
})();
