const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    fileParallelism: false
  }
});

// problem it solves:
