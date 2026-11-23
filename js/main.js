import { clocks, forthcoming } from './clocks/index.js';
import { Dial } from './dial.js';
import { handFractions } from './curve.js';

const $ = (s) => document.querySelector(s);
const root = $('#dial');
const svg = root.querySelector('svg.dial-static');
const params = new URLSearchParams(location.search);
const screensaver = document.documentElement.classList.contains('screensaver');
let dial, clock, variant, raf;
let lastFrame = 0, lastSecond = -1, lastReadout = 0;
// 30 fps is plenty for hands moving a few pixels a second, and halves (or, on
// 120 Hz displays, quarters) the drawing work compared with every animation frame.
const FRAME_MS = 1000 / 30 - 2;

function renderIndex() {
  const nav = $('#index');
  nav.innerHTML = '';
  for (const c of clocks) {
    const a = document.createElement('a');
    a.href = `#${c.id}`;
    a.className = 'index-item' + (c === clock ? ' active' : '');
    a.innerHTML = `<span class="num">${c.numeral}</span><span class="nm">${c.name}</span>`;
    nav.appendChild(a);
  }
  for (const c of forthcoming) {
    const s = document.createElement('span');
    s.className = 'index-item soon';
    s.innerHTML = `<span class="num">${c.numeral}</span><span class="nm">${c.name}</span><span class="tag">soon</span>`;
    nav.appendChild(s);
  }
}

function renderVariants() {
  const wrap = $('#variants');
  wrap.innerHTML = '';
  clock.variants.forEach((v) => {
    const b = document.createElement('button');
    b.textContent = v.label;
    b.title = v.detail;
    b.className = v === variant ? 'active' : '';
    b.onclick = () => { select(clock, v); };
    wrap.appendChild(b);
  });
}

function select(c, v) {
  clock = c;
  variant = v || c.variants[0];
  if (!screensaver) try { localStorage.setItem(`variant:${c.id}`, variant.key); } catch {}
  $('#ss-link').href = `?screensaver&variant=${variant.key}#${c.id}`;
  $('#numeral').textContent = `No. ${c.numeral}`;
  $('#title').textContent = c.title;
  $('#formula').textContent = variant.formula || c.formula;
  $('#domain').textContent = variant.detail;
  $('#desc').innerHTML = c.describe(variant);
  svg.setAttribute('aria-label', `${c.title}: a clock face drawn on the curve ${c.formula}`);
  document.title = `${c.name} · Curvature`;
  root.classList.remove('ready');
  dial = new Dial(root, c.sample(variant), { marker: c.marker?.(variant), pivot: c.pivot, axes: c.axes });
  lastSecond = -1;
  requestAnimationFrame(() => root.classList.add('ready'));
  renderIndex();
  renderVariants();
}

const pad = (n) => String(n).padStart(2, '0');

function tick(ts = performance.now()) {
  raf = requestAnimationFrame(tick);
  if (ts - lastFrame < FRAME_MS) return;
  lastFrame = ts;

  const now = new Date();
  const u = handFractions(now);
  const { hp, mp, sp } = dial.update(u.hour, u.minute, u.second);

  // text only changes once a second; rewriting it every frame forces a layout each time
  const second = now.getSeconds();
  if (second !== lastSecond) {
    lastSecond = second;
    const [hh, mm, ss] = [now.getHours(), now.getMinutes(), second].map(pad);
    if (screensaver) {
      $('#ss-caption').innerHTML = `<span>${clock.name}</span><span class="ss-time">${hh}:${mm}:${ss}</span>`;
    } else {
      $('#time').innerHTML = `${hh}<span class="colon">:</span>${mm}<span class="colon">:</span><span class="secs">${ss}</span>`;
    }
  }
  if (screensaver || ts - lastReadout < 250) return;
  lastReadout = ts;
  for (const [k, p] of [['hour', hp], ['minute', mp], ['second', sp]]) {
    const r = clock.readout(p);
    $(`#ro-${k} .p`).textContent = r.param;
    $(`#ro-${k} .v`).textContent = r.value;
  }
}

function route() {
  const id = location.hash.slice(1);
  const c = clocks.find((x) => x.id === id) || clocks[0];
  let saved = params.get('variant');
  if (!c.variants.some((v) => v.key === saved)) {
    try { saved = localStorage.getItem(`variant:${c.id}`); } catch {}
  }
  select(c, c.variants.find((v) => v.key === saved));
}

// Screensaver: no chrome, cursor hides when idle, Esc leaves, F toggles full screen.
function setupScreensaver() {
  let idle;
  const wake = () => {
    document.documentElement.classList.add('ss-awake');
    clearTimeout(idle);
    idle = setTimeout(() => document.documentElement.classList.remove('ss-awake'), 2500);
  };
  ['mousemove', 'pointerdown', 'touchstart'].forEach((e) => addEventListener(e, wake, { passive: true }));
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  addEventListener('dblclick', fullscreen);
  addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') fullscreen();
    if (e.key === 'Escape' && !document.fullscreenElement) {
      const url = new URL(location.href);
      url.searchParams.delete('screensaver');
      url.searchParams.delete('variant');
      location.href = url.pathname + url.search + url.hash;
    }
  });
}

window.addEventListener('hashchange', route);
if (screensaver) setupScreensaver();
document.fonts.ready.then(() => document.body.classList.add('fonts'));
route();
tick();
