module.exports = {
  // Make runner self-contained and independent from root ESLint config
  root: true,
  env: { node: true, es2022: true },
  parser: 'espree',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: [],
  rules: {
    // Keep runner practical, not strict formatting
    'no-console': 'off',
    'import/extensions': 'off',
    'no-promise-executor-return': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
    'object-shorthand': 'off',
    'no-shadow': 'off',
    'consistent-return': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['.profile/**', '.tmp/**', 'public/**'],
};
