import { describe, expect, it } from 'vitest'
import { capFailureOf } from './cap'
import { capProblemFrom } from './cap.schema'

const failureOf = (code: string, message = '') => capFailureOf({ code, message })

describe('capFailureOf', () => {
  it('takes what never reached Cap or its solver for an unavailable service', () => {
    for (const code of ['missing_endpoint', 'network_error', 'redeem_failed', 'wasm_load_failed']) {
      expect(failureOf(code)).toBe('unavailable')
    }
    expect(failureOf('solve_failed', "Cannot read properties of undefined (reading 'c')")).toBe(
      'unavailable',
    )
  })

  it('tells a blocked browser from a challenge that failed', () => {
    expect(failureOf('instr_blocked')).toBe('blocked')
    expect(failureOf('instr_timeout')).toBe('failed')
    expect(failureOf('invalid_solution', 'Invalid solution')).toBe('failed')
    expect(failureOf('invalid_solution', 'Instrumentation timeout')).toBe('failed')
    expect(failureOf('something new')).toBe('failed')
  })

  it('knows a browser that Cap itself turned away when the solution came in', () => {
    expect(failureOf('invalid_solution', 'Blocked by instrumentation')).toBe('blocked')
  })
})

describe('capProblemFrom', () => {
  it('keeps the code and message Cap reported', () => {
    expect(capProblemFrom({ code: 'network_error', message: 'Rate limited', isCap: true })).toEqual(
      {
        code: 'network_error',
        message: 'Rate limited',
      },
    )
  })

  it('still names a problem that carries nothing', () => {
    expect(capProblemFrom(new Error('boom'))).toEqual({ code: 'unknown', message: 'boom' })
    expect(capProblemFrom(undefined)).toEqual({ code: 'unknown', message: '' })
  })
})
