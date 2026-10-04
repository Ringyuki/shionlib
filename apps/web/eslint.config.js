import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import { noComments } from './eslint/no-comments.js'

const apiShapeMessage =
  'API shapes come from ~/shared/api (Schema, ApiData, ApiBody, ApiQuery); never redeclare them.'

const featureEntry = {
  regex: '^~/features/[^/]+/(?![^/]+\\.server$).+',
  message: 'Import a feature through its public entry (~/features/<name>).',
}

const clientSafe = {
  regex: '\\.server$',
  allowTypeImports: true,
  message: 'Server modules are imported only by routes, root and other *.server.ts modules.',
}

const restrictedImports = (...patterns) => [
  'error',
  {
    paths: [
      { name: 'openapi-fetch', message: 'Call the API through ~/shared/api.' },
      { name: 'axios', message: 'Call the API through ~/shared/api.' },
      { name: 'ky', message: 'Call the API through ~/shared/api.' },
      { name: 'swr', message: 'Load data in loaders and fetchers.' },
      { name: '@tanstack/react-query', message: 'Load data in loaders and fetchers.' },
    ],
    patterns,
  },
]

export default defineConfig([
  globalIgnores(['build', '.react-router', 'app/shared/api/generated']),
  js.configs.recommended,
  tseslint.configs.strict,
  reactHooks.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx,js}'],
    plugins: { shionlib: { rules: { 'no-comments': noComments } } },
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: {
      'shionlib/no-comments': 'error',
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Call the API through ~/shared/api.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'TSPropertySignature > Identifier.key[name=/_/]', message: apiShapeMessage },
        { selector: 'TSPropertySignature > Literal.key[value=/_/]', message: apiShapeMessage },
        {
          selector:
            ':matches(TSTypeAliasDeclaration, TSInterfaceDeclaration) > Identifier.id[name=/(DTO|Dto|Response|Request|Payload|Body)$/]',
          message: apiShapeMessage,
        },
      ],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-restricted-imports': restrictedImports(featureEntry),
    },
  },
  {
    files: ['app/messages/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports({
        regex: '^~/features/[^/]+/(?!messages/[a-z]+\\.json$).+',
        message: 'The message composition imports only feature messages.',
      }),
    },
  },
  {
    files: ['app/shared/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(
        {
          regex: '^~/(features|routes|messages)(/|$)',
          message:
            'shared is the platform layer; it never depends on features, routes or messages.',
        },
        clientSafe,
      ),
    },
  },
  {
    files: ['app/shared/**/*.server.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports({
        regex: '^~/(features|routes|messages)(/|$)',
        message: 'shared is the platform layer; it never depends on features, routes or messages.',
      }),
    },
  },
  {
    files: ['app/shared/api/**/*.ts'],
    ignores: ['app/shared/api/**/*.test.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    files: ['app/features/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(featureEntry, clientSafe, {
        regex: '^~/(routes|messages)(/|$)',
        message: 'Features never depend on routes or the message composition.',
      }),
    },
  },
  {
    files: ['app/features/**/*.server.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(featureEntry, {
        regex: '^~/(routes|messages)(/|$)',
        message: 'Features never depend on routes or the message composition.',
      }),
    },
  },
  {
    files: ['app/features/*/*.ts'],
    ignores: ['app/features/*/use-*.ts', 'app/features/*/*.server.ts', 'app/features/*/index.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(
        featureEntry,
        clientSafe,
        {
          regex: '^(react|react-dom|react-router|use-intl|@hina-ui/react)$',
          message:
            'Models and use-cases are pure TypeScript; React integration lives in hooks and ui.',
        },
        {
          regex: '^~/shared/(route|ui)(/|$)',
          message:
            'Models and use-cases are pure TypeScript; route integration lives in *.server.ts.',
        },
        {
          regex: '^~/(routes|messages)(/|$)',
          message: 'Features never depend on routes or the message composition.',
        },
      ),
    },
  },
  {
    files: ['app/routes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='api']",
          message: 'Routes are thin: call a feature use-case instead of the API.',
        },
        { selector: 'TSPropertySignature > Identifier.key[name=/_/]', message: apiShapeMessage },
      ],
      '@typescript-eslint/no-restricted-imports': restrictedImports(
        featureEntry,
        {
          regex: '^react$',
          allowTypeImports: true,
          message: 'Routes are thin: state and effects live in feature hooks.',
        },
        {
          regex: '^~/shared/api/(client|session\\.server)$',
          allowTypeImports: true,
          message: 'Routes reach the API through routeLoader/routeAction and feature use-cases.',
        },
      ),
    },
  },
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-restricted-imports': restrictedImports(featureEntry),
    },
  },
])
