// Figure-of-eight curves, stood upright so twelve o'clock is the top of the upper lobe.
const P = Math.PI;
const fmt = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(3)}`;

const variants = [
  {
    key: 'bernoulli', label: 'Bernoulli', formula: '(x² + y²)² = y² − x²', detail: 'x = sin t cos t / (1 + sin² t), y = cos t / (1 + sin² t)',
    f: (t) => { const d = 1 + Math.sin(t) ** 2; return [(Math.sin(t) * Math.cos(t)) / d, Math.cos(t) / d]; },
    text: `Jacob Bernoulli's lemniscate (1694): the points whose distances to two fixed foci multiply to a constant.`,
  },
  {
    key: 'gerono', label: 'Gerono', formula: 'y⁴ = y² − x²', detail: 'x = sin t cos t, y = cos t',
    f: (t) => [Math.sin(t) * Math.cos(t), Math.cos(t)],
    text: `Gerono's lemniscate, the simpler algebraic eight: a Lissajous figure with frequencies one and two.`,
  },
];

export default {
  id: 'lemniscate',
  numeral: 'IV',
  name: 'Lemniscate',
  title: 'The Lemniscate Clock',
  formula: '(x² + y²)² = y² − x²',
  variants,
  describe(v) {
    return `${v.text} The hands pivot on the node where the two lobes cross, so at three and nine o'clock
      they shrink to nothing and pass through the centre into the other lobe. The top lobe holds the first
      half of each turn, the bottom lobe the second.`;
  },
  marker: () => null, // the pivot sits on the node
  sample(v, n = 2400) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = (2 * P * i) / n;
      const [x, y] = v.f(t);
      pts.push({ x, y, t });
    }
    return pts;
  },
  pivot: { x: 0, y: 0 },
  readout(p) {
    return { param: `t = ${p.t.toFixed(3)}`, value: `(${fmt(p.x)}, ${fmt(p.y)})` };
  },
};
