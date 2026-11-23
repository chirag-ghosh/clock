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

// Most tests use the formula, variants and readouts, so they start with "Know more"
// already open; pass { collapsed: true } to see the page as a first-time visitor does.
async function open(path = '/', { collapsed = false, ...opts } = {}) {
  const ctx = await browser.newContext(opts);
  if (!collapsed) await ctx.addInitScript(() => { try { localStorage.setItem('details', 'open'); } catch {} });
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
  await ctx.addInitScript(() => { try { localStorage.setItem('details', 'open'); } catch {} }); // readouts live in "Know more"
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
  assert.match(await page.textContent('#time'), /^12:00:00$/);
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
  for (const [path, type] of [['/', /text\/html/], ['/styles.css', /text\/css/], ['/js/main.js', /javascript/], ['/js/clocks/index.js', /javascript/]]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), type, path);
    // must revalidate, or browsers keep running old code after a deploy
    assert.match(res.headers.get('cache-control') || '', /no-cache/, `${path} cache-control`);
  }
});

test('the digital time is HH:MM:SS and fits its column at every width', async () => {
  for (const width of [1920, 1440, 1100, 961, 800, 390, 320]) {
    const page = await open('/', { viewport: { width, height: 900 } });
    const m = await page.evaluate(() => {
      const t = document.querySelector('#time');
      const r = document.createRange();
      r.selectNodeContents(t);
      return { text: t.textContent, text_w: r.getBoundingClientRect().width, col_w: t.parentElement.getBoundingClientRect().width };
    });
    assert.match(m.text, /^\d\d:\d\d:\d\d$/, `${width}px`);
    assert.ok(m.text_w <= m.col_w, `${width}px: time ${m.text_w} wider than column ${m.col_w}`);
    await page.context().close();
  }
});

test('performance: hands redraw at most 30 times a second and text only once a second', async () => {
  const page = await open('/');
  const r = await page.evaluate(() => new Promise((done) => {
    let hands = 0, time = 0;
    const dot = document.querySelector('#dial .tip.second');
    new MutationObserver(() => hands++).observe(dot, { attributes: true, attributeFilter: ['cx'] });
    new MutationObserver(() => time++).observe(document.querySelector('#time'), { childList: true });
    setTimeout(() => done({ hands, time }), 3000);
  }));
  assert.ok(r.hands > 30, `hands should animate (${r.hands} updates in 3s)`);
  assert.ok(r.hands <= 95, `hands updated ${r.hands} times in 3s (cap is 30/s)`);
  assert.ok(r.time <= 4, `time text rewritten ${r.time} times in 3s`);
  await page.context().close();
});

test('performance: static artwork and animated hands live in separate layers, no filters', async () => {
  const page = await open('/');
  const r = await page.evaluate(() => ({
    staticHands: document.querySelectorAll('#dial .dial-static .hand, #dial .dial-static .tip').length,
    staticCurve: document.querySelectorAll('#dial .dial-static .curve').length,
    liveHands: document.querySelectorAll('#dial .dial-live .hand').length,
    liveText: document.querySelectorAll('#dial .dial-live text').length,
    filters: document.querySelectorAll('#dial filter, #dial [filter]').length,
    willChange: getComputedStyle(document.querySelector('#dial .dial-live')).willChange,
    sameViewBox: document.querySelector('.dial-static').getAttribute('viewBox') === document.querySelector('.dial-live').getAttribute('viewBox'),
  }));
  assert.deepEqual(r, { staticHands: 0, staticCurve: 1, liveHands: 3, liveText: 0, filters: 0, willChange: 'transform', sameViewBox: true });
  await page.context().close();
});

test('under the dial: name on the left, time on the right, the buttons between, no overlap', async () => {
  for (const width of [1674, 1440, 1024, 700]) {
    const page = await open('/#lemniscate', { collapsed: true, viewport: { width, height: 1000 } });
    const r = await page.evaluate(() => {
      const text = (s) => { const g = document.createRange(); g.selectNodeContents(document.querySelector(s)); return g.getBoundingClientRect(); };
      const n = text('#title'), t = text('#time'), m = document.querySelector('.bar-actions').getBoundingClientRect();
      return { n: [n.left, n.right, n.bottom], m: [m.left, m.right, m.bottom], t: [t.left, t.right, t.bottom], vw: innerWidth, vh: innerHeight };
    });
    if (width > 960) {
      assert.ok(r.n[1] < r.m[0] && r.m[1] < r.t[0] && r.t[1] <= r.vw, `${width}px: ${JSON.stringify(r)}`);
    } else {
      // narrower: name and time share a line, the buttons sit on the line below
      assert.ok(r.n[1] < r.t[0] && r.t[1] <= r.vw && r.m[2] > Math.max(r.n[2], r.t[2]), `${width}px: ${JSON.stringify(r)}`);
    }
    // the whole bar is on the first screen, below the dial
    assert.ok(Math.max(r.n[2], r.m[2], r.t[2]) <= r.vh, `${width}px: bar below the fold ${JSON.stringify(r)}`);
    await page.context().close();
  }
});

test('details are folded away until "Know more" is clicked, and the choice is remembered', async () => {
  const page = await open('/', { collapsed: true });
  const shown = () => page.$eval('.details-inner', (e) => getComputedStyle(e).visibility === 'visible' && e.getBoundingClientRect().height > 50);
  assert.equal(await page.getAttribute('#more', 'aria-expanded'), 'false');
  assert.equal(await shown(), false);
  assert.equal(await page.isVisible('#variants button'), false);

  await page.click('#more');
  await page.waitForFunction(() => document.querySelector('.details-inner').getBoundingClientRect().height > 50);
  assert.equal(await page.getAttribute('#more', 'aria-expanded'), 'true');
  assert.match(await page.textContent('#more'), /Less/);
  await page.waitForTimeout(700);
  assert.equal(await shown(), true);
  assert.match(await page.textContent('#ro-second .v'), /i$/); // live readouts fill in once open

  await page.reload();
  await page.waitForSelector('#dial.ready');
  assert.equal(await page.getAttribute('#more', 'aria-expanded'), 'true');
  await page.click('#more');
  await page.waitForTimeout(700);
  assert.equal(await shown(), false);
  await page.context().close();
});

test('on a phone the name, time and button stack without sideways scrolling', async () => {
  const page = await open('/#lemniscate', { collapsed: true, viewport: { width: 375, height: 812 } });
  const r = await page.evaluate(() => {
    const y = (s) => document.querySelector(s).getBoundingClientRect().top;
    return { title: y('#title'), time: y('#time'), more: y('#more'), sw: document.documentElement.scrollWidth, vw: innerWidth };
  });
  assert.ok(r.title < r.time && r.time < r.more, JSON.stringify(r));
  assert.ok(r.sw <= r.vw, JSON.stringify(r));
  await page.context().close();
});

test('the digital time keeps the same width whatever the digits (no jitter)', async () => {
  const page = await open('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--digit-w') !== '');
  const widths = await page.evaluate(() => {
    const t = document.querySelector('#time');
    const cell = (s) => [...s].map((c) => `<span class="d">${c}</span>`).join('');
    return ['11:11:11', '08:48:08', '20:37:59', '00:00:00'].map((v) => {
      t.innerHTML = v.split(':').map(cell).join('<span class="colon">:</span>');
      const r = document.createRange(); r.selectNodeContents(t);
      return r.getBoundingClientRect().width.toFixed(2);
    });
  });
  assert.equal(new Set(widths).size, 1, `widths differ: ${widths}`);
  // and the live clock renders its digits in those slots
  await page.waitForTimeout(1100);
  assert.equal(await page.locator('#time .d').count(), 6);
  await page.context().close();
});

test('desktop: everything fits one window until "Know more" is opened, then the page scrolls', async () => {
  for (const [width, height] of [[1920, 1080], [1674, 1000], [1440, 900], [1280, 720], [1024, 768], [768, 1024]]) {
    const page = await open('/#lemniscate', { collapsed: true, viewport: { width, height } });
    const m = () => page.evaluate(() => {
      const b = document.querySelector('.bar').getBoundingClientRect();
      return { sh: document.documentElement.scrollHeight, vh: innerHeight, barLeft: b.left, barBottom: b.bottom };
    });
    const closed = await m();
    assert.ok(closed.sh <= closed.vh, `${width}x${height} scrolls while collapsed: ${JSON.stringify(closed)}`);
    assert.ok(closed.barBottom <= closed.vh, `${width}x${height}: bar off screen`);

    await page.click('#more');
    await page.waitForFunction(() => document.querySelector('.details-inner').getBoundingClientRect().height > 50);
    await page.waitForTimeout(700);
    const open_ = await m();
    assert.ok(open_.sh > open_.vh, `${width}x${height} should scroll once open`);
    // opening must not shift anything sideways (e.g. a scrollbar taking width)
    assert.equal(open_.barLeft, closed.barLeft, `${width}x${height}: layout moved sideways`);
    await page.context().close();
  }
});

test('the page always reserves room for a scrollbar (none in the screensaver)', async () => {
  const page = await open('/', { collapsed: true });
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter), 'stable both-edges');
  await page.goto(base + '/?screensaver');
  await page.waitForSelector('#dial.ready');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarGutter), 'auto');
  await page.context().close();
});

test('no page or console errors', () => {
  assert.deepEqual(errors, []);
});

// Only the Docker image stamps assets; the local dev server serves files as-is.
test('deployed assets carry a content-hash version so caches cannot serve stale CSS/JS',
  { skip: !process.env.BASE_URL && 'needs BASE_URL (the Docker image)' }, async () => {
    const html = await (await fetch(base + '/')).text();
    const v = html.match(/styles\.css\?v=([0-9a-f]{10})"/)?.[1];
    assert.ok(v, 'stylesheet is not versioned');
    assert.ok(html.includes(`js/main.js?v=${v}"`), 'entry script is not versioned');
    for (const path of ['/js/main.js', '/js/dial.js', '/js/clocks/index.js', '/js/clocks/riemann.js']) {
      const src = await (await fetch(base + path)).text();
      const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      assert.ok(imports.length > 0, path);
      for (const i of imports) assert.ok(i.endsWith(`.js?v=${v}`), `${path} imports ${i}`);
    }
  });
