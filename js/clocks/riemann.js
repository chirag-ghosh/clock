import { zeta, ZEROS } from '../zeta.js';

// The critical line ζ(½ + it) traced from t = −γₙ to t = +γₙ.
// Because ζ(s̄) = ζ(s)‾, the path is mirror-symmetric and both ends land on
// the n-th non-trivial zero, i.e. the origin. That closes the loop: the dial.
const ORDINALS = ['first', 'second', 'third'];

export default {
  id: 'riemann',
  numeral: 'I',
  name: 'Riemann',
  title: 'The Riemann Clock',
  formula: 'ζ(½ + it)',
  axes: 'complex',
  variants: ZEROS.slice(0, 3).map((g, i) => ({
    key: `g${i + 1}`,
    label: `γ${'₁₂₃'[i]}`,
    detail: `t ∈ [−${g.toFixed(4)}, ${g.toFixed(4)}]`,
    gamma: g,
    ordinal: ORDINALS[i],
  })),
  describe(v) {
    return `The dial is the Riemann zeta function evaluated along the critical line,
      from <em>t = −γ</em> to <em>t = +γ</em>, where <em>γ ≈ ${v.gamma.toFixed(3)}</em> is the ${v.ordinal}
      non-trivial zero. Conjugate symmetry folds the path back on itself and both ends meet at the origin —
      so twelve o'clock sits exactly on a zero. Hands travel at constant speed by arc length.`;
  },
  marker: (v) => ({ x: 0, y: 0, label: `ρ = ½ + i${v.label}` }),
  sample(v, n = 2400) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = -v.gamma + (2 * v.gamma * i) / n;
      const [x, y] = zeta(0.5, t);
      pts.push({ x, y, t });
    }
    return pts;
  },
  // readout for a point on the curve
  readout(p) {
    const sign = p.y < 0 ? '−' : '+';
    return {
      param: `t = ${p.t >= 0 ? '' : '−'}${Math.abs(p.t).toFixed(3)}`,
      value: `${p.x < 0 ? '−' : ''}${Math.abs(p.x).toFixed(3)} ${sign} ${Math.abs(p.y).toFixed(3)}i`,
    };
  },
};
