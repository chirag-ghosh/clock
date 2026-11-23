// Screensaver mode: ?screensaver strips the page down to the dial.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../support/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
let browser, server, base;
const errors = [];

before(async () => {
  if (process.env.BASE_URL) base = process.env.BASE_URL.replace(/\/$/, '');
  else { server = await serve(0); base = `http://127.0.0.1:${server.address().port}`; }
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

async function open(path, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + path);
  await page.waitForSelector('#dial.ready');
  return page;
}

const visible = (page, sel) => page.$eval(sel, (e) => getComputedStyle(e).display !== 'none');

test('?screensaver shows only the dial and a small caption, with no scrolling', async () => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await open('/?screensaver#lissajous', viewport);
    for (const sel of ['header.top', '.plate', 'footer']) assert.equal(await visible(page, sel), false, sel);
    assert.equal(await visible(page, '#ss-caption'), true);
    assert.match(await page.textContent('#ss-caption'), /^Lissajous\s*\d\d:\d\d:\d\d$/);
    const m = await page.evaluate(() => {
      const r = document.querySelector('#dial').getBoundingClientRect();
      const d = document.documentElement;
      return { sh: d.scrollHeight, sw: d.scrollWidth, ih: innerHeight, iw: innerWidth, w: r.width, h: r.height };
    });
    assert.ok(m.sh <= m.ih && m.sw <= m.iw, `page scrolls: ${JSON.stringify(m)}`);
    assert.ok(m.w > m.iw * 0.8 && m.h > m.ih * 0.7, `dial should fill the screen: ${JSON.stringify(m)}`);
    await page.context().close();
  }
});

test('screensaver=1/true/on enable it; 0/false/off and no param do not', async () => {
  for (const [q, on] of [['?screensaver=1', true], ['?screensaver=true', true], ['?screensaver=on', true],
    ['?screensaver=0', false], ['?screensaver=false', false], ['?screensaver=off', false], ['', false]]) {
    const page = await open('/' + q);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('screensaver')), on, q);
    assert.equal(await visible(page, 'header.top'), !on, q);
    await page.context().close();
  }
});

test('variant param picks the variant without overwriting the saved choice', async () => {
  const page = await open('/#lemniscate');
  await page.click('#variants button:nth-child(1)'); // saves "bernoulli"
  await page.goto(base + '/?screensaver&variant=gerono#lemniscate');
  await page.waitForSelector('#dial.ready');
  assert.equal(await page.textContent('#formula'), 'y⁴ = y² − x²');
  assert.equal(await page.evaluate(() => localStorage.getItem('variant:lemniscate')), 'bernoulli');
  await page.context().close();
});

test('footer link opens the current clock as a screensaver', async () => {
  const page = await open('/#cardioid');
  await page.click('#variants button:nth-child(2)');
  assert.equal(await page.getAttribute('#ss-link', 'href'), '?screensaver&variant=inner#cardioid');
  await page.click('#ss-link');
  await page.waitForSelector('html.screensaver #dial.ready');
  assert.match(await page.textContent('#ss-caption'), /^Cardioid/);
  await page.context().close();
});

test('cursor hides when idle, hint shows on movement, Esc returns to the full page', async () => {
  const page = await open('/?screensaver#riemann');
  assert.equal(await page.$eval('body', (b) => getComputedStyle(b).cursor), 'none');
  await page.mouse.move(200, 200);
  await page.mouse.move(220, 210);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ss-awake')), true);
  await page.keyboard.press('Escape');
  await page.waitForURL((u) => !u.search.includes('screensaver'));
  await page.waitForSelector('#dial.ready');
  assert.ok(page.url().endsWith('/#riemann'), page.url());
  assert.equal(await visible(page, 'header.top'), true);
  await page.context().close();
});

test('no page errors in screensaver mode', () => assert.deepEqual(errors, []));
