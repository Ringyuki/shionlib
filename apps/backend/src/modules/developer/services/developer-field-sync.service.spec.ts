import { PrismaService } from '../../../prisma.service'
import { DeveloperScalarSyncFieldEnum } from '../dto/req/edit-developer.req.dto'
import { DeveloperEditService } from './developer-edit.service'
import { DeveloperFieldSyncService } from './developer-field-sync.service'

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
})
