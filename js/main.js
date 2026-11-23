import { clocks, forthcoming } from './clocks/index.js';
import { Dial } from './dial.js';
import { handFractions } from './curve.js';

const $ = (s) => document.querySelector(s);
const svg = $('#dial');
const params = new URLSearchParams(location.search);
const screensaver = document.documentElement.classList.contains('screensaver');
let dial, clock, variant, raf;

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
  svg.classList.remove('ready');
  dial = new Dial(svg, c.sample(variant), { marker: c.marker?.(variant), pivot: c.pivot, axes: c.axes });
  requestAnimationFrame(() => svg.classList.add('ready'));
  renderIndex();
  renderVariants();
}

const pad = (n) => String(n).padStart(2, '0');

function tick() {
  const now = new Date();
  const u = handFractions(now);
  const { hp, mp, sp } = dial.update(u.hour, u.minute, u.second);

  if (screensaver) {
    $('#ss-caption').innerHTML = `<span>${clock.name}</span><span class="ss-time">${pad(now.getHours())}:${pad(now.getMinutes())}</span>`;
    raf = requestAnimationFrame(tick);
    return;
  }
  $('#time').innerHTML = `${pad(now.getHours())}<span class="colon">:</span>${pad(now.getMinutes())}<span class="secs">${pad(now.getSeconds())}</span>`;
  const rows = [['hour', hp], ['minute', mp], ['second', sp]];
  for (const [k, p] of rows) {
    const r = clock.readout(p);
    $(`#ro-${k} .p`).textContent = r.param;
    $(`#ro-${k} .v`).textContent = r.value;
  }
  raf = requestAnimationFrame(tick);
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
