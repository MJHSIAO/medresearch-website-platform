import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const chart=JSON.parse(readFileSync('data/organization.json','utf8'));
const isPublic=n=>['public','both'].includes(n.visibility)&&n.status==='active';
function context(search){
 const c=vm.createContext({window:{MedData:{escapeHTML:s=>String(s),isPublic,load:async()=>structuredClone(chart)}},document:{body:{classList:{add(){}}}},location:{search},URLSearchParams,performance});
 vm.runInContext(readFileSync('assets/js/department-directory.js','utf8'),c);return c;
}
const page={id:'department-about',groups:[{title:'隸屬單位',cards:[{title:'共同研究室',icon_unit_id:'core-laboratory',text:'SHARED_SUMMARY',actions:[]}]}]};
const before=JSON.stringify(page),regular=context('');
assert.equal((await regular.window.MedDepartmentDirectory.prepare(page)).groups[0].layout,'unit-directory','Approved layout is the default');
const c=context(''),P=c.window.MedDepartmentDirectory;
const result=await P.prepare(page);
assert.equal(JSON.stringify(page),before,'Never mutate the shared input');
assert.equal(result.groups[0].cards[0].text,'SHARED_SUMMARY');
assert.equal(result.groups[0].layout,'unit-directory');
assert.equal(result.groups[1].cards.length,7);
assert.equal((await P.prepare({id:'department-about',groups:[]})).groups.length,0,'Do not restore hidden department');
assert.equal(new Set(chart.supervised.map(n=>n.id)).size,7);
for(const n of chart.supervised){
 assert.ok(n.source_url.startsWith('https://depart.femh.org.tw/medresearch/'));
 assert.ok(n.source_checked_at==='2026-11-26'&&n.introduction&&n.responsibilities.length);
 const detail=await context('?supervised='+n.id).window.MedDepartmentDirectory.prepare({id:'governance',groups:[]});
 assert.equal(detail.title,n.label);
 assert.equal(detail.groups[0].cards[1].items.length,n.responsibilities.length);
}
// Test pointer behaviour independently of browser timing and screen dimensions.
const handlers={},classes=new Set(),captured=new Set();
const region={classList:{add:(...s)=>s.forEach(x=>classes.add(x)),remove:s=>classes.delete(s),toggle:(s,b)=>b?classes.add(s):classes.delete(s)},scrollLeft:0,scrollTop:0,addEventListener:(name,fn)=>{handlers[name]=fn;},hasPointerCapture:id=>captured.has(id),setPointerCapture:id=>captured.add(id),releasePointerCapture:id=>captured.delete(id)};
const dialog={querySelector:()=>region,classList:{contains:()=>false},addEventListener(){}};
vm.runInContext(readFileSync('assets/js/organization-chart.js','utf8'),c);
c.window.MedOrganizationChart.bindPan(dialog);
const pointer=(x,y,extra={})=>({pointerId:1,pointerType:'mouse',button:0,clientX:x,clientY:y,preventDefault(){},...extra});
handlers.pointerdown(pointer(500,400));handlers.pointermove(pointer(497,398));
assert.equal(region.scrollLeft,0,'Small motion remains a normal click');
handlers.pointerup(pointer(497,398));
let blocked=false;handlers.click({detail:1,preventDefault(){blocked=true;},stopPropagation(){}});assert.equal(blocked,false);
handlers.pointerdown(pointer(500,400));handlers.pointermove(pointer(300,250));
assert.equal(region.scrollLeft,200);assert.equal(region.scrollTop,150);assert.ok(captured.has(1));
handlers.pointerup(pointer(300,250));assert.equal(captured.size,0);assert.equal(classes.has('organization-panning'),false);
handlers.click({detail:1,preventDefault(){blocked=true;},stopPropagation(){}});assert.equal(blocked,true,'Dragging must not activate a link');
blocked=false;handlers.click({detail:0,preventDefault(){blocked=true;},stopPropagation(){}});assert.equal(blocked,false,'Keyboard links remain usable');
handlers.pointerdown(pointer(500,400,{pointerType:'touch'}));handlers.pointermove(pointer(200,200,{pointerType:'touch'}));assert.equal(region.scrollLeft,200,'Touch remains native scrolling');
handlers.pointerdown(pointer(500,400));handlers.pointermove(pointer(400,300));handlers.pointercancel();assert.equal(captured.size,0);
const governance={id:'governance',groups:[{cards:chart.supervised.map(n=>({title:n.label}))},{title:'Existing links',cards:[{title:'Preserved',actions:[]}]}]};
const directory=await P.prepare(governance);
assert.equal(directory.groups[0].id,'resource-group-1');
assert.equal(directory.groups[0].cards[2].legacy_anchor_ids[0],'governance-card-1-3');
assert.equal(directory.groups[1].title,'Existing links');
assert.ok(!P.supervisedUrl('biosafety').includes('preview='));
console.log('PASS default directory, shared summaries, hidden parent, seven introductions, legacy anchors/links, drag threshold/capture/click suppression/cancel and native touch');
