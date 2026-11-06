import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['build/'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        // Vite replaces process.env.NODE_ENV when it builds the client
        process: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // As under Create React App. Components still import React, which the
      // automatic JSX runtime no longer needs.
      'no-unused-vars': ['warn', {
        args: 'none',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^React$',
      }],
      // Not part of Create React App's rules; HandsFreeInterface declares
      // variables in the cases of its voice command switch
      'no-case-declarations': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['**/*.test.js', 'src/setupTests.js'],
    languageOptions: {
      globals: globals.vitest,
    },
  },
];
