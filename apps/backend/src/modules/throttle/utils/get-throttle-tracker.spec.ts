import { getThrottleTracker } from './get-throttle-tracker'

describe('getThrottleTracker', () => {
  it('prefers x-real-ip', () => {
    expect(
      getThrottleTracker({
        ip: '127.0.0.1',
        headers: {
          'x-real-ip': '1.1.1.1',
          'cf-connecting-ip': '2.2.2.2',
          'x-forwarded-for': '3.3.3.3, 4.4.4.4',
        },
      }),
    ).toBe('1.1.1.1')
  })

  it('falls back to cf-connecting-ip then x-forwarded-for then req.ip', () => {
    expect(
      getThrottleTracker({
        ip: '127.0.0.1',
        headers: {
          'cf-connecting-ip': '2.2.2.2',
          'x-forwarded-for': '3.3.3.3, 4.4.4.4',
        },
      }),
    ).toBe('2.2.2.2')

    expect(
      getThrottleTracker({
        ip: '127.0.0.1',
        headers: {
          'x-forwarded-for': '3.3.3.3, 4.4.4.4',
        },
      }),
    ).toBe('3.3.3.3')

    expect(
      getThrottleTracker({
        ip: '127.0.0.1',
        headers: {},
      }),
    ).toBe('127.0.0.1')
  })
})
