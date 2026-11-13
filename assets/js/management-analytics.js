/* Authenticated aggregates; scope and all values come from the server. */
(function(){
  'use strict';
  const {esc:e,icon,date}=window.MedManagementShell;
  const fmt=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}),count=value=>fmt.format(value);
  function metric(label,value,unit,note,symbol='file'){
    return `<article class="metric"><span class="metric-icon">${icon(symbol)}</span><div><div class="metric-label">${e(label)}</div><div class="metric-value">${count(value)}<small>${e(unit)}</small></div><div class="metric-foot">${e(note)}</div></div></article>`;
  }
  function summary(data){
    return `<section class="analytics-summary panel"><div class="panel-heading"><div><h2>網站瀏覽概況</h2><p class="panel-subtitle">${e(data.first_recorded?'自 '+date(data.first_recorded+'T00:00:00+08:00')+' 開始記錄':'尚未收到公開頁面的瀏覽紀錄')} · 授權範圍內的公開內容</p></div><button type="button" class="button" data-action="analytics">查看完整統計 ${icon('arrow')}</button></div><div class="metrics">${metric('今日瀏覽次數',data.today,'次','臺北時間 · 含今日目前累計','chart')}${metric('近 30 日瀏覽次數',data.views,'次','可重複計算，不等同瀏覽人數','chart')}</div></section>`;
  }
  function drawTrend(container,daily){
    const width=Math.max(230,Math.floor(container.getBoundingClientRect().width)),height=240;
    const left=50,right=16,top=18,bottom=36,plotWidth=width-left-right,plotHeight=height-top-bottom;
    const largest=Math.max(0,...daily.map(row=>row.views)),step=Math.max(1,Math.ceil(largest/4)),ceiling=step*4;
    const x=index=>left+index/(daily.length-1)*plotWidth,y=value=>top+plotHeight-value/ceiling*plotHeight;
    const ticks=width<400?[0,daily.length-1]:[0,Math.round((daily.length-1)/3),Math.round(2*(daily.length-1)/3),daily.length-1];
    const grid=Array.from({length:5},(_,i)=>{const value=i*step;return `<line x1="${left}" y1="${y(value)}" x2="${width-right}" y2="${y(value)}" class="analytics-grid"/><text x="${left-10}" y="${y(value)+5}" text-anchor="end">${count(value)}</text>`;}).join('');
    const labels=ticks.map(i=>`<text x="${x(i)}" y="${height-9}" text-anchor="${i===0?'start':i===daily.length-1?'end':'middle'}">${daily[i].date.slice(5).replace('-','/')}</text>`).join('');
    let started=false;
    const line=daily.map((row,i)=>{if(!row.tracked)return '';const point=`${started?'L':'M'}${x(i)},${y(row.views)}`;started=true;return point;}).join(' '),total=daily.reduce((n,row)=>n+row.views,0);
    container.innerHTML=`<svg class="analytics-trend-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="analytics-trend-desc"><title id="analytics-trend-desc">${e(daily[0].date)} 至 ${e(daily.at(-1).date)}，共 ${count(total)} 次公開頁面瀏覽；記錄開始前不繪製數值。下方可展開每日數值。</title>${grid}${labels}<path d="${line}" class="analytics-line" fill="none"/>${daily.map((row,i)=>row.tracked?`<circle cx="${x(i)}" cy="${y(row.views)}" r="3" class="analytics-point"><title>${e(row.date)}：${count(row.views)} 次</title></circle>`:'').join('')}</svg>`;
  }
  async function mount({target,api,session,message,isCurrent}){
    let days='30',unit='',ranking='pages',data=null,requestId=0;
    const own=session.profile.role==='unit_admin',units=[...session.units];
    if(!own)units.unshift({id:'medresearch',name:'醫學研究部主站'});
    target.innerHTML=`<div class="analytics-toolbar"><label>統計期間<select id="analytics-days"><option value="30">近 30 天</option><option value="7">近 7 天</option></select></label><label>統計範圍<select id="analytics-unit"><option value="">${own?'全部授權單位':'全站（含醫研部主站）'}</option>${units.map(u=>`<option value="${e(u.id)}">${e(u.name)}</option>`).join('')}</select></label><button type="button" class="button" id="analytics-refresh">更新統計</button></div><p id="analytics-status" class="analytics-period" role="status" aria-live="polite"></p><div id="analytics-output" hidden><div id="analytics-metrics" class="metrics"></div><section class="panel analytics-panel"><div class="panel-heading"><div><h2>每日瀏覽趨勢</h2><p id="analytics-trend-scope" class="panel-subtitle"></p></div><span class="analytics-tag">公開頁面</span></div><div id="analytics-trend" class="analytics-trend"></div><p class="analytics-chart-unit">單位：次 · 臺北時間</p><details class="analytics-daily"><summary>查看每日數值</summary><div class="table-container"><table class="data-table"><thead><tr><th scope="col">日期</th><th scope="col">瀏覽次數</th><th scope="col">文件下載</th></tr></thead><tbody id="analytics-daily-rows"></tbody></table></div></details></section><section class="panel analytics-panel"><div class="panel-heading"><div><h2>熱門內容</h2><p class="panel-subtitle">所選期間及範圍內的前 5 筆內容</p></div></div><div class="analytics-tabs" role="group" aria-label="排行類型">${[['pages','頁面瀏覽'],['news','消息瀏覽'],['downloads','文件下載']].map(([id,label])=>`<button type="button" class="analytics-tab" data-ranking="${id}" aria-pressed="${id===ranking}">${label}</button>`).join('')}</div><ol id="analytics-ranking" class="analytics-ranking" aria-label="熱門內容排行"></ol><div class="table-footer"><span id="analytics-rank-note"></span><span>依主要負責單位歸屬，不重複建檔</span></div></section></div><details class="analytics-definition"><summary>統計口徑與權限說明</summary><p>記錄有效公開頁面的成功 GET 請求；重新整理可重複計算，不等同瀏覽人數。排除管理者登入後的瀏覽、管理中心、院內內容、無效內容網址、預先載入、嵌入預覽與可辨識的爬蟲；不保證排除所有機器流量。</p><p>文件下載只計算公開文件「下載」入口的成功回應，不包含預覽、直接素材網址或外部網站下載，也不代表已完整傳輸檔案。已下架內容的歷史統計仍保留。</p><p>單位管理員只可查看授權單位，總管理員及系統管理員可查看全站。每日彙總不保存訪客 IP、帳號、Cookie、搜尋字詞或完整查詢網址。新版部署前的流量無法追溯。</p></details>`;
    const find=id=>target.querySelector('#'+id);
    function scopeName(){return unit?units.find(u=>u.id===unit)?.name||unit:own?'全部授權單位':'全站';}
    function renderRanking(){
      if(!data)return;
      target.querySelectorAll('[data-ranking]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.ranking===ranking)));
      const rows=data.rankings[ranking],max=rows[0]?.count||1;
      find('analytics-ranking').innerHTML=rows.length?rows.map((row,i)=>`<li><span class="analytics-rank-index">${String(i+1).padStart(2,'0')}</span><div class="analytics-rank-copy"><div class="analytics-rank-title">${e(row.title)}</div><div class="analytics-rank-unit">${e(row.unit==='medresearch'?'醫學研究部':units.find(u=>u.id===row.unit)?.name||row.unit)}</div><div class="analytics-track" aria-hidden="true"><span style="width:${row.count/max*100}%"></span></div></div><div class="analytics-rank-count">${count(row.count)}<small>次</small></div></li>`).join(''):'<li class="analytics-empty">此期間尚無'+(ranking==='downloads'?'文件下載':'瀏覽')+'紀錄。</li>';
      find('analytics-rank-note').textContent=ranking==='downloads'?'下載事件，與頁面瀏覽分開計算':'依內容的瀏覽次數排序';
    }
    function redraw(){if(isCurrent()&&data&&!find('analytics-output').hidden)drawTrend(find('analytics-trend'),data.daily);}
    async function load(){
      const id=++requestId;find('analytics-output').hidden=true;data=null;
      find('analytics-status').textContent='正在取得統計資料…';
      try{
        const result=await api('manage/analytics?'+new URLSearchParams({days,unit}));
        if(id!==requestId||!isCurrent())return;
        data=result;find('analytics-output').hidden=false;
        const period=`${date(data.start+'T00:00:00+08:00')} – ${date(data.end+'T00:00:00+08:00')}`;
        find('analytics-status').textContent=`${scopeName()} · ${period} · ${data.first_recorded?'自 '+date(data.first_recorded+'T00:00:00+08:00')+' 起記錄':'尚未收到公開瀏覽紀錄'} · 更新於 ${date(data.generated_at,true)}`;
        find('analytics-metrics').innerHTML=metric('期間瀏覽次數',data.views,'次','包含頁面與消息詳細頁','chart')+metric('平均每日瀏覽',data.tracked_days?data.views/data.tracked_days:0,'次／日',`有記錄期間共 ${data.tracked_days} 天（含今日）`,'chart')+metric('期間文件下載',data.downloads,'次','與頁面瀏覽分開計算','file');
        find('analytics-trend-scope').textContent=scopeName()+' · 公開頁面瀏覽次數';
        find('analytics-daily-rows').innerHTML=data.daily.map(row=>`<tr><th scope="row">${e(row.date)}</th><td>${row.tracked?count(row.views):'未開始記錄'}</td><td>${row.tracked?count(row.downloads):'未開始記錄'}</td></tr>`).join('');
        renderRanking();redraw();
      }catch(error){if(id!==requestId||!isCurrent())return;find('analytics-status').textContent='統計資料載入失敗，請按「更新統計」重試。';message(error.message,true);}
    }
    find('analytics-days').onchange=event=>{days=event.target.value;load();};
    find('analytics-unit').onchange=event=>{unit=event.target.value;load();};
    find('analytics-refresh').onclick=()=>{message('');load();};
    target.querySelectorAll('[data-ranking]').forEach(button=>{button.onclick=()=>{ranking=button.dataset.ranking;renderRanking();};});
    if(window.ResizeObserver){const observer=new ResizeObserver(()=>{if(!isCurrent()){observer.disconnect();return;}redraw();});observer.observe(find('analytics-trend'));}
    await load();
  }
  window.MedManagementAnalytics={mount,summary};
})();
