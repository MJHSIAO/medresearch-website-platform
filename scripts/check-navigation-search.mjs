// Run with Node and an existing Playwright installation (no runtime site dependency).
// node scripts/check-navigation-search.mjs <absolute playwright/index.mjs> <browser executable>
import assert from 'node:assert/strict';
import { readFile, readdir, stat, mkdtemp } from 'node:fs/promises';
import { resolve, join, extname, dirname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';

const root = resolve('.');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.filter(e => !['.git', 'dist', 'node_modules'].includes(e.name)).map(e => e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name)))).flat();
}
const files = await walk(root);
for (const file of files) {
  const source = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '');
  if (file.endsWith('.json')) JSON.parse(source);
  if (/\.(m?js)$/.test(file)) execFileSync(process.execPath, ['--check', file]);
  if (file.endsWith('.css')) assert.equal((source.match(/{/g) || []).length, (source.match(/}/g) || []).length, file);
  if (file.endsWith('.html')) {
    for (const match of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const url = match[1];
      if (/^(?:[a-z]+:|#|\/\/)/i.test(url)) continue;
      const path = decodeURIComponent(url.split(/[?#]/)[0]);
      if (path) assert.ok(await stat(resolve(dirname(file), path)).catch(() => null), `${file}: ${url}`);
    }
  }
}
console.log('PASS JSON, JavaScript syntax, CSS braces, static HTML local resources');
if (!process.argv[2] || !process.argv[3]) throw new Error('Provide Playwright module and browser executable paths for browser tests.');
const { chromium } = await import(pathToFileURL(resolve(process.argv[2])).href);
const prefix = '/medresearch-website-platform/';
const server = createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Browsers request this origin-level icon independently of project-relative resources.
    if (pathname === '/favicon.ico') { res.writeHead(204).end(); return; }
    if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    pathname = pathname.slice(prefix.length) || 'index.html';
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(root, pathname);
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
const browser = await chromium.launch({ executablePath: process.argv[3], headless: true });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`${msg.text()} (${msg.location().url})`); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
  const units = JSON.parse((await readFile('data/units.json', 'utf8')).replace(/^\uFEFF/, '')).filter(u => u.status === 'active' && !u.site_href);
  const news = JSON.parse((await readFile('data/news.json', 'utf8')).replace(/^\uFEFF/, ''));
  for (const item of news) {
    for (const src of [item.cover_image, ...(item.gallery || []).map(image => image.src)].filter(Boolean)) {
      if (!/^https?:/.test(src)) assert.ok(await stat(resolve(root, src)).catch(() => null), src);
    }
  }
  const imageNews = news.find(n => n.status === 'published' && n.gallery?.length);
  assert.ok(imageNews, 'News gallery fixture exists');
  const pages = ['index.html', 'news.html', 'search.html?q=研究', `news-detail.html?id=${imageNews.id}`, 'content-page.html?page=department-about', 'ai-center/index.html', ...units.map(u => `unit.html?unit=${u.slug}`)];
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of pages) {
      await page.goto(base + path); await page.waitForLoadState('networkidle');
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
      assert.ok(sizes.scroll <= sizes.width + 1, `${width} ${path}: overflow ${sizes.scroll}`);
      if (!path.startsWith('ai-center')) {
        await page.evaluate(() => scrollTo(0, 900));
        const box = await page.locator('#site-header').boundingBox();
        assert.ok(Math.abs(box.y) < 1, `${path} header must stick`);
        assert.ok(box.height < 110, `${width} header too tall ${box.height}`);
      }
      if (path.startsWith('unit.html')) {
        const links = page.locator('.page-navigation a');
        assert.ok(await links.count() >= 6);
        for (let i = 0; i < await links.count(); i++) {
          const link = links.nth(i);
          await link.focus(); await page.keyboard.press('Enter');
          await page.waitForTimeout(50);
          const id = (await link.getAttribute('href')).slice(1);
          const section = await page.locator(`#${id}`).boundingBox();
          const header = await page.locator('#site-header').boundingBox();
          assert.ok(section.y >= header.height - 1, `${width} ${id} obscured`);
          assert.equal(await link.getAttribute('aria-current'), 'location', `${width} ${id} highlight`);
        }
      }
    }
    console.log(`PASS ${width}px: ${pages.length} pages, no overflow, sticky header, six unit anchors + active links`);
  }
  await page.goto(base + 'index.html'); await page.waitForSelector('#home-search');
  await page.locator('#home-search').fill('  人工智慧  ');
  await page.locator('#home-search').focus(); await page.keyboard.press('Enter');
  await page.waitForSelector('.search-results a');
  assert.equal(await page.locator('#site-query').inputValue(), '人工智慧');
  assert.match(await page.locator('.search-results').innerText(), /人工智慧中心/);
  for (const href of await page.locator('.search-results a').evaluateAll(links => links.map(a => a.href))) {
    assert.ok(href.startsWith(base), href);
    assert.equal((await context.request.get(href)).status(), 200, href);
  }
  const checks = await page.evaluate(async () => {
    const D = window.MedData, S = window.MedSearch;
    const [site, units, people, news] = await Promise.all([D.load('site'), D.getUnits(), D.load('people'), D.getNews()]);
    const hiddenStatuses = ['internal', 'draft', 'pending_review', 'archived'];
    const fixtures = hiddenStatuses.map((status, i) => ({ ...news[0], id: `hidden-${i}`, title: '禁止公開ZZZ', visibility: 'public', status }));
    const hiddenPeople = hiddenStatuses.map(status => ({ ...people[0], name: '禁止公開ZZZ', status }));
    fixtures.push({ ...news[0], title: '禁止公開ZZZ', status: 'published', visibility: 'internal' });
    const hiddenUnits = hiddenStatuses.map((status, i) => ({ ...units[0], id: `hidden-${i}`, name: '禁止公開ZZZ', status }));
    const index = S.buildIndex(site, [...units, ...hiddenUnits], [...people, ...hiddenPeople], [...news, ...fixtures]);
    const exact = S.search(index, units[0].name)[0]?.title === units[0].name;
    const hidden = S.search(index, '禁止公開ZZZ').length;
    const languages = ['AI', '人工智慧', '臨床試驗', '研究倫理', '細胞治療', '2026'].map(q => [q, S.search(index, q).length]);
    const ranks = S.search([{ title: '其他', summary: '', body: 'AI研究' }, { title: '其他', summary: 'AI研究' }, { title: 'AI研究中心' }, { title: 'AI研究' }], 'ＡＩ研究').map(e => e.score);
    D.saveUnit({ ...units[0], name: 'DemoSyncZZZ' });
    const overridden = S.search(S.buildIndex(site, await D.getUnits(), people, news), 'DemoSyncZZZ').length;
    D.resetDemo();
    return { exact, hidden, languages, ranks, overridden };
  });
  assert.equal(checks.hidden, 0); assert.ok(checks.exact); assert.ok(checks.overridden > 0);
  assert.deepEqual(checks.ranks, [100, 75, 50, 25]);
  assert.ok(checks.languages.filter(([q]) => q !== '研究倫理').every(([, count]) => count > 0), JSON.stringify(checks.languages));
  console.log('PASS search Enter, links under project prefix, languages, weighting, status exclusion, Demo overrides', checks);
  for (const [q, message] of [['   ', '請輸入搜尋關鍵字'], ['不存在ZZZ999', '找不到符合條件的內容']]) {
    await page.goto(base + 'search.html?q=' + encodeURIComponent(q));
    await page.waitForLoadState('networkidle');
    assert.match(await page.locator('main').innerText(), new RegExp(message));
  }
  await page.goto(base + `news-detail.html?id=${imageNews.id}`);
  await page.waitForSelector('[data-image-src]');
  const trigger = page.locator('[data-image-src]').first();
  for (const key of ['Enter', 'Space']) {
    await trigger.focus(); await page.keyboard.press(key);
    await page.waitForSelector('dialog[open]');
    assert.equal(await page.locator('[data-lightbox-original]').getAttribute('target'), '_blank');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);
    assert.ok(await trigger.evaluate(el => document.activeElement === el));
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(base + 'index.html'); await page.waitForLoadState('networkidle');
  await page.locator('.menu-toggle').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.activeElement.closest('.main-nav') !== null));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
  await page.goto(base + 'ai-center/about.html'); await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.site-footer a[href="../search.html"]').getAttribute('target'), '_blank');
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const role of ['unit-editor', 'unit-admin', 'department-admin', 'system-admin']) {
    await page.evaluate(role => localStorage.setItem('medresearch_demo_role', role), role);
    await page.goto(base + 'admin-demo/index.html'); await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.admin-nav a[href="index.html#system-demo"]').count(), role === 'system-admin' ? 1 : 0);
    assert.equal(await page.locator('#department-demo').isVisible(), role === 'department-admin');
    assert.equal(await page.locator('.admin-nav a[href="unit-profile.html"]').count(), role === 'system-admin' ? 0 : 1);
  }
  await page.evaluate(() => window.MedData.resetDemo());
  const screenshotDir = await mkdtemp(join(tmpdir(), 'medresearch-ux-'));
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + 'unit.html?unit=academic-office#unit-services'); await page.waitForLoadState('networkidle');
    await page.screenshot({ path: join(screenshotDir, `unit-${width}.png`) });
    await page.goto(base + 'search.html?q=人工智慧'); await page.waitForLoadState('networkidle');
    await page.screenshot({ path: join(screenshotDir, `search-${width}.png`) });
  }
  console.log('PASS news image paths and four role entry-point checks; screenshots:', screenshotDir);
  assert.deepEqual(errors, []);
  console.log('PASS blank/no results, lightbox Enter/Space/Escape/focus return, mobile menu Tab/Escape, AI nested search link, browser errors = 0');
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
