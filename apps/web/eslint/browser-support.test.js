import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import { browserSupport } from './browser-support.js'

RuleTester.describe = describe
RuleTester.it = it

const floors = { chrome: '111', firefox: '115', safari: '16.4' }
const options = [floors]

new RuleTester().run('browser-support', browserSupport, {
  valid: [
    { code: 'new AbortController().signal.reason', options },
    { code: 'AbortSignal.timeout(10)', options },
    { code: 'structuredClone({})', options },
    { code: 'Array.from([])', options },
    { code: 'const AbortSignal = { any: () => 0 }; AbortSignal.any([])', options },
    { code: 'function f(AbortSignal) { return AbortSignal.any([]) }', options },
  ],
  invalid: [
    {
      code: 'AbortSignal.any([])',
      options,
      errors: [
        {
          message:
            'AbortSignal.any is not available in chrome 111, firefox 115, safari 16.4; the supported browsers are listed in browsers.ts.',
        },
      ],
    },
    {
      code: 'Object.groupBy([], x => x)',
      options,
      errors: [
        {
          messageId: 'missing',
          data: { name: 'Object.groupBy', browsers: 'chrome 111, firefox 115, safari 16.4' },
        },
      ],
    },
    {
      code: 'Promise.withResolvers()',
      options,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: 'new CloseWatcher()',
      options,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: 'navigator.userActivation',
      options: [{ firefox: '115' }],
      errors: [
        {
          messageId: 'missing',
          data: { name: 'navigator.userActivation', browsers: 'firefox 115' },
        },
      ],
    },
  ],
})
