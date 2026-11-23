// x = sin(a·t + δ), y = sin(b·t). Integer a, b make the figure close after t = 2π.
const P = Math.PI;
const fmt = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(3)}`;
const FRACS = { [P / 4]: 'π/4', [P / 12]: 'π/12' };

const variants = [
  { a: 3, b: 2, delta: P / 12 },
  { a: 3, b: 4, delta: P / 4 },
  { a: 5, b: 4, delta: P / 4 },
].map((v) => ({
  ...v,
  key: `${v.a}-${v.b}`,
  label: `${v.a} : ${v.b}`,
  detail: `a = ${v.a}, b = ${v.b}, δ = ${FRACS[v.delta]}`,
}));

// Start on the topmost crest (y = 1) nearest the vertical axis, heading right (clockwise).
function start(v) {
  let best;
  for (let k = 0; k < v.b; k++) {
    const t = (P / 2 + 2 * P * k) / v.b;
    const x = Math.sin(v.a * t + v.delta);
    if (!best || Math.abs(x) < Math.abs(best.x)) best = { t, x };
  }
  const dir = Math.cos(v.a * best.t + v.delta) >= 0 ? 1 : -1; // sign of dx/dt
  return { t0: best.t, dir };
}

export default {
  id: 'lissajous',
  numeral: 'II',
  name: 'Lissajous',
  title: 'The Lissajous Clock',
  formula: '(sin(at + δ), sin bt)',
  variants,
  describe(v) {
    return `Two perpendicular oscillations, one running <em>${v.a}</em> times and the other <em>${v.b}</em> times
      per cycle, offset by a phase of <em>δ = ${FRACS[v.delta]}</em>. Because the frequencies are whole numbers
      the figure closes on itself after one full period. Twelve o'clock sits on the top crest; the hands
      follow the curve through every crossing.`;
  },
  marker: () => null,
  sample(v, n = 2400) {
    const { t0, dir } = start(v);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + (dir * 2 * P * i) / n;
      pts.push({ x: Math.sin(v.a * t + v.delta), y: Math.sin(v.b * t), t: ((t % (2 * P)) + 2 * P) % (2 * P) });
    }
    return pts;
  },
  readout(p) {
    return { param: `t = ${p.t.toFixed(3)}`, value: `(${fmt(p.x)}, ${fmt(p.y)})` };
  },
};
