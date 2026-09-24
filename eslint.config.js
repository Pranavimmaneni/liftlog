import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const HEX = /#(?:[0-9a-fA-F]{3}){1,2}\b/;

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'android',
      'design',
      'data',
      'node_modules',
      'playwright-report',
      'test-results',
      'scripts/vendor',
      'public',
      '.lighthouseci',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    // FR-THM-1 / CLAUDE.md: never write a hex colour in UI code.
    files: [
      'src/components/**/*.tsx',
      'src/screens/**/*.tsx',
      'src/illustration/**/*.{ts,tsx}',
      'src/app/**/*.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${HEX.source}/]`,
          message: 'Use a token CSS variable, not a hex colour (FR-THM-1).',
        },
        {
          selector: `TemplateElement[value.raw=/${HEX.source}/]`,
          message: 'Use a token CSS variable, not a hex colour (FR-THM-1).',
        },
      ],
    },
  },
  {
    // PRD §6 / NFR-MAINT-1: engines are pure and never use `any`.
    files: ['src/engine/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', 'dexie', 'dexie-*', '@/db/*', '@/platform*'] },
      ],
    },
  },
);
