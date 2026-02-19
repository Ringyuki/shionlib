import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import {
  calcPrefix,
  formatRefreshToken,
  generateOpaque,
  hashOpaque,
  parseRefreshToken,
  verifyOpaque,
} from './refresh-token.util'

describe('refresh-token util', () => {
  const version = 'slrt1'

  it('formats and parses refresh token', () => {
    const opaque = generateOpaque()
    const prefix = calcPrefix(opaque)
    const token = formatRefreshToken(prefix, opaque, version)

    const parsed = parseRefreshToken(token, version)

    expect(parsed.version).toBe(version)
    expect(parsed.prefix).toBe(prefix)
    expect(parsed.opaque).toBe(opaque)
  })

  it('throws on invalid version', () => {
    expect(() => parseRefreshToken('v2.abc.def', version)).toThrow(ShionBizException)
  })

  it('hashes and verifies opaque token', async () => {
    const pepper = 'test-pepper'
    const opaque = generateOpaque()
    const hash = await hashOpaque(opaque, pepper)

    await expect(verifyOpaque(hash, opaque, pepper)).resolves.toBe(true)
    await expect(verifyOpaque(hash, `${opaque}-bad`, pepper)).resolves.toBe(false)
  })
})
