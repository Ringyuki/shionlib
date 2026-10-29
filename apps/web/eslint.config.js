import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import { supportedBrowsers } from './browsers.ts'
import { browserSupport } from './eslint/browser-support.js'
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

const nativeScroll = {
  selector:
    'Literal[value=/(?:^|[\\s:])overflow(?:-[xy])?-(?:auto|scroll)(?:!|\\s|$)/], TemplateElement[value.raw=/(?:^|[\\s:])overflow(?:-[xy])?-(?:auto|scroll)(?:!|\\s|$)/], Property[key.name=/^overflow[XY]?$/][value.value=/^(auto|scroll)$/]',
  message:
    "A region that scrolls is a hina-ui ScrollArea with a height or a max height; overflow-auto and overflow-scroll bring the browser's own scrollbar.",
}

const ghostOnEdge = {
  selector:
    "JSXOpeningElement:has(JSXAttribute[name.name='variant'][value.value='ghost']):has(JSXAttribute[name.name='className'][value.value=/(?:^|\\s)(?:self|place-self|justify-self)-(?:start|end)(?:\\s|$)/])",
  message:
    'A ghost button on an edge shows its padding as a misalignment: use outline for an action that stands alone, a hina-ui Link for a way back, or add flushStart / flushEnd (~/shared/ui/flush) through cn so its content meets the edge.',
}

const rawSticky = {
  selector:
    'Literal[value=/(?:^|[\\s:])sticky(?:!|\\s|$)/], TemplateElement[value.raw=/(?:^|[\\s:])sticky(?:!|\\s|$)/]',
  message:
    'What stays in view while the page scrolls is a hina-ui Affix; a column beside the content is SideColumn (~/shared/ui/side-column).',
}

const shellGeometry = ['app/features/shell/ui/site-shell.tsx']

const featureDetection = ['app/features/auth/webauthn.ts']

const ownWidth = {
  selector:
    'Literal[value=/(?=.*(?:^|[\\s:])mx-auto(?:\\s|$))(?=.*(?:^|[\\s:])max-w-)/], TemplateElement[value.raw=/(?=.*(?:^|[\\s:])mx-auto(?:\\s|$))(?=.*(?:^|[\\s:])max-w-)/]',
  message:
    "A page fills the shell's container. Only the pages listed in ownWidthPages set a width of their own and centre it.",
}

const ownWidthPages = [
  'app/features/resource/ui/upload-page.tsx',
  'app/features/profile/ui/profile-page.tsx',
  'app/features/auth/ui/password-reset-panel.tsx',
  'app/features/sponsor/ui/checkout-frame.tsx',
]

const mountedFeedback = {
  selector:
    ':matches(LogicalExpression, ConditionalExpression) > JSXElement > JSXOpeningElement > JSXIdentifier[name=/^(Alert|Callout|Banner)$/]',
  message:
    'Feedback stays mounted: show and hide an Alert with `open`; a Callout is static content and is never toggled.',
}

const ratedPicture = {
  selector:
    "JSXOpeningElement[name.name='Image'] > JSXAttribute[name.name='src'] MemberExpression[property.name='url'], MemberExpression[property.name='url'][object.callee.name='primaryCover']",
  message:
    "A game's cover or screenshot is shown by GameCover or GamePicture (~/features/game), which keep it masked for a viewer who has adult pictures masked; its address is never given to Image by hand.",
}

const ratedPictureHome = ['app/features/game/ui/game-picture.tsx']

const directFetcher = {
  selector:
    ":not(CallExpression[callee.name=/^use(Command|LazyLoad)$/]) > CallExpression[callee.name='useFetcher']",
  message:
    'A fetcher is used only through useCommand or useLazyLoad (~/shared/route): pass useFetcher<typeof handler>() to one of them. They report a refusal themselves, so no call site decides how a failed request is shown.',
}

const heldPosition = {
  selector:
    "ImportSpecifier[imported.name='keepScrollPosition'], Property[key.name='preventScrollReset'], JSXAttribute[name.name='preventScrollReset']",
  message:
    'A navigation that stays in view goes through useInPageNavigate or InPageLink (~/shared/route): they keep the main area where it is, and only when the page really changes.',
}

const rawAddress = {
  selector:
    "NewExpression[callee.name='URL'] > MemberExpression[property.name='url']:matches([object.name='request'], [object.property.name='request'])",
  message:
    'A loader or action reads its address from args.url: request.url is the raw request, which carries the .data suffix and the _routes parameter when the browser asks for data.',
}

const pagedListStart = {
  selector:
    "JSXOpeningElement[name.name='DataList']:has(JSXAttribute[name.name='pagination']):not(:has(JSXAttribute[name.name='id'][value.expression.name='listStart']))",
  message:
    'A list with pages carries id={listStart} (~/shared/http/paging) and a scroll margin: turning a page through usePageTurn (~/shared/route/use-page-turn) lands at that element.',
}

const inPageTools = [
  'app/shared/route/use-in-page-navigate.ts',
  'app/shared/route/in-page-link.tsx',
]

const appSyntax = [
  ...apiShapes,
  nativeTags,
  nativeTooltip,
  mountedFeedback,
  hinaInternals,
  nativeScroll,
  ghostOnEdge,
  ownWidth,
  rawSticky,
  ratedPicture,
  directFetcher,
  rawAddress,
  pagedListStart,
]

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
    'Only uploads call the API from the browser, for their progress (features/upload); everything else goes through loaders and actions.',
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

const editorEngine = {
  regex: '^@tiptap/',
  message: 'Tiptap stays inside ~/shared/editor; everything else uses its hooks and tools.',
}

const engineTypes = {
  regex: '^@tiptap/',
  allowTypeImports: true,
  message:
    'Only the engine (app/shared/editor/engine) loads Tiptap at run time; the rest of ~/shared/editor imports its types.',
}

const engineModules = {
  regex: '^\\.{1,2}/engine(/|$)',
  allowTypeImports: true,
  message:
    'The engine is loaded on demand with import("./engine"), so pages that only read never download it.',
}

const engineFiles = ['app/shared/editor/engine/**/*.{ts,tsx}', 'app/shared/editor/**/*.test.ts']

const editorFree = {
  regex: '^~/shared/editor(/|$)',
  message:
    'Reading rich text never loads the editor: ~/shared/richtext and RichText stay free of ~/shared/editor.',
}

const sharedOnly = {
  regex: '^~/(features|routes|messages)(/|$)',
  message: 'shared is the platform layer; it never depends on features, routes or messages.',
}

const restrictedImports = (...patterns) => importRules([...patterns, browserCalls, editorEngine])

const uploadImports = (...patterns) => importRules([...patterns, editorEngine])

const editorImports = (...patterns) => importRules([...patterns, browserCalls])

const richTextView = ['app/shared/ui/rich-text*.tsx']

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
    plugins: {
      shionlib: { rules: { 'no-comments': noComments, 'browser-support': browserSupport } },
    },
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
      'no-restricted-syntax': ['error', ...appSyntax, heldPosition],
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-restricted-imports': restrictedImports(featureEntry),
    },
  },
  {
    files: inPageTools,
    rules: {
      'no-restricted-syntax': ['error', ...appSyntax],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    ignores: ['**/*.server.ts', '**/*.test.{ts,tsx}', '**/*testing.ts', ...featureDetection],
    rules: {
      'shionlib/browser-support': ['error', supportedBrowsers],
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
        nativeScroll,
        ghostOnEdge,
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
      '@typescript-eslint/no-restricted-imports': restrictedImports(sharedOnly, clientSafe),
    },
  },
  {
    files: ['app/shared/**/*.server.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(sharedOnly),
    },
  },
  {
    files: ['app/shared/richtext/**/*.ts', ...richTextView],
    rules: {
      '@typescript-eslint/no-restricted-imports': restrictedImports(
        sharedOnly,
        clientSafe,
        editorFree,
      ),
    },
  },
  {
    files: richTextView,
    rules: {
      'no-restricted-syntax': [
        'error',
        ...apiShapes,
        nativeTooltip,
        mountedFeedback,
        hinaInternals,
        nativeScroll,
        ghostOnEdge,
        directFetcher,
        heldPosition,
      ],
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
        {
          selector:
            "ExportNamedDeclaration > FunctionDeclaration[id.name='meta'] ReturnStatement > :not(CallExpression[callee.name='pageMeta'])",
          message:
            "A page's head comes from pageMeta(args, head) (~/shared/seo); meta returns its result and nothing else.",
        },
        ...apiShapes,
        nativeTags,
        mountedFeedback,
        nativeScroll,
        ghostOnEdge,
        heldPosition,
        rawAddress,
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
    files: ['app/shared/editor/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': editorImports(
        sharedOnly,
        clientSafe,
        engineTypes,
        engineModules,
      ),
    },
  },
  {
    files: engineFiles,
    rules: {
      '@typescript-eslint/no-restricted-imports': editorImports(sharedOnly, clientSafe),
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
  {
    files: ownWidthPages,
    rules: {
      'no-restricted-syntax': ['error', ...appSyntax.filter(rule => rule !== ownWidth)],
    },
  },
  {
    files: shellGeometry,
    rules: {
      'no-restricted-syntax': ['error', ...appSyntax.filter(rule => rule !== rawSticky)],
    },
  },
  {
    files: ratedPictureHome,
    rules: {
      'no-restricted-syntax': ['error', ...appSyntax.filter(rule => rule !== ratedPicture)],
    },
  },
])
