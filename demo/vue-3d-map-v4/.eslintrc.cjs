// 盡量貼近 cdn_frontend_vue 的設定：Vue 3 + Airbnb + @babel/eslint-parser
module.exports = {
  root: true,
  env: { browser: true, node: true },
  extends: ['plugin:vue/vue3-essential', '@vue/airbnb'],
  parserOptions: {
    parser: '@babel/eslint-parser',
    requireConfigFile: false,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': { node: { extensions: ['.js', '.vue'] } },
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      env: { mocha: true },
      // 測試直接用 Node ESM 執行，import 必須寫副檔名
      rules: { 'import/extensions': ['error', 'always', { ignorePackages: true }] },
    },
  ],
};
