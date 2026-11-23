// Pure geometry helpers for dials: no DOM, so they can be unit-tested in Node.

// Adds cumulative arc length `s` (in X/Y space) to each point. Returns total length.
export function withArcLength(pts) {
  let L = 0;
  pts[0].s = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i].X - pts[i - 1].X, pts[i].Y - pts[i - 1].Y);
    pts[i].s = L;
  }
  return L;
}

// Arc-length weighted centroid: where the hands pivot.
export function centroid(pts, L) {
  let cx = 0, cy = 0;
  for (let i = 1; i < pts.length; i++) {
    const ds = pts[i].s - pts[i - 1].s;
    cx += ((pts[i].X + pts[i - 1].X) / 2) * ds;
    cy += ((pts[i].Y + pts[i - 1].Y) / 2) * ds;
  }
  return { X: cx / L, Y: cy / L };
}

// Point at fraction u of the total arc length (wraps, so any real u works).
export function pointAt(pts, L, u) {
  u = ((u % 1) + 1) % 1;
  const target = u * L;
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].s < target) lo = mid; else hi = mid;
  }
  const a = pts[lo], b = pts[hi];
  const k = b.s === a.s ? 0 : (target - a.s) / (b.s - a.s);
  const lerp = (p, q) => p + (q - p) * k;
  return { X: lerp(a.X, b.X), Y: lerp(a.Y, b.Y), x: lerp(a.x, b.x), y: lerp(a.y, b.y), t: lerp(a.t, b.t), tx: b.X - a.X, ty: b.Y - a.Y };
}

// Fractions of the dial each hand has travelled at a given moment.
export function handFractions(date) {
  const sec = date.getSeconds() + date.getMilliseconds() / 1000;
  const min = date.getMinutes() + sec / 60;
  const hr = (date.getHours() % 12) + min / 60;
  return { hour: hr / 12, minute: min / 60, second: sec / 60 };
}
