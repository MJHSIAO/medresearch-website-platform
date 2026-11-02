(function(){
  'use strict';
  window.MedAnnouncements={mount(slot,base){
    let snapshot='',observer,loading=false;
    function render(items){
      const active=items;const serialized=JSON.stringify(active);if(snapshot===serialized)return;snapshot=serialized;
      slot.replaceChildren();slot.hidden=!active.length;if(!active.length){observer?.disconnect();return;}
      const label=document.createElement('span');label.className='announcement-label';label.textContent='公告';slot.append(label);
      const viewport=document.createElement('div');viewport.className='announcement-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','網站公告，滑鼠移入或鍵盤聚焦時停止捲動');
      const track=document.createElement('div');track.className='announcement-track';
      for(const item of active){let url;try{url=item.href?new URL(item.href,base):null;}catch{}const linked=url&&['http:','https:'].includes(url.protocol);const node=document.createElement(linked?'a':'span');node.textContent=item.text;if(linked)node.href=url.href;track.append(node);}
      viewport.append(track);slot.append(viewport);
      const measure=()=>{track.style.setProperty('--travel-start',viewport.clientWidth+'px');track.style.animationDuration=Math.max(25,(track.scrollWidth+viewport.clientWidth)/45)+'s';};measure();observer?.disconnect();observer=new ResizeObserver(measure);observer.observe(viewport);
    }
    async function refresh(){if(loading||document.hidden)return;loading=true;try{const response=await fetch(new URL('api/announcements',base),{headers:{Accept:'application/json'},cache:'no-store'});if(response.ok&&response.headers.get('content-type')?.includes('application/json')){const result=await response.json();if(Array.isArray(result.items))render(result.items);}}catch{}finally{loading=false;}}
    render([]);refresh();
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);setInterval(refresh,30000);
  }};
})();
