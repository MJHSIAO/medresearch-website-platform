import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, document: { body: {dataset:{root:'.'}}, addEventListener() {} }, URLSearchParams, Intl });
for (const file of ['data-service.js','search.js']) vm.runInContext(readFileSync(`assets/js/${file}`, 'utf8'), context);
const load = kind => JSON.parse(readFileSync(`data/${kind}.json`, 'utf8').replace(/^\uFEFF/, ''));
const { buildIndex, search } = context.window.MedSearch;
const units = load('units');
const unit = units.find(item => item.id === 'biobank');
const index = buildIndex(load('site'), units, load('people'), load('news'), load('pages'), load('documents'));
assert.equal(search(index, '人體生物資料庫')[0].href, './unit.html?unit=biobank');
for (const [query, anchor] of [['參與者退出','forms'], ['全基因體定序','fees'], ['倫理委員會名單','organization'], ['複雜檢索','fees']]) {
  assert.ok(search(index, query).some(item => item.href === `./unit.html?unit=biobank#biobank-${anchor}`), query);
}
for (const changed of [{...unit, visibility:'internal'}, {...unit, status:'inactive'}]) {
  const hidden = buildIndex(load('site'), units.map(item => item.id === 'biobank' ? changed : item), load('people'), load('news'));
  assert.ok(!hidden.some(item => item.href.includes('unit=biobank')));
  assert.ok(!search(hidden, '2023-06-12').some(item => item.href.includes('biobank-history')));
}
assert.ok(search(index, '2023-06-12').some(item => item.href.includes('biobank-history')));
console.log('PASS biobank search: unit discovery, form/fee/organization anchors, historical dates, internal/inactive exclusion');
