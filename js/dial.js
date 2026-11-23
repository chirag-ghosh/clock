// Generic dial: turns any closed sampled curve into a working clock face.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const f = (n) => n.toFixed(2);

export class Dial {
  constructor(svg, points, opts = {}) {
    this.svg = svg;
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
    // cumulative arc length
    let L = 0;
    pts[0].s = 0;
    for (let i = 1; i < pts.length; i++) {
      L += Math.hypot(pts[i].X - pts[i - 1].X, pts[i].Y - pts[i - 1].Y);
      pts[i].s = L;
    }
    this.pts = pts;
    this.length = L;

    // pivot: arc-length weighted centroid
    let cx = 0, cy = 0;
    for (let i = 1; i < pts.length; i++) {
      const ds = pts[i].s - pts[i - 1].s;
      cx += ((pts[i].X + pts[i - 1].X) / 2) * ds;
      cy += ((pts[i].Y + pts[i - 1].Y) / 2) * ds;
    }
    this.pivot = { X: cx / L, Y: cy / L };
    this.render();
  }

  // point at fraction u ∈ [0,1) of the total arc length
  at(u) {
    u = ((u % 1) + 1) % 1;
    const target = u * this.length, P = this.pts;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (P[mid].s < target) lo = mid; else hi = mid;
    }
    const a = P[lo], b = P[hi];
    const k = b.s === a.s ? 0 : (target - a.s) / (b.s - a.s);
    const lerp = (p, q) => p + (q - p) * k;
    return { X: lerp(a.X, b.X), Y: lerp(a.Y, b.Y), x: lerp(a.x, b.x), y: lerp(a.y, b.y), t: lerp(a.t, b.t), tx: b.X - a.X, ty: b.Y - a.Y };
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

  normalAway(p) {
    const len = Math.hypot(p.tx, p.ty) || 1;
    let nx = -p.ty / len, ny = p.tx / len;
    if (nx * (p.X - this.pivot.X) + ny * (p.Y - this.pivot.Y) < 0) { nx = -nx; ny = -ny; }
    return { nx, ny };
  }

  render() {
    const svg = this.svg;
    svg.innerHTML = '';
    const { w, h } = this.size;
    svg.setAttribute('viewBox', `0 0 ${f(w)} ${f(h)}`);

    const defs = el('defs', {}, svg);
    const glow = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: '6', result: 'b' }, glow);
    const m = el('feMerge', {}, glow);
    el('feMergeNode', { in: 'b' }, m);
    el('feMergeNode', { in: 'SourceGraphic' }, m);

    // complex-plane axes
    const axes = el('g', { class: 'axes' }, svg);
    const ox = this.toX(0), oy = this.toY(0);
    el('line', { x1: 24, y1: f(oy), x2: f(w - 24), y2: f(oy) }, axes);
    el('line', { x1: f(ox), y1: 24, x2: f(ox), y2: f(h - 24) }, axes);
    const tick = (X, Y, txt, anchor, dx, dy) => {
      const t = el('text', { x: f(X + dx), y: f(Y + dy), 'text-anchor': anchor, class: 'axis-label' }, axes);
      t.textContent = txt;
    };
    tick(w - 24, oy, 'Re', 'end', 0, -10);
    tick(ox, 24, 'Im', 'start', 10, 12);
    const { minX, maxX, minY, maxY } = this.bounds;
    for (let v = Math.ceil(minX); v <= Math.floor(maxX); v++) {
      if (v === 0) continue;
      el('line', { x1: f(this.toX(v)), y1: f(oy - 5), x2: f(this.toX(v)), y2: f(oy + 5) }, axes);
      tick(this.toX(v), oy, String(v).replace('-', '−'), 'middle', 0, 22);
    }
    for (let v = Math.ceil(minY); v <= Math.floor(maxY); v++) {
      if (v === 0) continue;
      el('line', { x1: f(ox - 5), y1: f(this.toY(v)), x2: f(ox + 5), y2: f(this.toY(v)) }, axes);
      tick(ox, this.toY(v), (String(v) + 'i').replace('-', '−').replace(/^1i/, 'i').replace(/^−1i/, '−i'), 'start', 10, 5);
    }

    // the curve itself
    el('path', { d: this.pathBetween(0, 1, 0.0008), class: 'curve' }, svg);
    this.dayArc = el('path', { class: 'day-arc' }, svg);

    // ticks & numerals
    const marks = el('g', { class: 'marks' }, svg);
    for (let i = 0; i < 60; i++) {
      const p = this.at(i / 60);
      const { nx, ny } = this.normalAway(p);
      const major = i % 5 === 0;
      const a = major ? 4 : 3, b = major ? 18 : 9;
      el('line', {
        x1: f(p.X + nx * a), y1: f(p.Y + ny * a), x2: f(p.X + nx * b), y2: f(p.Y + ny * b),
        class: major ? 'tick major' : 'tick',
      }, marks);
      if (major) {
        const n = i === 0 ? 12 : i / 5;
        const t = el('text', { x: f(p.X + nx * 44), y: f(p.Y + ny * 44 + 11), class: 'numeral' }, marks);
        t.textContent = n;
      }
    }

    // the zero
    const z = el('g', { class: 'zero' }, svg);
    el('circle', { cx: f(ox), cy: f(oy), r: 7 }, z);
    if (this.opts.zeroLabel) {
      const t = el('text', { x: f(ox - 14), y: f(oy + 40), 'text-anchor': 'end', class: 'zero-label' }, z);
      t.textContent = this.opts.zeroLabel;
    }

    // hands
    const hands = el('g', { class: 'hands' }, svg);
    this.trail = el('g', { class: 'trail' }, hands);
    this.trailSegs = Array.from({ length: 28 }, (_, i) =>
      el('path', { 'stroke-opacity': f(((i + 1) / 28) ** 1.6) }, this.trail));
    this.hourGuide = el('line', { class: 'hand-guide' }, hands);
    this.hourHand = el('line', { class: 'hand hour' }, hands);
    this.hourTip = el('circle', { r: 9, class: 'tip hour' }, hands);
    this.minHand = el('line', { class: 'hand minute' }, hands);
    this.minTip = el('circle', { r: 7, class: 'tip minute' }, hands);
    this.secDot = el('circle', { r: 6, class: 'tip second', filter: 'url(#glow)' }, hands);
    el('circle', { cx: f(this.pivot.X), cy: f(this.pivot.Y), r: 11, class: 'pivot' }, hands);
    el('circle', { cx: f(this.pivot.X), cy: f(this.pivot.Y), r: 3.5, class: 'pivot-core' }, hands);
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
    this.secDot.setAttribute('cx', f(sp.X)); this.secDot.setAttribute('cy', f(sp.Y));

    // comet trail behind the second marker
    const span = 0.12, n = this.trailSegs.length;
    this.trailSegs.forEach((seg, i) => {
      const a = sU - span + (span * i) / n, b = a + span / n + 0.0005;
      seg.setAttribute('d', this.pathBetween(a, b, 0.001));
    });
    // portion of the dial the hour hand has swept this half-day
    this.dayArc.setAttribute('d', hU > 0.0005 ? this.pathBetween(0, hU, 0.0015) : '');
    return { hp, mp, sp };
  }
}
