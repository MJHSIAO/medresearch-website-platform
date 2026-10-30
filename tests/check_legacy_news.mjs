import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const context = {window:{}};
vm.runInNewContext(await readFile('assets/js/legacy-news.js','utf8'),context);
const parse = context.window.MedLegacyNews.parse;
const original = {id:'demo-news-1234567890000',title:'Legacy fixture',content:['Original paragraph'],
  status:'published',visibility:'internal',published_at:'2026-10-01T09:00:00+08:00',owner_unit_id:'ai-center',attachments:[]};
const raw=JSON.stringify([original]);
const result=parse(raw);
assert.equal(result.items.length,1);
assert.equal(result.items[0].id,original.id);
assert.equal(result.items[0].status,'draft');
assert.equal(result.items[0].visibility,'internal');
assert.equal(result.items[0].content[0],'Original paragraph');
assert.equal(result.items[0].published_at,original.published_at);
assert.equal(original.status,'published');
assert.equal(parse(JSON.stringify([original,original,{id:'bad'},null])).skipped,3);
assert.equal(parse(null).items.length,0);
assert.throws(()=>parse('{broken'));
assert.throws(()=>parse('{}'));
assert.throws(()=>parse('null'));
for(const file of ['assets/js/management.js','assets/js/data-service.js','assets/js/legacy-news.js','ai-center/js/main.js','ai-center/js/news.js']) {
  const source=await readFile(file,'utf8');
  assert.doesNotMatch(source,/localStorage\s*\.\s*(?:setItem|removeItem|clear)\s*\(/,file);
}
console.log('PASS legacy import: stable ID, draft-only preparation, original dates, invalid input, no browser-storage writes');
