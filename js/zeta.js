// Riemann zeta function on the complex plane via Euler–Maclaurin summation.
// Accurate to ~1e-12 for |Im s| < ~60, which is all the clock needs.

const B2K = [1 / 6, -1 / 30, 1 / 42, -1 / 30, 5 / 66, -691 / 2730, 7 / 6, -3617 / 510];

function cpow(n, re, im) {
  // n^(-(re + i im)) for real n > 0
  const ln = Math.log(n);
  const mag = Math.exp(-re * ln);
  const ang = -im * ln;
  return [mag * Math.cos(ang), mag * Math.sin(ang)];
}

const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};

export function zeta(re, im, N = 40) {
  let sr = 0, si = 0;
  for (let n = 1; n < N; n++) {
    const [a, b] = cpow(n, re, im);
    sr += a; si += b;
  }
  const Ns = cpow(N, re, im); // N^-s
  // N^(1-s)/(s-1)
  const tail = cdiv([Ns[0] * N, Ns[1] * N], [re - 1, im]);
  sr += tail[0] + Ns[0] / 2;
  si += tail[1] + Ns[1] / 2;

  // Bernoulli correction terms
  let poch = [re, im];               // s(s+1)...(s+2k-2)
  let pw = [Ns[0] / N, Ns[1] / N];   // N^(-s-2k+1)
  let fact = 2;                      // (2k)!
  for (let k = 1; k <= B2K.length; k++) {
    const term = cmul(poch, pw);
    sr += (B2K[k - 1] / fact) * term[0];
    si += (B2K[k - 1] / fact) * term[1];
    poch = cmul(cmul(poch, [re + 2 * k - 1, im]), [re + 2 * k, im]);
    pw = [pw[0] / (N * N), pw[1] / (N * N)];
    fact *= (2 * k + 1) * (2 * k + 2);
  }
  return [sr, si];
}

// Imaginary parts of the first non-trivial zeros on the critical line.
export const ZEROS = [14.134725141734693, 21.022039638771555, 25.010857580145688,
  30.424876125859513, 32.935061587739189, 37.586178158825671];
