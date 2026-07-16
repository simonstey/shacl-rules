// Flat ESLint config for the srl-engine package (pure TS library).
// Kept minimal + dependency-light: @eslint/js + typescript-eslint, both hoisted
// at the repo root. Lints src/ only (tests + dist excluded). Wire into CI via
// `npm -w srl-engine run lint`.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test/**', '*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Surface the pre-existing tech debt (T1): unused imports/vars + prefer-const.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      // The engine deliberately uses `as never` casts against strict @types/n3
      // predicate slots; allow the pattern without blanket-disabling the rule.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
