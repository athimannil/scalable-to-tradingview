import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-plugin-prettier';
import importPlugin from 'eslint-plugin-import';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    // removed explicit 'jsx-a11y' plugin to avoid "Cannot redefine plugin" error
    plugins: { prettier, import: importPlugin },
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
        },
      ],
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/alt-text': 'warn',
    },
  },
]);

export default eslintConfig;
