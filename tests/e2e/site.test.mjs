// End-to-end tests in a real browser. Targets BASE_URL (e.g. the Docker
// container) when set; otherwise serves the repo locally.
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

async function open(path = '/', opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  // Third-party resources (web fonts) may be unreachable offline; only our own errors count.
  page.on('console', (m) => m.type() === 'error' && (m.location().url || base).startsWith(base) && errors.push(m.text()));
  await page.goto(base + path);
  await page.waitForSelector('#dial.ready');
  return page;
}

const attr = (page, sel, name) => page.$eval(sel, (e, n) => Number(e.getAttribute(n)), name);

test('renders the Riemann dial with twelve numerals and 60 ticks', async () => {
  const page = await open('/#riemann');
  assert.equal(await page.textContent('#title'), 'The Riemann Clock');
  assert.equal(await page.textContent('#formula'), 'ζ(½ + it)');
  const numerals = await page.$$eval('#dial .numeral', (n) => n.map((x) => x.textContent));
  assert.deepEqual(numerals, ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
  assert.equal(await page.locator('#dial .tick').count(), 60);
  assert.ok((await page.getAttribute('#dial .curve', 'd')).length > 1000);
  await page.context().close();
});

for (const [id, title] of [['riemann', 'The Riemann Clock'], ['lissajous', 'The Lissajous Clock'],
  ['cardioid', 'The Cardioid Clock'], ['lemniscate', 'The Lemniscate Clock']]) {
  test(`#${id} renders its dial and every variant`, async () => {
    const page = await open(`/#${id}`);
    assert.equal(await page.textContent('#title'), title);
    assert.equal(await page.getAttribute('.index-item.active', 'href'), `#${id}`);
    const buttons = await page.locator('#variants button').count();
    assert.ok(buttons >= 2);
    for (let i = 1; i <= buttons; i++) {
      await page.click(`#variants button:nth-child(${i})`);
      await page.waitForSelector(`#variants button:nth-child(${i}).active`);
      assert.equal(await page.locator('#dial .numeral').count(), 12);
      assert.ok((await page.getAttribute('#dial .curve', 'd')).length > 1000);
      for (const sel of ['.hand.hour', '.hand.minute', '.hand.second']) {
        assert.ok(Number.isFinite(await attr(page, `#dial ${sel}`, 'x2')), `${id} ${sel}`);
      }
    }
    await page.context().close();
  });
}

test('index lists all four clocks and nothing marked as coming soon', async () => {
  const page = await open('/');
  const names = await page.$$eval('.index-item .nm', (n) => n.map((x) => x.textContent));
  assert.deepEqual(names, ['Riemann', 'Lissajous', 'Cardioid', 'Lemniscate']);
  assert.equal(await page.locator('.index-item.soon').count(), 0);
  await page.click('a.index-item[href="#cardioid"]');
  await page.waitForFunction(() => document.querySelector('#title').textContent === 'The Cardioid Clock');
  await page.context().close();
});

test('the second hand runs from the pivot to the second marker', async () => {
  const page = await open('/#cardioid');
  const g = await page.evaluate(() => {
    const n = (s, a) => Number(document.querySelector(`#dial ${s}`).getAttribute(a));
    return {
      hx: n('.hand.second', 'x2'), hy: n('.hand.second', 'y2'),
      dx: n('.tip.second', 'cx'), dy: n('.tip.second', 'cy'),
      tx: n('.hand.second', 'x1'), ty: n('.hand.second', 'y1'),
      px: n('.pivot', 'cx'), py: n('.pivot', 'cy'),
    };
  });
  assert.equal(g.hx, g.dx); assert.equal(g.hy, g.dy);
  // the tail sits opposite the marker, behind the pivot
  const dot = (g.tx - g.px) * (g.dx - g.px) + (g.ty - g.py) * (g.dy - g.py);
  assert.ok(dot < 0, 'tail should point away from the marker');
  assert.ok(Math.abs(Math.hypot(g.tx - g.px, g.ty - g.py) - 46) < 0.1);
  await page.context().close();
});

test('hands are positioned and the second marker moves', async () => {
  const page = await open('/');
  const x0 = await attr(page, '#dial .tip.second', 'cx');
  const y0 = await attr(page, '#dial .tip.second', 'cy');
  assert.ok(Number.isFinite(x0) && Number.isFinite(y0));
  await page.waitForTimeout(700);
  const x1 = await attr(page, '#dial .tip.second', 'cx');
  const y1 = await attr(page, '#dial .tip.second', 'cy');
  assert.ok(Math.hypot(x1 - x0, y1 - y0) > 1, 'second marker did not move');
  // minute hand ends exactly where its tip sits on the curve
  const [handX, tipX] = await page.evaluate(() => [
    document.querySelector('#dial .hand.minute').getAttribute('x2'),
    document.querySelector('#dial .tip.minute').getAttribute('cx'),
  ]);
  assert.equal(handX, tipX);
  await page.context().close();
});

test('12:00 puts every hand on the zero at the origin', async () => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    const fixed = new Date(2026, 0, 1, 12, 0, 0, 0).getTime();
    const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...a) { super(...(a.length ? a : [fixed])); }
      static now() { return fixed; }
    };
  });
  const page = await ctx.newPage();
  await page.goto(base + '/');
  await page.waitForSelector('#dial.ready');
  const zx = await attr(page, '#dial .zero circle', 'cx');
  const zy = await attr(page, '#dial .zero circle', 'cy');
  assert.equal(await attr(page, '#dial .hand.second', 'x2'), await attr(page, '#dial .tip.second', 'cx'));
  for (const t of ['hour', 'minute', 'second']) {
    assert.ok(Math.abs((await attr(page, `#dial .tip.${t}`, 'cx')) - zx) < 0.5, `${t} x`);
    assert.ok(Math.abs((await attr(page, `#dial .tip.${t}`, 'cy')) - zy) < 0.5, `${t} y`);
  }
  assert.match(await page.textContent('#time'), /^12:0000$/);
  assert.match(await page.textContent('#ro-minute .v'), /^−?0\.000 [+−] 0\.000i$/);
  await ctx.close();
});

test('switching to γ₂ redraws the dial and is remembered', async () => {
  const page = await open('/');
  const before = await page.getAttribute('#dial .curve', 'd');
  await page.click('#variants button:nth-child(2)');
  await page.waitForSelector('#variants button:nth-child(2).active');
  assert.notEqual(await page.getAttribute('#dial .curve', 'd'), before);
  assert.match(await page.textContent('#domain'), /21\.0220/);
  await page.reload();
  await page.waitForSelector('#dial.ready');
  assert.match(await page.getAttribute('#variants button.active', 'title'), /21\.0220/);
  await page.context().close();
});

test('fits a phone screen without horizontal scroll', async () => {
  const page = await open('/', { viewport: { width: 390, height: 844 } });
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert.ok(sw <= cw, `scrollWidth ${sw} > ${cw}`);
  await page.context().close();
});

test('assets are served with the right content types', async () => {
  for (const [path, type] of [['/', /text\/html/], ['/styles.css', /text\/css/], ['/js/main.js', /javascript/]]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), type, path);
  }
});

test('no page or console errors', () => {
  assert.deepEqual(errors, []);
});
