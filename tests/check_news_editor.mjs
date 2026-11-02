import assert from 'node:assert/strict';
import {readFile,mkdtemp} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import vm from 'node:vm';

const source=await readFile('assets/js/news-editor.js','utf8');
const sandbox={window:{},Intl,Date};vm.runInNewContext(source,sandbox);
const {day,publicationDate,buildValue}=sandbox.window.MedNewsEditor;
assert.equal(day('2026-11-01T18:30:00Z'),'2026-11-02');
assert.equal(day('2026-11-02'),'2026-11-02');
assert.equal(publicationDate('2026-11-02','2026-11-02T09:31:45+08:00','published'),'2026-11-02T09:31:45+08:00');
assert.equal(publicationDate('2026-11-02','','draft','2026-11-02T03:10:00Z'),'');
assert.equal(publicationDate('2026-11-02','','published','2026-11-02T03:10:00Z'),'2026-11-02T03:10:00Z');
assert.equal(publicationDate('2026-10-15','','published','2026-11-02T03:10:00Z'),'2026-10-15T00:00:00+08:00');
const original={id:'news-fixture',title:'Original',content:['Old'],published_at:'2026-10-15T09:31:45+08:00',
  expires_at:'2026-12-01T23:00:00+08:00',event_date:'2026-11-15',gallery:[{src:'assets/original.png',alt:'Original picture'}],
  related_unit_ids:['ai-center'],owner_unit_id:'ai-center',source_url:'https://example.test/original'};
const fields={title:' New title ',summary:' Summary ',paragraphs:'One\n\nTwo',category:'課程活動',visibility:'public',
  published_at:'2026-10-15',expires_at:'2026-12-01',event_date:'2026-11-15',cover_alt:''};
const value=buildValue(original,fields,[],{src:''},'published');
assert.equal(value.published_at,original.published_at);assert.equal(value.expires_at,original.expires_at);
assert.equal(value.gallery[0].src,original.gallery[0].src);assert.equal(value.related_unit_ids[0],'ai-center');
assert.equal(value.source_url,original.source_url);assert.equal(value.cover_image,'');
assert.equal(value.title,'New title');assert.equal(value.content.length,2);
assert.equal(buildValue(original,{...fields,expires_at:''},[],{src:'media/preview.png'},'draft').cover_alt,'New title相關圖片');
assert.throws(()=>buildValue(original,{...fields,title:'  '},[],{src:''},'draft'));
assert.doesNotMatch(source,/localStorage|type=["']text["'][^>]*name=["'](?:published_at|expires_at)/);
console.log('PASS message form data: Taipei dates, precise timestamp preservation, optional cover, existing metadata, no browser storage');

if(!process.argv[2]||!process.argv[3])process.exit(0);
const {chromium}=await import(pathToFileURL(process.argv[2]).href);
const css=await readFile('assets/css/management.css','utf8');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1kAAAAASUVORK5CYII=','base64');
const requests=[];let failSave=false;
const server=createServer(async(req,res)=>{
  if(req.url==='/assets/js/news-editor.js'){res.setHeader('content-type','text/javascript');res.end(source);return;}
  if(req.url==='/style.css'){res.setHeader('content-type','text/css');res.end(css);return;}
  if(req.url.startsWith('/media/')){res.setHeader('content-type','image/png');res.end(png);return;}
  if(req.url.startsWith('/api/')){
    const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);
    requests.push({path:req.url,method:req.method,csrf:req.headers['x-csrf-token'],body});
    res.setHeader('content-type','application/json');
    if(req.url.includes('/files/')){res.end(JSON.stringify({url:`media/${requests.length}${req.headers['content-type']==='application/pdf'?'.pdf':'.png'}`,size:body.length}));return;}
    if(failSave){res.statusCode=500;res.end(JSON.stringify({detail:'Simulated server failure'}));return;}
    const data=JSON.parse(body);res.end(JSON.stringify({value:data.value,revision:'saved-revision'}));return;
  }
  res.setHeader('content-type','text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><main><p id="message" role="status"></p><section id="workspace"></section></main><script src="/assets/js/news-editor.js"></script></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({executablePath:process.argv[3],headless:true});
try{
  const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  async function mount(value,revision=null,role='system_admin'){
    await page.evaluate(({value,revision,role})=>{
      window.result=null;
      window.MedNewsEditor.mount({target:document.getElementById('workspace'),entry:{value,revision},
        session:{profile:{role},units:[{id:'ai-center',name:'人工智慧中心'}],csrf:'fixture-csrf'},base:location.origin+'/',
        api:async(path,method,data)=>{const r=await fetch('/api/'+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.detail);return result;},
        message:text=>document.getElementById('message').textContent=text,onSaved:result=>{window.result=result;},onBack:()=>{},onHistory:()=>{}});
    },{value,revision,role});
  }
  const blank={id:'news-fixture',title:'',summary:'',content:[],status:'draft',visibility:'public',attachments:[]};
  for(const width of [1440,320]){
    await page.setViewportSize({width,height:1000});await mount(blank);
    assert.equal(await page.locator('[name=published_at]').getAttribute('type'),'date');
    assert.equal(await page.locator('[name=expires_at]').getAttribute('type'),'date');
    assert.equal(await page.locator('select[name=category]').count(),1);
    assert.equal(await page.locator('[name=advanced],[name=cover_image],select[name=status]').count(),0);
    assert.equal(await page.locator('#cover-description').isVisible(),false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  }
  await page.locator('[name=title]').fill('Message fixture');await page.locator('[name=summary]').fill('Summary fixture');
  await page.locator('[name=paragraphs]').fill('First paragraph\n\nSecond paragraph');
  await page.locator('[name=category]').selectOption('課程活動');await page.locator('[name=expires_at]').fill('2026-12-01');
  await page.locator('[name=files]').setInputFiles([{name:'poster.png',mimeType:'image/png',buffer:png},{name:'form.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nFixture')}]);
  await page.waitForFunction(()=>document.querySelectorAll('.news-edit-file').length===2);
  await page.getByRole('button',{name:'用作列表預覽',exact:true}).first().click();
  assert.equal(await page.locator('#cover-description').isVisible(),true);
  await page.locator('[name=cover_alt]').fill('Activity poster');
  await page.getByRole('button',{name:'不使用預覽圖片',exact:true}).click();
  await page.getByRole('button',{name:'儲存草稿',exact:true}).click();
  await page.waitForFunction(()=>window.result!==null);
  let saved=await page.evaluate(()=>window.result);
  assert.equal(saved.value.status,'draft');assert.equal(saved.value.attachments.length,2);assert.equal(saved.value.cover_image,'');
  assert.equal(saved.value.expires_at,'2026-12-01');assert.equal(saved.value.content.length,2);
  assert.ok(requests.filter(r=>r.path.includes('/files/')).every(r=>r.csrf==='fixture-csrf'));
  await mount({...original,summary:'Existing summary',category:'舊分類',status:'published',visibility:'public',attachments:saved.value.attachments},'old-revision','unit_admin');
  assert.equal(await page.locator('[name=unit]').count(),0);assert.equal(await page.locator('[name=featured]').count(),0);
  await page.getByRole('button',{name:'發布更新',exact:true}).click();await page.waitForFunction(()=>window.result!==null);
  saved=await page.evaluate(()=>window.result);assert.equal(saved.value.published_at,original.published_at);assert.equal(saved.value.gallery.length,1);
  await mount({...blank,title:'Failure fixture',summary:'Summary',content:['Body']});failSave=true;
  await page.getByRole('button',{name:'發布',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('message').textContent==='Simulated server failure');
  assert.equal(await page.evaluate(()=>window.result),null);
  assert.equal(await page.locator('[name=title]').inputValue(),'Failure fixture');
  assert.equal(await page.getByRole('button',{name:'發布',exact:true}).isEnabled(),true);
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);
  assert.deepEqual(errors,[]);
  const screenshots=await mkdtemp(join(tmpdir(),'medresearch-news-form-'));
  for(const width of [320,1440]){await page.setViewportSize({width,height:1100});await page.screenshot({path:join(screenshots,`news-${width}.png`),fullPage:true});}
  console.log('PASS headless form: calendars, selections, uploads, optional preview, API save, role fields, no JSON, error retention, 320px/desktop layout');
  console.log('Screenshots:',screenshots);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
