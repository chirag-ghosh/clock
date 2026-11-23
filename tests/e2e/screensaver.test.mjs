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
  // tests that click variant buttons on the normal page need "Know more" open
  await ctx.addInitScript(() => { try { localStorage.setItem('details', 'open'); } catch {} });
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
    for (const sel of ['header.top', '.plate']) assert.equal(await visible(page, sel), false, sel);
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

test('the Screensaver button under the dial opens the current clock as a screensaver', async () => {
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

test('a wide dial letterboxes inside a portrait screen instead of overflowing it', async () => {
  for (const id of ['riemann', 'lissajous', 'cardioid', 'lemniscate']) {
    const page = await open(`/?screensaver#${id}`, { width: 390, height: 844 });
    const r = await page.evaluate(() => {
      const b = document.querySelector('#dial').getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, w: innerWidth, h: innerHeight };
    });
    assert.ok(r.left >= -10 && r.right <= r.w + 10 && r.top >= -10 && r.bottom <= r.h + 10, `${id}: ${JSON.stringify(r)}`);
    await page.context().close();
  }
});

const state = (page) => page.evaluate(() => ({
  name: document.title.split(' ·')[0],
  domain: document.querySelector('#domain').textContent,
  morphing: document.querySelector('#dial').classList.contains('morphing'),
  numerals: document.querySelectorAll('#dial .numeral').length,
}));

test('?cycle turns on the screensaver and starts on the playlist variant', async () => {
  for (const [hash, name, domain] of [['', 'Riemann', /14\.1347/], ['#cardioid', 'Cardioid', /½ − sin θ/],
    ['#lemniscate', 'Lemniscate', /^x = sin t cos t, y = cos t$/]]) {
    const page = await open(`/?cycle${hash}`);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('screensaver')), true);
    const s = await state(page);
    assert.equal(s.name, name); assert.match(s.domain, domain);
    await page.context().close();
  }
});

test('?cycle morphs to the next playlist entry and redraws its numerals', async () => {
  const page = await open('/?cycle=8#lemniscate');      // last entry, so the next one wraps to Riemann γ₁
  await page.waitForFunction(() => document.querySelector('#dial').classList.contains('morphing'), null, { timeout: 12000 });
  // mid-transition: the curve is bending and the hands are still on it
  await page.waitForTimeout(1800);
  const mid = await page.evaluate(() => ({
    d: document.querySelector('#dial .curve').getAttribute('d').length,
    cx: Number(document.querySelector('#dial .tip.second').getAttribute('cx')),
  }));
  assert.ok(mid.d > 1000 && Number.isFinite(mid.cx));
  await page.waitForFunction(() => document.title.startsWith('Riemann'), null, { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector('#dial').classList.contains('morphing'), null, { timeout: 3000 });
  const s = await state(page);
  assert.match(s.domain, /14\.1347/);
  assert.equal(s.numerals, 12);
  await page.context().close();
});

test('the Screensaver button sits beside "Know more" on the first screen, and there is no footer', async () => {
  const page = await open('/');
  assert.equal(await page.locator('footer').count(), 0);
  const r = await page.evaluate(() => {
    const a = document.querySelector('#ss-link').getBoundingClientRect(), m = document.querySelector('#more').getBoundingClientRect();
    return { sameRow: Math.abs(a.top - m.top) < 2, onScreen: a.bottom <= innerHeight };
  });
  assert.deepEqual(r, { sameRow: true, onScreen: true });
  await page.context().close();
});

test('no page errors in screensaver mode', () => assert.deepEqual(errors, []));
