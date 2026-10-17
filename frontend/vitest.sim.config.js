import base from './vite.config.js';

// Balance simulations: long, deterministic, out of the regular test run.
export default {
  ...base,
  test: { ...base.test, include: ['src/**/*.sim.js'], testTimeout: 600000 },
};
