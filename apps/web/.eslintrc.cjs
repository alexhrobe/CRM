/* ESLint config — Vite + React + TypeScript (legacy eslintrc, ESLint 8). */
module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-hooks', 'react-refresh'],
  settings: { react: { version: '18' } },
  ignorePatterns: ['dist', 'node_modules', 'vite.config.ts', 'vitest.config.ts', '*.cjs'],
  rules: {
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    // Dev-only HMR ergonomics; we intentionally co-locate Context providers
    // with their hooks (auth.tsx, theme.tsx), the standard React pattern.
    'react-refresh/only-export-components': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // d3/supabase payloads and seed data legitimately use `any` in spots.
    '@typescript-eslint/no-explicit-any': 'off',
  },
}
