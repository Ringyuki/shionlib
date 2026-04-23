import { PrismaService } from '../../../prisma.service'
import { DeveloperScalarSyncFieldEnum } from '../dto/req/edit-developer.req.dto'
import { DeveloperEditService } from './developer-edit.service'
import { DeveloperFieldSyncService } from './developer-field-sync.service'

jest.mock('../../game/utils/language-detector.util', () => ({
  detectLanguage: jest.fn(async (value: string) => (value.includes('中文') ? 'zh' : 'ja')),
}))

describe('DeveloperFieldSyncService', () => {
  const createService = () => {
    const prisma = {
      gameDeveloper: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService
    const bangumiAuthService = {
      bangumiRequest: jest.fn(),
    }
    const vndbService = {
      vndbRequest: jest.fn(),
    }
    const developerEditService = {
      editDeveloperScalar: jest.fn(),
    } as unknown as DeveloperEditService
    const service = new DeveloperFieldSyncService(
      prisma,
      bangumiAuthService as any,
      vndbService as any,
      developerEditService,
    )

    return { service, prisma, bangumiAuthService, vndbService, developerEditService }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds a scalar preview from VNDB producer data', async () => {
    const { service, prisma, vndbService } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: null,
      v_id: 'p1',
      name: 'Local',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      extra_info: [],
      logo: null,
      website: null,
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'p1',
      name: 'Remote',
      original: 'Remote Original',
      aliases: ['Alias'],
      description: 'English intro',
      extlinks: [{ label: 'Official website', url: 'https://example.test' }],
    })

    const { previews } = await service.previewBatch(1, [DeveloperScalarSyncFieldEnum.WEBSITE])
    const preview = previews[0]

    expect(preview.field).toBe('website')
    expect(preview.candidates).toHaveLength(1)
    expect(preview.candidates[0]).toMatchObject({
      action: 'update',
      source: 'vndb',
      remote: { website: 'https://example.test' },
    })
  })

  it('builds batch previews from one external snapshot', async () => {
    const { service, prisma, vndbService } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: null,
      v_id: 'p1',
      name: 'Local',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      extra_info: [],
      logo: null,
      website: null,
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'p1',
      name: 'Remote',
      original: 'Remote Original',
      aliases: [],
      description: '',
      extlinks: [{ label: 'Official website', url: 'https://example.test' }],
    })

    const result = await service.previewBatch(1, [
      DeveloperScalarSyncFieldEnum.NAME,
      DeveloperScalarSyncFieldEnum.WEBSITE,
      DeveloperScalarSyncFieldEnum.NAME,
    ])

    expect(result.failedFields).toEqual([])
    expect(result.previews.map(preview => preview.field)).toEqual(['name', 'website'])
    expect(result.previews.every(preview => preview.summary.total === 1)).toBe(true)
    expect(vndbService.vndbRequest).toHaveBeenCalledTimes(1)
  })

  it('builds all scalar preview fields from a combined Bangumi and VNDB snapshot', async () => {
    const { service, prisma, bangumiAuthService, vndbService } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: '10',
      v_id: '11',
      name: '',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      extra_info: [],
      logo: null,
      website: null,
    })
    bangumiAuthService.bangumiRequest.mockResolvedValue({
      id: 10,
      name: 'Bangumi Dev',
      summary: '中文介绍',
      images: { large: 'https://img.example.test/dev.png' },
      infobox: [
        { key: '别名', value: [{ v: 'Bangumi Alias' }] },
        { key: '成员', value: [{ v: 'A' }, { v: 'B' }] },
        { key: '官网', value: 'https://bangumi.example.test' },
      ],
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'p11',
      name: 'VNDB Dev',
      original: 'VNDB Original',
      aliases: ['VNDB Alias'],
      description: 'English intro',
      extlinks: [{ label: 'Official website', url: 'https://vndb.example.test' }],
    })

    const result = await service.previewBatch(1, Object.values(DeveloperScalarSyncFieldEnum))

    expect(result.failedFields).toEqual([])
    expect(result.previews.map(preview => preview.field)).toEqual(
      Object.values(DeveloperScalarSyncFieldEnum),
    )
    expect(result.previews.every(preview => preview.summary.total === 1)).toBe(true)
    expect(result.previews.find(preview => preview.field === 'name')?.candidates[0]).toMatchObject({
      source: 'merged',
      remote: { name: 'VNDB Original' },
    })
    expect(result.previews.find(preview => preview.field === 'extra')?.candidates[0]).toMatchObject(
      {
        remote: {
          extra_info: [
            { key: '成员', value: 'A, B' },
            { key: '官网', value: 'https://bangumi.example.test' },
          ],
        },
      },
    )
  })

  it('applies selected scalar candidates through the edit service', async () => {
    const { service, prisma, vndbService, developerEditService } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: null,
      v_id: 'p1',
      name: 'Local',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      extra_info: [],
      logo: null,
      website: null,
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'p1',
      name: 'Remote',
      original: 'Remote Original',
      aliases: [],
      description: '',
      extlinks: [{ label: 'Official website', url: 'https://example.test' }],
    })
    const { previews } = await service.previewBatch(1, [DeveloperScalarSyncFieldEnum.WEBSITE])
    const preview = previews[0]
    const req = { user: { sub: 7, role: 2 } }

    await service.apply(
      1,
      DeveloperScalarSyncFieldEnum.WEBSITE,
      [preview.candidates[0].id],
      req as any,
      'sync',
    )

    expect(developerEditService.editDeveloperScalar).toHaveBeenCalledWith(
      1,
      { website: 'https://example.test', note: 'sync' },
      req,
    )
  })

  it('does not apply when no selected candidate matches', async () => {
    const { service, prisma, vndbService, developerEditService } = createService()
    ;(prisma.gameDeveloper.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: null,
      v_id: '1',
      name: 'Local',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      extra_info: [],
      logo: null,
      website: null,
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'p1',
      name: 'Remote',
      extlinks: [{ label: 'Official website', url: 'https://example.test' }],
    })

    await expect(
      service.apply(1, DeveloperScalarSyncFieldEnum.WEBSITE, ['missing'], {
        user: { sub: 7, role: 2 },
      } as any),
    ).resolves.toEqual({ applied: 0 })
    expect(developerEditService.editDeveloperScalar).not.toHaveBeenCalled()
  })
})
