import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withArcLength, centroid, pointAt, handFractions } from '../../js/curve.js';
import riemann from '../../js/clocks/riemann.js';
import { clocks } from '../../js/clocks/index.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// unit circle sampled densely; X/Y = x/y for convenience
function circle(n = 4000) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return { x: Math.cos(a), y: Math.sin(a), X: Math.cos(a), Y: Math.sin(a), t: a };
  });
}

test('arc length of a unit circle is 2π', () => {
  close(withArcLength(circle()), 2 * Math.PI, 1e-5);
});

test('centroid of a circle is its centre', () => {
  const c = circle();
  const p = centroid(c, withArcLength(c));
  close(p.X, 0); close(p.Y, 0);
});

test('pointAt walks the curve at constant speed and wraps', () => {
  const c = circle();
  const L = withArcLength(c);
  close(pointAt(c, L, 0.25).t, Math.PI / 2, 1e-4);
  close(pointAt(c, L, 0.5).X, -1, 1e-6);
  close(pointAt(c, L, 1.25).t, pointAt(c, L, 0.25).t);
  close(pointAt(c, L, -0.75).t, pointAt(c, L, 0.25).t);
});

test('handFractions maps clock time to dial fractions', () => {
  const u = handFractions(new Date(2026, 0, 1, 15, 30, 0, 0));
  close(u.hour, 3.5 / 12); close(u.minute, 0.5); close(u.second, 0);
  const noon = handFractions(new Date(2026, 0, 1, 12, 0, 0, 0));
  assert.deepEqual(noon, { hour: 0, minute: 0, second: 0 });
  const late = handFractions(new Date(2026, 0, 1, 23, 59, 59, 999));
  assert.ok(late.hour < 1 && late.minute < 1 && late.second < 1);
});

test('every Riemann variant closes at the origin and is symmetric', () => {
  for (const v of riemann.variants) {
    const pts = riemann.sample(v, 800);
    const a = pts[0], b = pts.at(-1), mid = pts[400];
    assert.ok(Math.hypot(a.x, a.y) < 1e-9, `start of ${v.key} not at 0`);
    assert.ok(Math.hypot(b.x, b.y) < 1e-9, `end of ${v.key} not at 0`);
    close(mid.t, 0, 1e-9);
    close(mid.x, -1.4603545088, 1e-8); // passes through ζ(½)
    for (let i = 0; i < 800; i += 37) {
      close(pts[i].x, pts[800 - i].x, 1e-9);
      close(pts[i].y, -pts[800 - i].y, 1e-9);
    }
  }
});

test('clock registry entries implement the clock contract', () => {
  for (const c of clocks) {
    for (const k of ['id', 'numeral', 'name', 'title', 'formula']) assert.equal(typeof c[k], 'string', k);
    for (const k of ['describe', 'sample', 'readout']) assert.equal(typeof c[k], 'function', k);
    assert.ok(c.variants.length > 0);
    const keys = new Set(c.variants.map((v) => v.key));
    assert.equal(keys.size, c.variants.length, 'variant keys must be unique');
    const r = c.readout(c.sample(c.variants[0], 10)[3]);
    assert.ok(r.param && r.value);
  }
});
