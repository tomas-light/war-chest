import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import prettierPluginRecommended from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tsEslint from 'typescript-eslint';
import {
  createFsdImportLinterConfigs,
  getFsdTranslationsLinterConfig,
} from './eslint-rules/fsd.mjs';

const javascriptFiles = ['**/*.{cjs,js,mjs}'];
const sourceFiles = ['**/*.{cjs,js,mjs,ts,tsx}'];
const typescriptFiles = ['**/*.{ts,tsx}'];
const webFiles = ['apps/web/**/*.{ts,tsx}'];
const react = fixupPluginRules(reactPlugin);
const reactHooks = fixupPluginRules(reactHooksPlugin);

export default tsEslint.config(
  {
    ignores: [
      '.yarn/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/ts-builds/**',
      'packages/database/migrations/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: javascriptFiles,
    languageOptions: {
      globals: globals.node,
    },
  },
  ...tsEslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typescriptFiles,
  })),
  {
    files: typescriptFiles,
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            'packages/database/*.ts',
            'packages/database/tests/*.ts',
          ],
          defaultProject: 'tsconfig.eslint.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/adjacent-overload-signatures': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': 'warn',
    },
  },
  {
    files: sourceFiles,
    plugins: {
      'import-x': importX,
    },
    rules: {
      'import-x/newline-after-import': 'warn',
      'import-x/no-duplicates': 'warn',
      'import-x/order': [
        'warn',
        {
          alphabetize: {
            caseInsensitive: true,
            order: 'asc',
            orderImportKind: 'asc',
          },
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'index',
            'sibling',
          ],
          named: {
            enabled: true,
            export: true,
            import: true,
            types: 'types-first',
          },
          'newlines-between': 'never',
          pathGroups: [
            {
              group: 'internal',
              pattern: '#/**',
              position: 'before',
            },
            {
              group: 'sibling',
              pattern: './**.module.scss',
              position: 'after',
            },
          ],
        },
      ],
    },
  },
  {
    files: typescriptFiles,
    rules: {
      '@typescript-eslint/consistent-type-exports': [
        'warn',
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          fixStyle: 'inline-type-imports',
          prefer: 'type-imports',
        },
      ],
    },
  },
  {
    files: webFiles,
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/display-name': 'warn',
      'react/jsx-curly-brace-presence': [
        'warn',
        {
          children: 'never',
          propElementValues: 'always',
          props: 'never',
        },
      ],
      'react/no-unknown-property': 'off',
      'react/no-unescaped-entities': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
    settings: {
      react: {
        version: '19.0',
      },
    },
  },
  ...createFsdImportLinterConfigs('apps/web/src'),
  getFsdTranslationsLinterConfig('apps/web/src'),
  {
    ...prettierPluginRecommended,
    files: sourceFiles,
    rules: {
      ...prettierPluginRecommended.rules,
      curly: ['error', 'all'],
      'func-style': ['error', 'declaration'],
      'id-denylist': [
        'error',
        'err',
        'cb',
        'req',
        ...'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz'
          .split('')
          .filter((letter) => !new Set(['t', 'x', 'y', 'z']).has(letter)),
      ],
      'max-len': [
        'warn',
        {
          code: 80,
          comments: 120,
          ignoreComments: true,
          ignoreRegExpLiterals: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          tabWidth: 2,
        },
      ],
      'spaced-comment': ['error', 'always'],
    },
  }
);
