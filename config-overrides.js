// config-overrides.js
const webpack = require('webpack');

module.exports = function override(config) {
  // Добавляем fallback для Node.js модулей
  config.resolve.fallback = {
    ...config.resolve.fallback,
    buffer: require.resolve('buffer/'),
    stream: require.resolve('stream-browserify'),
    crypto: require.resolve('crypto-browserify'),
    process: require.resolve('process/browser.js'),
    vm: require.resolve('vm-browserify'),
    assert: require.resolve('assert/'),
  };

  // Добавляем расширения для правильной обработки .mjs файлов
  config.resolve.extensions = [
    '.mjs',
    '.js',
    '.jsx',
    '.json',
    '.ts',
    '.tsx',
  ];

  // Настройка для обработки .mjs файлов
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false, // Отключаем требование полностью указанных путей
    },
  });

  // Добавляем глобальные переменные
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser.js',
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_DEBUG': JSON.stringify(process.env.NODE_DEBUG),
    }),
  ];

  return config;
};