import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { MirrorModeGuard } from './mirror-mode.guard'

describe('MirrorModeGuard', () => {
  const config = { get: jest.fn() } as unknown as ShionConfigService
  const c = config as unknown as { get: jest.Mock }
  const guard = new MirrorModeGuard(config)

  beforeEach(() => jest.clearAllMocks())

  it('lets entry writes through while the local database is still authoritative', () => {
    c.get.mockReturnValue(false)
    expect(guard.canActivate()).toBe(true)
  })

  it('closes entry writes once entries are mirrored from hikarinagi', () => {
    c.get.mockReturnValue(true)
    expect(() => guard.canActivate()).toThrow(ShionBizException)
    try {
      guard.canActivate()
    } catch (error) {
      expect((error as ShionBizException).code).toBe(ShionBizCode.GAME_ENTRY_MIRRORED)
    }
  })
})
