/* Store formatting as text runs, never arbitrary HTML. Shared public/editor rendering. */
(function(){
 'use strict';
 const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function normalize(runs){const out=[];for(const r of runs){if(!r.text)continue;const item={text:r.text,bold:!!r.bold,underline:!!r.underline},last=out[out.length-1];if(last&&last.bold===item.bold&&last.underline===item.underline)last.text+=item.text;else out.push(item);}return out;}
 function slice(runs,start,end){let position=0;return normalize(runs.flatMap(r=>{const from=Math.max(0,start-position),to=Math.min(r.text.length,end-position);position+=r.text.length;return to>from?[{...r,text:r.text.slice(from,to)}]:[];}));}
 function plain(runs){return runs.map(r=>r.text).join('');}
 function render(runs){return runs.map(r=>{let s=escape(r.text);if(r.underline)s='<u>'+s+'</u>';if(r.bold)s='<strong>'+s+'</strong>';return s;}).join('');}
 function citation(item,names=[]){
   const text=item.citation||'',source=item.runs?.length&&plain(item.runs)===text?item.runs:[{text}];
   const spans=[];const lower=text.toLowerCase();
   for(const name of [...new Set(names.map(n=>n.trim()).filter(Boolean))]){
     let at=0,needle=name.toLowerCase();while((at=lower.indexOf(needle,at))!==-1){const end=at+name.length,before=text[at-1]||'',after=text[end]||'';if(!/[\p{L}\p{N}]/u.test(before)&&!/[\p{L}\p{N}]/u.test(after))spans.push([at,end]);at=end;}
   }
   const cuts=[...new Set([0,text.length,...spans.flat()])].sort((a,b)=>a-b);const runs=[];
   for(let i=1;i<cuts.length;i++){const a=cuts[i-1],b=cuts[i],highlight=spans.some(([s,e])=>a>=s&&b<=e);runs.push(...slice(source,a,b).map(r=>({...r,bold:r.bold||highlight})));}
   return render(normalize(runs));
 }
 function fromDOM(root){
   const runs=[],blocked=new Set(['SCRIPT','STYLE','HEAD','META','LINK','IMG','IFRAME','OBJECT','SVG','MATH','TEMPLATE']);
   const add=(text,bold=false,underline=false)=>{if(text)runs.push({text:text.replace(/\r\n?/g,'\n'),bold,underline});};
   function walk(node,bold=false,underline=false){
     if(node.nodeType===3){add(node.nodeValue,bold,underline);return;}
     if(node.nodeType!==1&&node.nodeType!==11)return;
     if(blocked.has(node.tagName))return;
     if(node.tagName==='BR'){add('\n',bold,underline);return;}
     const style=node.style,weight=style?.fontWeight,decor=style?.textDecorationLine||style?.textDecoration||'';
     const b=['B','STRONG'].includes(node.tagName)||weight==='bold'||Number(weight)>=600||bold&&weight!=='normal'&&weight!=='400';
     const u=node.tagName==='U'||decor.includes('underline')||underline;
     const block=['P','DIV','LI','TR','H1','H2','H3','H4','BLOCKQUOTE'].includes(node.tagName);
     if(block&&runs.length&&!plain(runs).endsWith('\n'))add('\n');
     for(const child of node.childNodes)walk(child,b,u);
     if(block&&runs.length&&!plain(runs).endsWith('\n'))add('\n');
   }
   for(const child of root.childNodes)walk(child);
   return normalize(runs);
 }
 function pasted(html,text){if(!html)return [{text:text.replace(/\r\n?/g,'\n')}];const template=document.createElement('template');template.innerHTML=html;const runs=fromDOM(template.content);return slice(runs,0,plain(runs).replace(/\n+$/,'').length);}
 function editor({input,limit=5000}){
   const wrapper=document.createElement('div');wrapper.className='member-rich-wrapper';
   const id='rich-'+Math.random().toString(36).slice(2);const label=input.closest('label');
   wrapper.innerHTML=`<div class="member-format-toolbar" role="group" aria-label="文字格式"><button type="button" data-format="bold" aria-pressed="false">粗體</button><button type="button" data-format="underline" aria-pressed="false">底線</button><button type="button" data-format="clear">清除格式</button></div><div id="${id}" class="member-rich-input" contenteditable="true" role="textbox" aria-multiline="true" aria-label="${escape(label?.firstChild?.textContent||'成果內容')}"></div><p class="member-rich-hint" role="status">選取文字後可按粗體／底線，亦支援 Ctrl+B／Ctrl+U。貼上僅保留粗體、底線與換行。</p>`;
   input.hidden=true;input.required=false;input.parentElement.insertAdjacentElement('afterend',wrapper);label?.setAttribute('for',id);
   const area=wrapper.querySelector('[contenteditable]'),hint=wrapper.querySelector('[role=status]');let runs=[],saved={start:0,end:0};
   function selection(){const s=window.getSelection();if(s?.rangeCount&&area.contains(s.anchorNode)&&area.contains(s.focusNode)){const r=s.getRangeAt(0),pre=r.cloneRange();pre.selectNodeContents(area);pre.setEnd(r.startContainer,r.startOffset);saved={start:pre.toString().length,end:pre.toString().length+r.toString().length};}const selected=slice(runs,saved.start,saved.end);for(const b of wrapper.querySelectorAll('[data-format]'))if(b.dataset.format!=='clear')b.setAttribute('aria-pressed',String(!!selected.length&&selected.every(r=>r[b.dataset.format])));return saved;}
   function restore(start,end=start){area.focus();const walker=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);let node,offset=0,first=null,last=null;while((node=walker.nextNode())){if(!first&&start<=offset+node.length)first=[node,start-offset];if(end<=offset+node.length){last=[node,end-offset];break;}offset+=node.length;}const range=document.createRange();if(first&&last){range.setStart(...first);range.setEnd(...last);}else{range.selectNodeContents(area);range.collapse(false);}const s=window.getSelection();s.removeAllRanges();s.addRange(range);saved={start,end};selection();}
   function sync(){runs=fromDOM(area);input.value=plain(runs);input.dispatchEvent(new Event('input',{bubbles:true}));const count=Array.from(input.value).length;area.setAttribute('aria-invalid',String(count>limit));return count;}
   function set(next){runs=normalize(next);area.innerHTML=render(runs)||'';sync();saved={start:0,end:0};}
   function insert(next){sync();const {start,end}=selection(),all=plain(runs),nextText=plain(next);if(Array.from(all.slice(0,start)+nextText+all.slice(end)).length>limit){hint.textContent=`內容超過 ${limit} 字，未貼入，請分批處理。`;return;}set([...slice(runs,0,start),...next,...slice(runs,end,all.length)]);restore(start+nextText.length);hint.textContent='已貼入；保留粗體、底線與換行。';}
   function format(mark){sync();const {start,end}=selection();if(start===end){hint.textContent='請先選取要套用格式的文字。';return;}const selected=slice(runs,start,end),on=mark!=='clear'&&!selected.every(r=>r[mark]);const changed=selected.map(r=>mark==='clear'?{...r,bold:false,underline:false}:{...r,[mark]:on});set([...slice(runs,0,start),...changed,...slice(runs,end,plain(runs).length)]);restore(start,end);hint.textContent='文字格式已更新，儲存成果後套用。';}
   area.addEventListener('input',sync);area.addEventListener('mouseup',selection);area.addEventListener('keyup',selection);area.addEventListener('blur',selection);
   wrapper.querySelectorAll('[data-format]').forEach(b=>{b.onmousedown=e=>e.preventDefault();b.onclick=()=>format(b.dataset.format);});
   area.addEventListener('paste',event=>{event.preventDefault();insert(pasted(event.clipboardData.getData('text/html'),event.clipboardData.getData('text/plain')));});
   area.addEventListener('drop',event=>{event.preventDefault();hint.textContent='請使用貼上以保留文字格式。';});
   area.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&['b','u'].includes(event.key.toLowerCase())){event.preventDefault();format(event.key.toLowerCase()==='b'?'bold':'underline');}else if(event.key==='Enter'){event.preventDefault();insert([{text:'\n'}]);}});
   set([{text:input.value}]);
   return {set,get(){sync();return normalize(runs);},focus(){area.focus();},validate(){sync();if(!input.value.trim()||Array.from(input.value).length>limit){hint.textContent=`請填寫 1–${limit} 字成果內容。`;area.focus();return false;}return true;}};
 }
 window.MedMemberText={normalize,slice,plain,render,citation,pasted,editor};
})();
