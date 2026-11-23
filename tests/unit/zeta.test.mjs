import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeta, ZEROS } from '../../js/zeta.js';

const close = (a, b, eps = 1e-10) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('ζ(2) = π²/6', () => {
  const [re, im] = zeta(2, 0);
  close(re, Math.PI ** 2 / 6);
  close(im, 0);
});

test('ζ(4) = π⁴/90', () => close(zeta(4, 0)[0], Math.PI ** 4 / 90));

test('ζ(½) ≈ −1.4603545088', () => close(zeta(0.5, 0)[0], -1.4603545088095868, 1e-9));

test('ζ(−1) = −1/12 (analytic continuation)', () => close(zeta(-1, 0)[0], -1 / 12, 1e-9));

test('known value ζ(½ + 10i)', () => {
  const [re, im] = zeta(0.5, 10);
  close(re, 1.5448952202665, 1e-9);
  close(im, -0.1153364652348, 1e-9);
});

test('every listed γ is a zero on the critical line', () => {
  for (const g of ZEROS) {
    const [re, im] = zeta(0.5, g);
    assert.ok(Math.hypot(re, im) < 1e-12, `|ζ(½ + ${g}i)| = ${Math.hypot(re, im)}`);
  }
});

test('conjugate symmetry ζ(s̄) = ζ(s)‾', () => {
  for (const t of [0.7, 3.3, 12.1, 19.9]) {
    const [a, b] = zeta(0.5, t);
    const [c, d] = zeta(0.5, -t);
    close(a, c, 1e-12);
    close(b, -d, 1e-12);
  }
});
