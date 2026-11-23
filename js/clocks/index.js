import riemann from './riemann.js';

// Register new clocks here. Each clock supplies a closed curve via sample().
export const clocks = [riemann];

// Placeholders shown in the index until they're built.
export const forthcoming = [
  { numeral: 'II', name: 'Lissajous' },
  { numeral: 'III', name: 'Cardioid' },
  { numeral: 'IV', name: 'Lemniscate' },
];
