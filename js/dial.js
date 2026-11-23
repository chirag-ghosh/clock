// Generic dial: turns any closed sampled curve into a working clock face.
import { withArcLength, centroid, pointAt } from './curve.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const f = (n) => n.toFixed(2);

export class Dial {
  // `root` holds two stacked SVGs with the same viewBox: a static layer drawn once
  // (curve, axes, ticks, numerals) and a light live layer redrawn every frame (hands).
  // Keeping them apart means the browser never re-rasterises the static artwork.
  // Pass root = null for geometry only (no drawing), e.g. the target of a morph.
  constructor(root, points, opts = {}) {
    this.root = root;
    this.svg = root?.querySelector('svg.dial-static');
    this.live = root?.querySelector('svg.dial-live');
    this.opts = opts;
    this.build(points);
  }

  build(raw) {
    // Map math coords into SVG space, preserving aspect.
    const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const W = 1000, pad = 110;
    const s = (W - 2 * pad) / Math.max(maxX - minX, maxY - minY);
    const H = (maxY - minY) * s + 2 * pad;
    const VW = (maxX - minX) * s + 2 * pad;
    this.size = { w: VW, h: H };
    this.toX = (x) => (x - minX) * s + pad;
    this.toY = (y) => (maxY - y) * s + pad;
    this.bounds = { minX, maxX, minY, maxY };

    const pts = raw.map((p) => ({ ...p, X: this.toX(p.x), Y: this.toY(p.y) }));
    this.pts = pts;
    this.length = withArcLength(pts);
    const pv = this.opts.pivot;
    this.pivot = pv ? { X: this.toX(pv.x), Y: this.toY(pv.y) } : centroid(pts, this.length);
    if (this.root) this.render();
  }

  // The curve resampled at n equal arc-length steps from twelve o'clock. Two
  // snapshots line up point for point, which is what makes a morph possible.
  snapshot(n = 720) {
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(this.at(i / n));
    pts[n] = { ...pts[0] }; // closed
    return { pts, size: { ...this.size }, pivot: { ...this.pivot } };
  }

  // Show the in-between shape a fraction k of the way from snapshot A to B. Only
  // the curve and the hands are drawn; ticks and numerals are faded out meanwhile.
  morph(A, B, k) {
    const L = (a, b) => a + (b - a) * k;
    this.size = { w: L(A.size.w, B.size.w), h: L(A.size.h, B.size.h) };
    for (const s of [this.svg, this.live]) s.setAttribute('viewBox', `0 0 ${f(this.size.w)} ${f(this.size.h)}`);
    this.pts = A.pts.map((a, i) => {
      const b = B.pts[i];
      return { X: L(a.X, b.X), Y: L(a.Y, b.Y), x: L(a.x, b.x), y: L(a.y, b.y), t: L(a.t, b.t) };
    });
    this.length = withArcLength(this.pts);
    this.pivot = { X: L(A.pivot.X, B.pivot.X), Y: L(A.pivot.Y, B.pivot.Y) };
    for (const c of this.pivotEls) { c.setAttribute('cx', f(this.pivot.X)); c.setAttribute('cy', f(this.pivot.Y)); }
    this.curveEl.setAttribute('d', this.pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.X)} ${f(p.Y)}`).join(''));
    this.dayArcU = -1;
  }

  // point at fraction u ∈ [0,1) of the total arc length
  at(u) {
    return pointAt(this.pts, this.length, u);
  }

  pathBetween(u0, u1, step = 0.002) {
    let d = '';
    for (let u = u0; u < u1; u += step) {
      const p = this.at(u);
      d += (d ? 'L' : 'M') + f(p.X) + ' ' + f(p.Y);
    }
    const p = this.at(u1);
    return d + 'L' + f(p.X) + ' ' + f(p.Y);
  }

  // Unit normal pointing away from the pivot. Close to the pivot "away" is meaningless,
  // so fall back to the clock-face convention: first half of the dial right, second half left.
  normalAway(p, u = 0) {
    const len = Math.hypot(p.tx, p.ty) || 1;
    let nx = -p.ty / len, ny = p.tx / len;
    const dx = p.X - this.pivot.X, dy = p.Y - this.pivot.Y;
    const flip = Math.hypot(dx, dy) < 40 ? (u < 0.5 ? nx < 0 : nx > 0) : nx * dx + ny * dy < 0;
    if (flip) { nx = -nx; ny = -ny; }
    return { nx, ny };
  }

  render() {
    const svg = this.svg, live = this.live;
    svg.innerHTML = '';
    live.innerHTML = '';
    const { w, h } = this.size;
    for (const s of [svg, live]) s.setAttribute('viewBox', `0 0 ${f(w)} ${f(h)}`);

    // complex-plane axes
    const axes = el('g', { class: 'axes' }, svg);
    const ox = this.toX(0), oy = this.toY(0);
    el('line', { x1: 24, y1: f(oy), x2: f(w - 24), y2: f(oy) }, axes);
    el('line', { x1: f(ox), y1: 24, x2: f(ox), y2: f(h - 24) }, axes);
    const tick = (X, Y, txt, anchor, dx, dy) => {
      const t = el('text', { x: f(X + dx), y: f(Y + dy), 'text-anchor': anchor, class: 'axis-label' }, axes);
      t.textContent = txt;
    };
    const complex = this.opts.axes === 'complex';
    tick(w - 24, oy, complex ? 'Re' : 'x', 'end', 0, -10);
    tick(ox, 24, complex ? 'Im' : 'y', 'start', 10, 12);
    const yLabel = (v) => (complex ? (v === 1 ? 'i' : v === -1 ? '−i' : `${v}i`) : String(v)).replace('-', '−');
    const { minX, maxX, minY, maxY } = this.bounds;
    for (let v = Math.ceil(minX); v <= Math.floor(maxX); v++) {
      if (v === 0) continue;
      el('line', { x1: f(this.toX(v)), y1: f(oy - 5), x2: f(this.toX(v)), y2: f(oy + 5) }, axes);
      tick(this.toX(v), oy, String(v).replace('-', '−'), 'middle', 0, 22);
    }
    for (let v = Math.ceil(minY); v <= Math.floor(maxY); v++) {
      if (v === 0) continue;
      el('line', { x1: f(ox - 5), y1: f(this.toY(v)), x2: f(ox + 5), y2: f(this.toY(v)) }, axes);
      tick(ox, this.toY(v), yLabel(v), 'start', 10, 5);
    }

    // the curve itself
    this.curveEl = el('path', { d: this.pathBetween(0, 1, 0.0008), class: 'curve' }, svg);

    // ticks & numerals
    const marks = el('g', { class: 'marks' }, svg);
    for (let i = 0; i < 60; i++) {
      const p = this.at(i / 60);
      const { nx, ny } = this.normalAway(p, i / 60);
      const major = i % 5 === 0;
      const a = major ? 4 : 3, b = major ? 18 : 9;
      el('line', {
        x1: f(p.X + nx * a), y1: f(p.Y + ny * a), x2: f(p.X + nx * b), y2: f(p.Y + ny * b),
        class: major ? 'tick major' : 'tick',
      }, marks);
      if (major) {
        const n = i === 0 ? 12 : i / 5;
        // a numeral on the pivot itself goes beside it rather than along the normal
        const onPivot = Math.hypot(p.X - this.pivot.X, p.Y - this.pivot.Y) < 40;
        const lx = onPivot ? p.X + (i < 30 ? 1 : -1) * 62 : p.X + nx * 44;
        const ly = onPivot ? p.Y + 11 : p.Y + ny * 44 + 11;
        const t = el('text', { x: f(lx), y: f(ly), class: 'numeral' }, marks);
        t.textContent = n;
      }
    }

    // a notable point on the curve (a zero, a cusp, a node)
    const mk = this.opts.marker;
    if (mk) {
      const mx = this.toX(mk.x), my = this.toY(mk.y);
      const z = el('g', { class: 'zero' }, svg);
      el('circle', { cx: f(mx), cy: f(my), r: 7 }, z);
      if (mk.label) {
        const t = el('text', { x: f(mx - 14), y: f(my + 40), 'text-anchor': 'end', class: 'zero-label' }, z);
        t.textContent = mk.label;
      }
    }

    // live layer: swept arc, trail and hands
    this.dayArc = el('path', { class: 'day-arc' }, live);
    this.dayArcU = -1;
    const hands = el('g', { class: 'hands' }, live);
    this.trail = el('g', { class: 'trail' }, hands);
    const TRAIL = 14;
    this.trailSegs = Array.from({ length: TRAIL }, (_, i) =>
      el('path', { 'stroke-opacity': f(((i + 1) / TRAIL) ** 1.6) }, this.trail));
    this.hourGuide = el('line', { class: 'hand-guide' }, hands);
    this.hourHand = el('line', { class: 'hand hour' }, hands);
    this.hourTip = el('circle', { r: 9, class: 'tip hour' }, hands);
    this.minHand = el('line', { class: 'hand minute' }, hands);
    this.minTip = el('circle', { r: 7, class: 'tip minute' }, hands);
    this.secHand = el('line', { class: 'hand second' }, hands);
    // a soft halo instead of a blur filter: filters are re-rendered every frame
    this.secHalo = el('circle', { r: 15, class: 'tip-halo' }, hands);
    this.secDot = el('circle', { r: 6, class: 'tip second' }, hands);
    this.pivotEls = [
      el('circle', { cx: f(this.pivot.X), cy: f(this.pivot.Y), r: 11, class: 'pivot' }, hands),
      el('circle', { cx: f(this.pivot.X), cy: f(this.pivot.Y), r: 3.5, class: 'pivot-core' }, hands),
    ];
  }

  set(line, a, b) {
    line.setAttribute('x1', f(a.X)); line.setAttribute('y1', f(a.Y));
    line.setAttribute('x2', f(b.X)); line.setAttribute('y2', f(b.Y));
  }

  update(hU, mU, sU) {
    const P = this.pivot;
    const hp = this.at(hU), mp = this.at(mU), sp = this.at(sU);
    const short = { X: P.X + (hp.X - P.X) * 0.62, Y: P.Y + (hp.Y - P.Y) * 0.62 };
    this.set(this.hourHand, P, short);
    this.set(this.hourGuide, short, hp);
    this.hourTip.setAttribute('cx', f(hp.X)); this.hourTip.setAttribute('cy', f(hp.Y));
    this.set(this.minHand, P, mp);
    this.minTip.setAttribute('cx', f(mp.X)); this.minTip.setAttribute('cy', f(mp.Y));
    for (const c of [this.secDot, this.secHalo]) { c.setAttribute('cx', f(sp.X)); c.setAttribute('cy', f(sp.Y)); }
    // second hand: pivot to the marker, plus a short counterweight tail
    const dx = sp.X - P.X, dy = sp.Y - P.Y, d = Math.hypot(dx, dy) || 1;
    this.set(this.secHand, { X: P.X - (dx / d) * 46, Y: P.Y - (dy / d) * 46 }, sp);

    // comet trail behind the second marker
    const span = 0.12, n = this.trailSegs.length;
    this.trailSegs.forEach((seg, i) => {
      const a = sU - span + (span * i) / n, b = a + span / n + 0.0005;
      seg.setAttribute('d', this.pathBetween(a, b, 0.002));
    });
    // portion of the dial the hour hand has swept this half-day; it grows ~0.14 px/s,
    // so only rebuild it every ~10 seconds (or when the hour wraps)
    if (Math.abs(hU - this.dayArcU) > 0.00025) {
      this.dayArcU = hU;
      this.dayArc.setAttribute('d', hU > 0.0005 ? this.pathBetween(0, hU, 0.0015) : '');
    }
    return { hp, mp, sp };
  }
}
