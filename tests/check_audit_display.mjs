import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

let html='';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sandbox={window:{MedManagementShell:{esc,date:()=> '日期'}},document:{getElementById:()=>({addEventListener(){}})},history:{replaceState(){}}};
vm.runInNewContext(readFileSync('assets/js/management-views.js','utf8'),sandbox);
const items=[
  {actor:'TEST-A',actor_name:'測試管理員甲',action:'儲存內容',id:'test'},
  {actor:'OLD-ID',action:'歷史操作',id:'old'},
  {actor:'TEST-B',actor_name:['invalid'],action:'儲存內容',id:'test'},
  {actor:'TEST-C',actor_name:'<img src=x onerror=alert(1)>',action:'儲存內容',id:'test'}
];
const views=sandbox.window.MedManagementViews.create({message(){},api:async()=>({items}),shell:{valid:()=>true,select(){},unitName:id=>id,frame:(_title,_description,content)=>{html=content;}}});
await views.render('audit');
assert.match(html,/測試管理員甲（TEST-A）/);
assert.match(html,/OLD-ID · 日期/);
assert.doesNotMatch(html,/undefined|OLD-ID）|invalid|<img/);
assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;（TEST-C）/);
console.log('PASS audit full-name/ID display, legacy fallback, malformed-name fallback and HTML escaping');
