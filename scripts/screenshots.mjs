// Renders the images used in README.md into docs/images/.
//
//   npm run screenshots
//
// Needs Playwright with Chromium (the same setup as the end-to-end tests). Every
// shot is taken at a frozen 10:09:30, the time watchmakers photograph at, so the
// images only change when the site does.
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve } from '../tests/support/serve.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = fileURLToPath(new URL('../docs/images/', import.meta.url));
const JPEG = { type: 'jpeg', quality: 86 };

// the variants the cycling screensaver plays, so the README matches it
const PLAYLIST = [['riemann', 'g1'], ['lissajous', '3-2'], ['cardioid', 'inner'], ['lemniscate', 'gerono']];

const freezeTime = () => {
  const fixed = new Date(2026, 0, 1, 10, 9, 30, 0).getTime();
  const RealDate = Date;
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [fixed])); }
    static now() { return fixed; }
  };
};

await mkdir(OUT, { recursive: true });
const server = await serve(0);
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

async function page({ width = 1440, height = 900, scheme = 'dark', details = 'closed', scale = 2, frozen = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: scheme });
  if (frozen) await ctx.addInitScript(freezeTime);
  await ctx.addInitScript((d) => { try { localStorage.setItem('details', d); } catch {} }, details);
  return ctx.newPage();
}

async function load(p, path) {
  await p.goto(base + path);
  await p.waitForSelector('#dial.ready');
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1500); // let the dial finish fading in
}

const saved = [];
async function shot(p, name, opts = {}) {
  await p.screenshot({ path: OUT + name, ...JPEG, ...opts });
  saved.push(name);
}

// ——— the full page, as a visitor first sees it ———
{
  const p = await page();
  await load(p, '/#riemann');
  await shot(p, 'home.jpg');

  // "Know more" open: the bar and the details below it
  await p.click('#more');
  await p.waitForTimeout(1200);
  const bar = await p.$eval('.bar', (e) => e.getBoundingClientRect().top + scrollY);
  await p.evaluate((y) => scrollTo(0, y - 24), bar);
  await p.waitForTimeout(400);
  await shot(p, 'details.jpg', { clip: { x: 0, y: bar - 24 - (await p.evaluate(() => scrollY)), width: 1440, height: 520 } });
  await p.context().close();
}

// ——— each clock's dial, cropped square-ish, for the gallery ———
for (const [id, variant] of PLAYLIST) {
  const p = await page({ width: 1200, height: 900 });
  await load(p, `/?screensaver&variant=${variant}#${id}`);
  await p.addStyleTag({ content: '.ss-caption, .ss-hint { display: none !important; } #dial { animation: none !important; }' });
  await shot(p, `clock-${id}.jpg`);
  await p.context().close();
}

// ——— screensaver, light theme ———
{
  const p = await page({ scheme: 'light' });
  await load(p, '/?screensaver&variant=bernoulli#lemniscate');
  await p.addStyleTag({ content: '#dial { animation: none !important; }' });
  await shot(p, 'screensaver-light.jpg');
  await p.context().close();
}

// ——— phone ———
{
  const p = await page({ width: 390, height: 844, scale: 3 });
  await load(p, '/#cardioid');
  await shot(p, 'phone.jpg');
  await p.context().close();
}

// ——— the cycling screensaver mid-morph: four frames side by side ———
{
  const p = await page({ width: 1000, height: 720, scale: 1.5 });
  await load(p, '/?cycle=8#riemann');
  await p.addStyleTag({ content: '#dial { animation: none !important; } .ss-hint, .ss-caption { display: none !important; }' });
  const frames = [];
  const grab = async () => frames.push((await p.screenshot({ type: 'png' })).toString('base64'));
  await grab();                                                         // Riemann
  await p.waitForFunction(() => document.querySelector('#dial').classList.contains('morphing'), null, { timeout: 15000 });
  await p.waitForTimeout(1300); await grab();                           // bending
  await p.waitForTimeout(900); await grab();                            // half way
  await p.waitForFunction(() => !document.querySelector('#dial').classList.contains('morphing'), null, { timeout: 8000 });
  await p.waitForTimeout(900); await grab();                            // Lissajous
  await p.setContent(`<!doctype html><style>
      body { margin: 0; background: #0e0d0b; display: flex; gap: 6px; padding: 6px; }
      img { width: 600px; display: block; border-radius: 4px; }
    </style>${frames.map((f) => `<img src="data:image/png;base64,${f}">`).join('')}`);
  await p.setViewportSize({ width: 4 * 600 + 5 * 6, height: 432 + 12 });
  await p.waitForTimeout(200);
  await shot(p, 'cycle-morph.jpg');
  await p.context().close();
}

// ——— banner: the four curves as small dials beside the wordmark, dark and light ———
for (const scheme of ['dark', 'light']) {
  const p = await page({ width: 1600, height: 440, scheme, frozen: false });
  await p.goto(base + '/'); // same origin, so the banner can import the site's own modules
  const ink = scheme === 'dark'
    ? { bg: '#0e0d0b', bg2: '#17150f', ink: '#ece6d6', muted: '#8d8676', faint: '#3a372f', accent: '#c9a45c' }
    : { bg: '#f3efe5', bg2: '#ebe5d7', ink: '#1b1915', muted: '#75705f', faint: '#c9c1ad', accent: '#9a7228' };
  await p.setContent(`<!doctype html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@300;400&family=JetBrains+Mono:wght@300&display=swap" rel="stylesheet">
    <style>
      html, body { margin: 0; width: 1600px; height: 440px; overflow: hidden; }
      body { background: radial-gradient(ellipse 70% 90% at 70% 50%, ${ink.bg2}, ${ink.bg} 75%); color: ${ink.ink};
             display: grid; grid-template-columns: 560px 1fr; align-items: center; padding: 0 80px; box-sizing: border-box; }
      h1 { font: 400 132px/0.9 'Instrument Serif', serif; letter-spacing: -0.03em; margin: 0; }
      .tag { font: italic 400 34px 'Instrument Serif', serif; color: ${ink.muted}; margin: 18px 0 0; }
      .dials { display: flex; justify-content: space-between; align-items: center; }
      figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 14px; }
      figcaption { font: 400 12px 'Inter Tight', sans-serif; letter-spacing: .2em; text-transform: uppercase; color: ${ink.muted}; }
      figcaption { display: flex; flex-direction: column; align-items: center; gap: 8px; }
      figcaption b { font: 400 18px 'Instrument Serif', serif; letter-spacing: 0; color: ${ink.accent}; margin-right: 6px; }
      figcaption i { font: 300 12px 'JetBrains Mono', monospace; font-style: normal; letter-spacing: 0; text-transform: none; color: ${ink.accent}; opacity: .8; }
    </style></head><body>
    <div><h1>Curvature</h1><p class="tag">Clocks drawn on graphs</p></div>
    <div class="dials" id="dials"></div>
    <script type="module">
      import { clocks } from '/js/clocks/index.js';
      import { Dial } from '/js/dial.js';
      const playlist = ${JSON.stringify(PLAYLIST)};
      const C = ${JSON.stringify(ink)};
      const BOX = 200, f = (n) => n.toFixed(1);
      const EQ = { riemann: 'ζ(½ + it)', lissajous: '(sin 3t+δ, sin 2t)', cardioid: 'r = ½ − sin θ', lemniscate: 'y⁴ = y² − x²' };
      let html = '';
      for (const [id, key] of playlist) {
        const c = clocks.find((x) => x.id === id), v = c.variants.find((x) => x.key === key);
        const d = new Dial(null, c.sample(v), { pivot: c.pivot });
        const snap = d.snapshot(900), { w, h } = d.size, k = BOX / Math.max(w, h);
        const ox = (BOX - w * k) / 2, oy = (BOX - h * k) / 2;
        const X = (p) => f(ox + p.X * k), Y = (p) => f(oy + p.Y * k);
        const path = snap.pts.map((p, i) => (i ? 'L' : 'M') + X(p) + ' ' + Y(p)).join('');
        const at = (u) => snap.pts[Math.round((((u % 1) + 1) % 1) * 900)];
        const P = { X: d.pivot.X, Y: d.pivot.Y };
        // 10:09:30 — hour, minute and second fractions of the dial
        const hU = (10 + 9.5 / 60) / 12, mU = 9.5 / 60, sU = 0.5;
        const hp = at(hU), mp = at(mU), sp = at(sU);
        const short = { X: P.X + (hp.X - P.X) * 0.62, Y: P.Y + (hp.Y - P.Y) * 0.62 };
        let ticks = '';
        for (let i = 0; i < 12; i++) { const q = at(i / 12); ticks += '<circle cx="' + X(q) + '" cy="' + Y(q) + '" r="' + (i ? 2.2 : 3.4) + '" fill="' + (i ? C.ink : C.accent) + '"/>'; }
        html += '<figure><svg width="' + BOX + '" height="' + BOX + '" viewBox="0 0 ' + BOX + ' ' + BOX + '">'
          + '<path d="' + path + '" fill="none" stroke="' + C.accent + '" stroke-width="1.3" opacity=".85"/>' + ticks
          + '<line x1="' + X(P) + '" y1="' + Y(P) + '" x2="' + X(short) + '" y2="' + Y(short) + '" stroke="' + C.ink + '" stroke-width="4" stroke-linecap="round"/>'
          + '<line x1="' + X(P) + '" y1="' + Y(P) + '" x2="' + X(mp) + '" y2="' + Y(mp) + '" stroke="' + C.ink + '" stroke-width="1.6" stroke-linecap="round"/>'
          + '<line x1="' + X(P) + '" y1="' + Y(P) + '" x2="' + X(sp) + '" y2="' + Y(sp) + '" stroke="' + C.accent + '" stroke-width="1"/>'
          + '<circle cx="' + X(sp) + '" cy="' + Y(sp) + '" r="3.5" fill="' + C.accent + '"/>'
          + '<circle cx="' + X(P) + '" cy="' + Y(P) + '" r="4.5" fill="' + C.bg + '" stroke="' + C.ink + '" stroke-width="1.4"/>'
          + '</svg><figcaption><span><b>' + c.numeral + '</b>' + c.name + '</span><i>' + EQ[id] + '</i></figcaption></figure>';
      }
      document.getElementById('dials').innerHTML = html;
      await document.fonts.ready;
      window.__ready = true;
    </script></body></html>`);
  await p.waitForFunction(() => window.__ready === true, null, { timeout: 15000 });
  await p.waitForTimeout(300);
  await shot(p, `banner-${scheme}.jpg`);
  await p.context().close();
}

await browser.close();
server.close();
console.log(`wrote ${saved.length} images to docs/images/:\n  ${saved.join('\n  ')}`);
