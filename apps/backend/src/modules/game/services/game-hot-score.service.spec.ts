import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { GameHotScoreService } from './game-hot-score.service'

describe('GameHotScoreService', () => {
  it('builds SQL from config and executes refresh', async () => {
    const prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(7),
    } as unknown as PrismaService

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, number> = {
          'game.hot_score.half_life_release_days': 30,
          'game.hot_score.half_life_created_days': 90,
          'game.hot_score.weight_views': 1.5,
          'game.hot_score.weight_downloads': 2,
          'game.hot_score.weight_release': 3,
          'game.hot_score.weight_created': 4,
          'game.hot_score.recent_window_days': 14,
          'game.hot_score.weight_recent_views': 5,
          'game.hot_score.weight_recent_downloads': 6,
        }
        return values[key]
      }),
    } as unknown as ShionConfigService

    const service = new GameHotScoreService(prisma, config)
    ;(service as any).logger = { log: jest.fn() }

    await service.refreshScore()

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1)
    const sql = (prisma.$executeRawUnsafe as jest.Mock).mock.calls[0][0] as string
    expect(sql).toContain('UPDATE "games" AS g')
    expect(sql).toContain('1.5')
    expect(sql).toContain('2')
    expect(sql).toContain('EXP(- b.release_age_days / 30)')
    expect(sql).toContain('EXP(- b.age_days / 90)')

    expect((service as any).logger.log).toHaveBeenCalledWith(expect.stringContaining('affected=7'))
  })
})
