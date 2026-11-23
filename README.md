# Curvature — clocks drawn on graphs

Clocks whose dials are mathematical curves instead of circles. Static site, no build step.

## Run with Docker Compose

```sh
docker compose up -d --build      # http://localhost:8080
CLOCK_PORT=3000 docker compose up -d   # pick another port
docker compose down
```

The image is `nginx:alpine` serving the static files, with a `/healthz` health check.

## Run locally

```sh
npm start        # http://localhost:8000 (zero-dependency Node server)
```

## Tests

```sh
npm test               # unit + end-to-end (needs Playwright + Chromium)
npm run test:unit      # zeta accuracy, arc-length maths, clock contract — Node only
npm run test:e2e       # real browser: dial renders, hands move, 12:00 sits on the zero, variants, mobile

# end-to-end against the running container, entirely inside Docker:
docker compose --profile test run --rm e2e
```

Set `BASE_URL` to point `npm run test:e2e` at any deployed copy.

## No. I — The Riemann Clock

The dial is ζ(½ + it) traced from t = −γ to t = +γ, where γ is a non-trivial zero of the
zeta function (selectable: γ₁, γ₂, γ₃). Since ζ(s̄) is the conjugate of ζ(s), the path is mirror-symmetric
and both ends land on the origin, so it closes into a loop, and 12 o'clock sits on the zero.
Hours are spaced by equal arc length, so the hands move at a steady speed along the curve.

## Adding a clock

Create `js/clocks/<name>.js` that exports `{ id, numeral, name, title, formula, variants, describe, sample, readout }`,
where `sample(variant)` returns a closed list of `{x, y, t}` points. Register it in `js/clocks/index.js`.
`js/dial.js` handles the rest: arc-length parametrisation, ticks, numerals and hands.
