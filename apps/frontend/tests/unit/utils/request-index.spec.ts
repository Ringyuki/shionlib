import { describe, expect, it } from 'vitest'
import * as requestIndex from '../../../utils/request'
import * as requestModule from '../../../utils/request/request'

describe('utils/request/index (unit)', () => {
  it('re-exports request factory from request module', () => {
    expect(requestIndex.shionlibRequest).toBe(requestModule.shionlibRequest)
  })
})
