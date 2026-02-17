// @ts-check
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier/recommended'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  prettier,
  {
    rules: {
      indent: 'off',
      quotes: ['error', 'single'],
      semi: ['error', 'never'],
      'comma-dangle': ['error', 'always-multiline'],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error'],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          trailingComma: 'all',
          printWidth: 100,
          tabWidth: 2,
          semi: false,
          bracketSpacing: true,
          arrowParens: 'avoid',
          endOfLine: 'auto',
        },
      ],
    },
  },
]
