// Limaçons r = b − sin θ. At b = 1 this is the cardioid, with its cusp at the origin.
const P = Math.PI;
const fmt = (n) => `${n < 0 ? '−' : ''}${Math.abs(n).toFixed(3)}`;

const variants = [
  { b: 1, key: 'cardioid', label: 'b = 1', name: 'cardioid' },
  { b: 0.5, key: 'inner', label: 'b = ½', name: 'limaçon with an inner loop' },
  { b: 1.5, key: 'dimpled', label: 'b = 1½', name: 'dimpled limaçon' },
].map((v) => ({ ...v, detail: `r = ${v.label.slice(4)} − sin θ` }));

export default {
  id: 'cardioid',
  numeral: 'III',
  name: 'Cardioid',
  title: 'The Cardioid Clock',
  formula: 'r = b − sin θ',
  variants,
  describe(v) {
    const lead = {
      cardioid: `The heart-shaped curve traced by a point on a circle rolling around another of equal size.
        Its single cusp touches the origin, and twelve o'clock sits exactly on it.`,
      inner: `With <em>b</em> below one the limaçon folds through the origin twice and grows a small inner loop.
        The hands start at the top of that loop and spend part of every hour tracing it.`,
      dimpled: `With <em>b</em> above one the cusp relaxes into a soft dimple and the curve never reaches
        the origin.`,
    }[v.key];
    return `${lead} This is the ${v.name}, <em>r = ${v.label.slice(4)} − sin θ</em>, swept clockwise from the top.`;
  },
  marker: (v) => (v.b === 1 ? { x: 0, y: 0, label: 'cusp' } : null),
  sample(v, n = 2400) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const th = P / 2 - (2 * P * i) / n;
      const r = v.b - Math.sin(th);
      pts.push({ x: r * Math.cos(th), y: r * Math.sin(th), t: th, r });
    }
    return pts;
  },
  readout(p) {
    const deg = ((((p.t * 180) / P) % 360) + 360) % 360;
    const r = Math.hypot(p.x, p.y);
    return { param: `θ = ${deg.toFixed(1)}°`, value: `r = ${fmt(r)}` };
  },
};
