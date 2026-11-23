import { clocks, forthcoming } from './clocks/index.js';
import { Dial } from './dial.js';
import { handFractions } from './curve.js';

const $ = (s) => document.querySelector(s);
const root = $('#dial');
const svg = root.querySelector('svg.dial-static');
const params = new URLSearchParams(location.search);
const screensaver = document.documentElement.classList.contains('screensaver');
let dial, clock, variant, raf;
let lastFrame = -Infinity, lastSecond = -1, lastReadout = 0; // -Infinity: never skip the first frame
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
  dial = new Dial(root, c.sample(variant), dialOptions(c, variant));
  lastSecond = -1;
  requestAnimationFrame(() => root.classList.add('ready'));
  renderIndex();
  renderVariants();
}

const dialOptions = (c, v) => ({ marker: c.marker?.(v), pivot: c.pivot, axes: c.axes });
const pad = (n) => String(n).padStart(2, '0');
// each digit in its own fixed-width slot (see .time .d in styles.css)
const digits = (s) => [...s].map((c) => `<span class="d">${c}</span>`).join('');

// Size the digit slot to the widest digit of the display face, once it has loaded.
function measureDigits() {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `100px ${getComputedStyle(document.body).getPropertyValue('--display')}`;
  const widest = Math.max(...'0123456789'.split('').map((d) => ctx.measureText(d).width));
  if (widest > 0) document.documentElement.style.setProperty('--digit-w', `${(widest / 100).toFixed(3)}em`);
}

// ——— cycle: ?cycle[=seconds] moves through every clock, morphing one dial into the next ———
const cycleParam = params.get('cycle');
const cycling = screensaver && cycleParam !== null && !/^(0|false|off|no)$/i.test(cycleParam);
const CYCLE_MS = Math.max(8, Number(cycleParam) || 45) * 1000;
const FADE_MS = 700, MORPH_MS = 2600;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
let morph = null;

// The playlist: which clock, and which of its variants, in order.
const PLAYLIST = [
  ['riemann', 'g1'],       // γ₁
  ['lissajous', '3-2'],    // 3 : 2
  ['cardioid', 'inner'],   // b = ½
  ['lemniscate', 'gerono'],
].map(([id, key]) => {
  const c = clocks.find((x) => x.id === id);
  return { c, v: c.variants.find((v) => v.key === key) };
});

function nextClock() {
  const i = PLAYLIST.findIndex((e) => e.c === clock && e.v === variant);
  return PLAYLIST[(i + 1) % PLAYLIST.length]; // a clock off the list starts it from the top
}

function startTransition() {
  const { c, v } = nextClock();
  // 1. fade ticks, numerals, axes and caption name out
  root.classList.add('morphing');
  $('#ss-caption').classList.add('changing');
  setTimeout(() => {
    // 2. bend the curve (and the hands riding it) into the next clock's curve
    const target = new Dial(null, c.sample(v), dialOptions(c, v));
    morph = { from: dial.snapshot(), to: target.snapshot(), start: performance.now(), c, v };
  }, FADE_MS);
}

function finishTransition() {
  const { c, v } = morph;
  morph = null;
  // 3. draw the new dial for real (still faded), then let its artwork fade in
  clock = c; variant = v;
  dial = new Dial(root, c.sample(v), dialOptions(c, v));
  document.title = `${c.name} · Curvature`;
  $('#formula').textContent = v.formula || c.formula;
  $('#domain').textContent = v.detail;
  lastSecond = -1;
  root.getBoundingClientRect(); // commit the faded state before removing the class
  requestAnimationFrame(() => {
    root.classList.remove('morphing');
    $('#ss-caption').classList.remove('changing');
  });
  setTimeout(startTransition, CYCLE_MS);
}

function tick(ts = performance.now()) {
  raf = requestAnimationFrame(tick);
  if (ts - lastFrame < FRAME_MS) return;
  lastFrame = ts;

  if (morph) {
    const k = Math.min(1, (performance.now() - morph.start) / MORPH_MS);
    dial.morph(morph.from, morph.to, ease(k));
    if (k >= 1) finishTransition();
  }

  const now = new Date();
  const u = handFractions(now);
  const { hp, mp, sp } = dial.update(u.hour, u.minute, u.second);

  // text only changes once a second; rewriting it every frame forces a layout each time
  const second = now.getSeconds();
  if (second !== lastSecond) {
    lastSecond = second;
    const [hh, mm, ss] = [now.getHours(), now.getMinutes(), second].map(pad);
    if (screensaver) {
      $('#ss-caption').innerHTML = `<span>${clock.name}</span><span class="ss-time">${digits(hh)}:${digits(mm)}:${digits(ss)}</span>`;
    } else {
      $('#time').innerHTML = `${digits(hh)}<span class="colon">:</span>${digits(mm)}<span class="colon">:</span><span class="secs">${digits(ss)}</span>`;
    }
  }
  if (screensaver || !detailsOpen || ts - lastReadout < 250) return;
  lastReadout = ts;
  for (const [k, p] of [['hour', hp], ['minute', mp], ['second', sp]]) {
    const r = clock.readout(p);
    $(`#ro-${k} .p`).textContent = r.param;
    $(`#ro-${k} .v`).textContent = r.value;
  }
}

// "Know more" folds the formula, variants, readouts and description in and out.
let detailsOpen = false;
function setDetails(open, scroll) {
  detailsOpen = open;
  $('#details').classList.toggle('open', open);
  $('#more').setAttribute('aria-expanded', String(open));
  $('#more .more-label').textContent = open ? 'Less' : 'Know more';
  try { localStorage.setItem('details', open ? 'open' : 'closed'); } catch {}
  lastReadout = 0;
  if (open && scroll) {
    // once it has finished unfolding, scroll so the panel is in view, keeping the bar above it visible
    const details = $('#details');
    const reveal = (e) => {
      if (e && e.target !== details) return;
      details.removeEventListener('transitionend', reveal);
      const bar = $('.bar').getBoundingClientRect(), box = details.getBoundingClientRect();
      const by = Math.min(bar.top - 16, box.bottom + 24 - innerHeight);
      if (by > 0) scrollBy({ top: by, behavior: 'smooth' });
    };
    details.addEventListener('transitionend', reveal);
  }
}
$('#more').addEventListener('click', () => setDetails(!detailsOpen, true));
try { if (localStorage.getItem('details') === 'open') setDetails(true, false); } catch {}

function route() {
  const id = location.hash.slice(1);
  const c = clocks.find((x) => x.id === id) || clocks[0];
  // cycling starts on the playlist's variant of the chosen clock
  const listed = cycling && PLAYLIST.find((e) => e.c === c);
  if (listed) return select(c, listed.v);
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
      url.searchParams.delete('cycle');
      location.href = url.pathname + url.search + url.hash;
    }
  });
}

window.addEventListener('hashchange', route);
if (screensaver) setupScreensaver();
document.fonts.ready.then(() => { document.body.classList.add('fonts'); measureDigits(); });
route();
tick();
if (cycling) setTimeout(startTransition, CYCLE_MS);
