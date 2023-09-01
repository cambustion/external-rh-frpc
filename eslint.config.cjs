// Hey Emacs, this is -*- coding: utf-8 -*-

/* eslint-disable import/no-extraneous-dependencies */

const config = require('@ramblehead/js-configs/base/eslint.config.cjs');

module.exports = {
  ...config,
  rules: {
    ...config.rules,
    'no-console': 'off',
  },
  settings: {
    ...config.settings,
    react: {
      version: 'detect',
    },
  },
};
