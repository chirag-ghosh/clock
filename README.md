# Curvature — clocks drawn on graphs

Clocks whose dials are mathematical curves instead of circles. Static site, no build step:

```sh
python3 -m http.server   # then open http://localhost:8000
```

## No. I — The Riemann Clock

The dial is ζ(½ + it) traced from t = −γ to t = +γ, where γ is a non-trivial zero of the
zeta function (selectable: γ₁, γ₂, γ₃). Since ζ(s̄) is the conjugate of ζ(s), the path is mirror-symmetric
and both ends land on the origin, so it closes into a loop, and 12 o'clock sits on the zero.
Hours are spaced by equal arc length, so the hands move at a steady speed along the curve.

## Adding a clock

Create `js/clocks/<name>.js` that exports `{ id, numeral, name, title, formula, variants, describe, sample, readout }`,
where `sample(variant)` returns a closed list of `{x, y, t}` points. Register it in `js/clocks/index.js`.
`js/dial.js` handles the rest: arc-length parametrisation, ticks, numerals and hands.
