module.exports = [
  { ignores: ['node_modules/**', 'coverage/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        console: 'readonly', process: 'readonly', require: 'readonly',
        module: 'readonly', exports: 'readonly', fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
    },
  },
];
