import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

if(process.argv.length<5)throw Error('Arguments: Playwright module, browser executable, Python executable');
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const child=spawn(process.argv[4],['-m','tests.serve_management_fixture','--port',String(port)],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],windowsHide:true});
let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
const base=`http://127.0.0.1:${port}/medresearch/`;
let browser;
try{
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){
    if(child.exitCode!==null)throw Error('Fixture exited: '+output);
    try{ready=(await fetch(base+'healthz')).ok;}catch{}
    if(ready)break;await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,'fixture ready');
  browser=await chromium.launch({executablePath:process.argv[3],headless:true});
  const errors=[];
  async function checkPublic(page,role,firstTitle){
    await page.goto(base+'index.html');await page.locator('#home-news .card').first().waitFor();
    if(role!=='visitor')await page.locator('.account-actions .auth-user-name').waitFor();
    assert.equal(await page.locator('.account-actions').getByText('院內專區',{exact:true}).count(),['system','site','unit','multi'].includes(role)?1:0);
    assert.equal(await page.locator('.account-actions').getByText('院內人員登入',{exact:true}).count(),role==='visitor'?1:0);
    assert.equal(await page.locator('.main-nav .auth-user-name,.main-nav .account-actions').count(),0);
    assert.match(await page.locator('#home-news .card').first().innerText(),new RegExp(firstTitle));
    assert.doesNotMatch(await page.locator('#home-news').innerText(),/SERVER-AI-DRAFT/);
    for(const width of [1440,768,320]){
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'public '+role+' '+width);
    }
    await page.setViewportSize({width:1440,height:1000});
  }
  const visitorContext=await browser.newContext();const visitor=await visitorContext.newPage();
  await checkPublic(visitor,'visitor','SERVER-AI-PUBLISHED');
  // The browser hint cookie never grants a management link or role.
  await visitorContext.addCookies([{name:'medresearch_auth',value:'1',url:base}]);
  await checkPublic(visitor,'visitor','SERVER-AI-PUBLISHED');
  async function account(role){const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'__fixture_login/'+role);if(role!=='ordinary')await page.locator('#role-label').filter({hasText:/管理員/}).waitFor();return {context,page};}
  const {context:rootContext,page}=await account('system');
  await checkPublic(page,'system','SERVER-AI-PUBLISHED');await page.goto(base+'admin');
  await page.getByRole('heading',{name:'管理工作台',exact:true}).waitFor();
  assert.equal(await page.locator('#role-label').textContent(),'系統管理員');
  assert.equal(await page.locator('#unit-label').textContent(),'全部單位');
  assert.equal(await page.locator('[data-route=grants],[data-route=theme],[data-route=site]').count(),3);
  assert.equal(await page.locator('.metric-value').first().innerText(),'2則');
  assert.doesNotMatch(await page.locator('body').innerText(),/外觀預覽|示例|範例資料|role-switcher/);
  await page.locator('[data-route=news]').click();await page.locator('#news-table tbody tr').filter({hasText:'SERVER-AI'}).first().waitFor();
  assert.equal(await page.locator('#news-table tbody tr').count(),3);
  await page.locator('[data-filter=draft]').click();assert.equal(await page.locator('#news-table tbody tr').count(),1);
  await page.getByRole('button',{name:'新增消息',exact:true}).click();await page.locator('#news-editor').waitFor();
  await page.locator('[name=unit]').selectOption('ai-center');
  await page.locator('[name=title]').fill('SERVER-SAVED-THROUGH-FORM');await page.locator('[name=summary]').fill('Server-persisted summary');await page.locator('[name=paragraphs]').fill('Persisted paragraph one\n\nPersisted paragraph two');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1kAAAAASUVORK5CYII=','base64');
  await page.locator('[name=files]').setInputFiles([{name:'測試海報.png',mimeType:'image/png',buffer:png},{name:'附件.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nFixture')}]);
  await page.waitForFunction(()=>document.querySelectorAll('.news-edit-file').length===2);
  await page.getByRole('button',{name:'儲存草稿',exact:true}).click();await page.getByRole('heading',{name:'編輯消息',exact:true}).first().waitFor();
  assert.match(await page.locator('#status').textContent(),/草稿已保存到伺服器/);
  await page.getByRole('button',{name:'查看歷史版本',exact:true}).click();await page.locator('#versions details').first().waitFor();
  await page.getByRole('button',{name:'發布',exact:true}).click();await page.locator('#status').filter({hasText:'消息已發布'}).waitFor();
  const published=await(await page.request.get(base+'data/news.json')).json();
  assert.ok(published.some(item=>item.title==='SERVER-SAVED-THROUGH-FORM'));
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  await page.locator('[data-route=media]').click();await page.locator('.file-card').filter({hasText:'附件.pdf'}).waitFor();
  assert.equal(await page.locator('.file-card').count(),2);
  const library=await(await page.request.get(base+'api/manage/files')).json();
  assert.ok(library.items.some(item=>item.name==='測試海報.png'));
  const rootMetadata=await(await page.request.get(base+'api/manage')).json();
  const foreign=await(await page.request.post(base+'api/manage/files/core-laboratory',{headers:{'Content-Type':'application/pdf','X-CSRF-Token':rootMetadata.csrf,'X-File-Name':'foreign.pdf'},data:Buffer.from('%PDF-1.4\nForeign fixture')})).json();
  await page.locator('[data-route=grants]').click();await page.getByRole('button',{name:'新增授權',exact:true}).click();
  await page.locator('#grant [name=identity]').fill('FIXTURE-NEW-UNIT');await page.locator('#grant [name=units][value=ai-center]').check();await page.getByRole('button',{name:'儲存授權',exact:true}).click();
  await page.locator('td').filter({hasText:'FIXTURE-NEW-UNIT'}).waitFor();assert.match(await page.locator('#status').textContent(),/授權已更新/);
  await page.locator('[data-route=theme]').click();await page.locator('#editor [name=accent]').fill('#226655');await page.locator('#editor [name=width]').selectOption('1320');await page.locator('#editor [type=submit]').click();
  await page.locator('#status').filter({hasText:'已儲存至伺服器'}).waitFor();assert.match(await(await page.request.get(base+'theme.css')).text(),/#226655/);
  await page.locator('[data-route=news]').click();await page.getByRole('button',{name:'匯入舊消息',exact:true}).click();
  await page.locator('.editor-panel').filter({hasText:'匯入舊消息到伺服器'}).waitFor();
  await page.evaluate(()=>localStorage.setItem('medresearch_demo_news',JSON.stringify([{id:'demo-news-1234567890011',title:'SERVER-LEGACY-IMPORT',summary:'Legacy summary',content:['Legacy body'],owner_unit_id:'ai-center',status:'published',visibility:'public',attachments:[]}])));
  const raw=await page.evaluate(()=>localStorage.getItem('medresearch_demo_news'));
  await page.locator('[data-route=news]').click();await page.getByRole('button',{name:'匯入舊消息',exact:true}).click();await page.getByRole('button',{name:'預覽並匯入',exact:true}).click();await page.getByRole('button',{name:'匯入為伺服器草稿',exact:true}).click();
  await page.locator('#news-editor [name=title]').filter({visible:true}).waitFor();assert.equal(await page.locator('#news-editor [name=title]').inputValue(),'SERVER-LEGACY-IMPORT');assert.equal(await page.evaluate(()=>localStorage.getItem('medresearch_demo_news')),raw);
  const {context:unitContext,page:unit}=await account('unit');await unit.getByRole('heading',{name:'管理工作台',exact:true}).waitFor();
  await checkPublic(unit,'unit','SERVER-SAVED-THROUGH-FORM');await unit.goto(base+'admin');await unit.getByRole('heading',{name:'管理工作台',exact:true}).waitFor();
  assert.equal(await unit.locator('#role-label').textContent(),'單位管理員');assert.equal(await unit.locator('#unit-label').textContent(),'人工智慧中心');
  assert.equal(await unit.locator('[data-route=grants],[data-route=theme],[data-route=site],[data-route=pages],[data-route=services]').count(),0);
  await unit.locator('[data-route=news]').click();await unit.locator('#news-table tbody').waitFor();assert.doesNotMatch(await unit.locator('#news-table').innerText(),/SERVER-CORE/);
  await unit.locator('[data-route=units]').click();await unit.locator('.unit-card').waitFor();assert.equal(await unit.locator('.unit-card').count(),1);await unit.getByRole('button',{name:'編輯',exact:true}).click();
  assert.equal(await unit.locator('#editor [name=name]').count(),0);await unit.locator('#editor [name=short_description]').fill('SERVER UNIT UPDATE');await unit.locator('#editor [type=submit]').click();await unit.locator('#status').filter({hasText:'已儲存至伺服器'}).waitFor();
  await unit.locator('[data-route=media]').click();await unit.locator('.file-card').first().waitFor();assert.equal(await unit.locator('.file-card').count(),2);
  assert.equal((await unit.request.get(new URL(foreign.url,base).href)).status(),403);
  await unit.goto(base+'admin#theme');await unit.getByRole('heading',{name:'管理工作台',exact:true}).waitFor();assert.equal(await unit.locator('[data-route=theme]').count(),0);
  const {context:siteContext,page:site}=await account('site');await site.getByRole('heading',{name:'管理工作台',exact:true}).waitFor();assert.equal(await site.locator('#role-label').textContent(),'醫研部總管理員');
  await checkPublic(site,'site','SERVER-SAVED-THROUGH-FORM');await site.goto(base+'admin');await site.getByRole('heading',{name:'管理工作台',exact:true}).waitFor();
  assert.equal(await site.locator('[data-route=theme]').count(),0);assert.equal(await site.locator('[data-route=grants]').count(),1);
  await site.locator('[data-route=grants]').click();await site.getByRole('button',{name:'新增授權',exact:true}).click();assert.equal(await site.locator('#grant [name=role] option').count(),1);
  const {context:multiContext,page:multi}=await account('multi');const multiScope=await multi.locator('#unit-label').textContent();assert.ok(multiScope.includes('人工智慧中心')&&multiScope.includes('共同研究室'));
  const screenshots=await mkdtemp(join(tmpdir(),'medresearch-live-management-'));
  for(const width of [1440,768,320]){
    await unit.setViewportSize({width,height:1000});await unit.goto(base+'admin#news');await unit.locator('#news-table').waitFor();assert.ok(await unit.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'unit width '+width);
    await unit.screenshot({path:join(screenshots,`unit-${width}.png`),fullPage:true});
    await page.setViewportSize({width,height:1000});await page.goto(base+'admin');await page.getByRole('heading',{name:'管理工作台',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'system width '+width);
    await page.screenshot({path:join(screenshots,`system-${width}.png`),fullPage:true});
  }
  await unit.locator('#menu-toggle').focus();await unit.keyboard.press('Enter');assert.equal(await unit.locator('#menu-toggle').getAttribute('aria-expanded'),'true');await unit.keyboard.press('Escape');assert.equal(await unit.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
  assert.deepEqual(errors,[]);
  const {context:ordinaryContext,page:ordinary}=await account('ordinary');await checkPublic(ordinary,'ordinary','SERVER-SAVED-THROUGH-FORM');
  await Promise.all([rootContext.close(),unitContext.close(),siteContext.close(),multiContext.close(),visitorContext.close(),ordinaryContext.close()]);
  console.log('PASS public navigation: visitor, ordinary, three managers, untrusted cookie, latest date before featured, draft excluded, 320/768/1440px');
  console.log('PASS live management UI: real API data, three roles and multi-unit scope, CRUD, uploads/library, grants, theme, legacy import, subpath, mobile navigation, 320/768/1440px');
  console.log('Screenshots:',screenshots);
}finally{
  if(browser)await browser.close();
  try{await fetch(base+'__fixture_shutdown',{method:'POST'});}catch{}
  await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);
  if(child.exitCode===null)child.kill();
}
