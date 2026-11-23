import riemann from './riemann.js';
import lissajous from './lissajous.js';
import cardioid from './cardioid.js';
import lemniscate from './lemniscate.js';

// Register new clocks here. Each clock supplies a closed curve via sample().
export const clocks = [riemann, lissajous, cardioid, lemniscate];

// Placeholders shown in the index until they're built.
export const forthcoming = [];
