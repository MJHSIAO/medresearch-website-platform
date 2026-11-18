import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{}};vm.runInNewContext(readFileSync('assets/js/management-personnel.js','utf8'),sandbox);
const units=[{id:'a'},{id:'b'}];
const rows=sandbox.window.MedManagementPersonnel.grantRows([
  {identity:'UNIT-Z',role:'unit_admin',units:['b','a'],name:'Z'},
  {identity:'SITE',role:'site_admin',units:[],name:'A'},
  {identity:'ROOT',role:'system_admin',units:[],name:'Z'},
  {identity:'UNIT-A',role:'unit_admin',units:['a'],name:'A'}
],['BOOTSTRAP'],units);
assert.deepEqual(Array.from(rows,r=>r.identity),['BOOTSTRAP','ROOT','SITE','UNIT-A','UNIT-Z','UNIT-Z']);
assert.deepEqual(Array.from(rows,r=>r.unit),[null,null,null,'a','a','b']);
console.log('PASS personnel grouping: all-site group, existing role hierarchy, unit order, names, multi-unit rows');
