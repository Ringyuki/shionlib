import { withDefault } from './env.util'

describe('withDefault', () => {
  const KEY = '__ENV_UTIL_TEST_KEY__'

  afterEach(() => {
    delete process.env[KEY]
  })

  it('returns default when env is missing or empty', () => {
    delete process.env[KEY]
    expect(withDefault(KEY, 'fallback')).toBe('fallback')

    process.env[KEY] = ''
    expect(withDefault(KEY, 'fallback')).toBe('fallback')
  })

  it('parses number and boolean defaults', () => {
    process.env[KEY] = '42'
    expect(withDefault(KEY, 0)).toBe(42)

    process.env[KEY] = 'not-a-number'
    expect(withDefault(KEY, 7)).toBe(7)

    process.env[KEY] = 'YES'
    expect(withDefault(KEY, false)).toBe(true)

    process.env[KEY] = 'off'
    expect(withDefault(KEY, true)).toBe(false)
  })

  it('parses object defaults via JSON and falls back on parse failure', () => {
    process.env[KEY] = '{"a":1}'
    expect(withDefault(KEY, { a: 0 })).toEqual({ a: 1 })

    process.env[KEY] = '{bad json'
    expect(withDefault(KEY, { a: 0 })).toEqual({ a: 0 })
  })

  it('uses custom parser and catches parser errors', () => {
    process.env[KEY] = '5'
    expect(withDefault(KEY, 0, raw => Number(raw) * 2)).toBe(10)

    expect(
      withDefault(KEY, 'fallback', () => {
        throw new Error('boom')
      }),
    ).toBe('fallback')
  })
})
