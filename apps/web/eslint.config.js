import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import { noComments } from './eslint/no-comments.js'

const apiShapeMessage =
  'API shapes come from ~/shared/api (Schema, ApiData, ApiBody, ApiQuery); never redeclare them.'

const apiShapes = [
  { selector: 'TSPropertySignature > Identifier.key[name=/_/]', message: apiShapeMessage },
  { selector: 'TSPropertySignature > Literal.key[value=/_/]', message: apiShapeMessage },
  {
    selector:
      ':matches(TSTypeAliasDeclaration, TSInterfaceDeclaration) > Identifier.id[name=/(DTO|Dto|Response|Request|Payload|Body)$/]',
    message: apiShapeMessage,
  },
]

const nativeTagMessage =
  'Zero native tags: compose @hina-ui/react components (pass `as` for semantic elements) or router components.'

const nativeTags = {
  selector: 'JSXOpeningElement > JSXIdentifier[name=/^[a-z]/]',
  message: nativeTagMessage,
}

const documentShellTags = {
  selector:
    'JSXOpeningElement > JSXIdentifier[name=/^(?!(html|head|body|meta|title|link|script)$)[a-z]/]',
  message: nativeTagMessage,
}

const titledComponents = [
  'Alert',
  'AlertDialog',
  'Callout',
  'DataListItem',
  'Dialog',
  'Drawer',
  'Empty',
  'PageHeader',
  'Panel',
  'Popconfirm',
  'Result',
  'Section',
  'Sheet',
]

const nativeTooltip = {
  selector: `JSXOpeningElement:not([name.name=/^(${titledComponents.join('|')})$/]) > JSXAttribute[name.name='title']`,
  message:
    'No native title tooltips: wrap the trigger in a hina-ui Tooltip, or show the text in full.',
}

const nativeDialogs = ['alert', 'confirm', 'prompt'].map(name => ({
  name,
  message: 'No native browser dialogs: use hina-ui AlertDialog, Dialog or toast.',
}))

const hinaInternals = {
  selector: 'Literal[value=/\\[&[^\\]]*\\.hn-/], TemplateElement[value.raw=/\\[&[^\\]]*\\.hn-/]',
  message:
    'Do not restyle hina-ui\'s internal markup ([&>.hn-*]); use a documented pattern instead, such as Card as="button" for a custom clickable surface.',
}

const mountedFeedback = {
  selector:
    ':matches(LogicalExpression, ConditionalExpression) > JSXElement > JSXOpeningElement > JSXIdentifier[name=/^(Alert|Callout|Banner)$/]',
  message:
    'Feedback stays mounted: show and hide an Alert with `open`; a Callout is static content and is never toggled.',
}

const directFetcher = {
  selector:
    ":not(CallExpression[callee.name=/^use(Command|LazyLoad)$/]) > CallExpression[callee.name='useFetcher']",
  message:
    'A fetcher is used only through useCommand or useLazyLoad (~/shared/route): pass useFetcher<typeof handler>() to one of them. They report a refusal themselves, so no call site decides how a failed request is shown.',
}

const otherValidators = ['zod', 'yup', 'joi', 'ajv', 'superstruct', 'io-ts', 'arktype'].map(
  name => ({
    name,
    message: 'Validation uses valibot schemas (references/forms.md).',
  }),
)

const schemaHomes = ['app/**/*.schema.ts', 'app/shared/form/**', 'app/shared/route/**']

const featureEntry = {
  regex: '^~/features/[^/]+/(?![^/]+\\.server$).+',
  message: 'Import a feature through its public entry (~/features/<name>).',
}

const clientSafe = {
  regex: '\\.server$',
  allowTypeImports: true,
  message: 'Server modules are imported only by routes, root and other *.server.ts modules.',
}

const browserCalls = {
  regex: '^~/shared/api/(browser-client|chunk|xhr)$',
  message:
    'Only the upload manager (features/upload) calls the API from the browser; everything else goes through loaders and actions.',
}

const importRules = patterns => [
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

const restrictedImports = (...patterns) => importRules([...patterns, browserCalls])

const uploadImports = (...patterns) => importRules(patterns)

const withoutRoutes = {
  regex: '^~/(routes|messages)(/|$)',
  message: 'Features never depend on routes or the message composition.',
}

const pureLibraries = {
  regex: '^(react|react-dom|react-router|use-intl|@hina-ui/react)$',
  message: 'Models and use-cases are pure TypeScript; React integration lives in hooks and ui.',
}

const pureShared = {
  regex: '^~/shared/(route|ui)(/|$)',
  message: 'Models and use-cases are pure TypeScript; route integration lives in *.server.ts.',
}

const pureFiles = ['app/features/*/*.ts']

const pureIgnores = [
  'app/features/*/use-*.ts',
  'app/features/*/*.server.ts',
  'app/features/*/index.ts',
]

export default defineConfig([
  globalIgnores([
    'build',
    '.react-router',
    'app/shared/api/generated',
    'test-results',
    'playwright-report',
  ]),
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
    files: ['app/**/*.ts', 'scripts/**/*.ts'],
    ignores: ['**/*.test.ts', 'app/shared/api/generated/**'],
    rules: {
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['app/**/*.tsx'],
    rules: {
      'max-lines': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['**/*.test.ts', 'e2e/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Call the API through ~/shared/api; third-party browser services live in ~/shared/vendor.',
        },
        {
          name: 'XMLHttpRequest',
          message: 'Requests go through ~/shared/api; the XHR adapter is ~/shared/api/xhr.',
        },
        ...nativeDialogs,
      ],
      'no-restricted-properties': [
        'error',
        ...nativeDialogs.map(dialog => ({
          object: 'window',
          property: dialog.name,
          message: dialog.message,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        ...apiShapes,
        nativeTags,
        nativeTooltip,
        mountedFeedback,
        hinaInternals,
        directFetcher,
      ],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-restricted-imports': restrictedImports(featureEntry),
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    ignores: schemaHomes,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'valibot',
              message:
                'Schemas live in <module>.schema.ts; ~/shared/form and ~/shared/route hold the helpers.',
            },
            ...otherValidators,
          ],
        },
      ],
    },
  },
  {
    files: schemaHomes,
    rules: {
      'no-restricted-imports': ['error', { paths: otherValidators }],
    },
  },
  {
    files: ['app/root.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...apiShapes,
        documentShellTags,
        nativeTooltip,
        mountedFeedback,
        hinaInternals,
      ],
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
    files: ['app/shared/vendor/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    files: ['app/features/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(
        featureEntry,
        clientSafe,
        withoutRoutes,
      ),
    },
  },
  {
    files: ['app/features/**/*.server.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(featureEntry, withoutRoutes),
    },
  },
  {
    files: pureFiles,
    ignores: pureIgnores,
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(
        featureEntry,
        clientSafe,
        pureLibraries,
        pureShared,
        withoutRoutes,
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
        ...apiShapes,
        nativeTags,
        mountedFeedback,
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
  {
    files: ['app/features/upload/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': uploadImports(
        featureEntry,
        clientSafe,
        withoutRoutes,
      ),
    },
  },
  {
    files: ['app/features/upload/*.ts'],
    ignores: [...pureIgnores, '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': uploadImports(
        featureEntry,
        clientSafe,
        pureLibraries,
        pureShared,
        withoutRoutes,
      ),
    },
  },
])
