import { PrismaService } from '../../../prisma.service'
import { CharacterScalarSyncFieldEnum } from '../dto/req/edit-character.req.dto'
import { CharacterEditService } from './character-edit.service'
import { CharacterFieldSyncService } from './character-field-sync.service'

jest.mock('../../game/utils/language-detector.util', () => ({
  detectLanguage: jest.fn(async (value: string) => (value.includes('中文') ? 'zh' : 'ja')),
}))

describe('CharacterFieldSyncService', () => {
  const createService = () => {
    const prisma = {
      gameCharacter: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService
    const bangumiAuthService = {
      bangumiRequest: jest.fn(),
    }
    const vndbService = {
      vndbRequest: jest.fn(),
    }
    const characterEditService = {
      editCharacterScalar: jest.fn(),
    } as unknown as CharacterEditService
    const service = new CharacterFieldSyncService(
      prisma,
      bangumiAuthService as any,
      vndbService as any,
      characterEditService,
    )

    return { service, prisma, bangumiAuthService, vndbService, characterEditService }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds a scalar preview from VNDB character data', async () => {
    const { service, prisma, vndbService } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: null,
      v_id: 'c1',
      name_jp: 'Local',
      name_zh: '',
      name_en: '',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      image: null,
      blood_type: null,
      height: null,
      weight: null,
      bust: null,
      waist: null,
      hips: null,
      cup: null,
      age: null,
      birthday: [],
      gender: [],
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'c1',
      name: 'Remote EN',
      aliases: ['Alias'],
      description: 'English intro',
      blood_type: 'a',
      height: 160,
      birthday: [1, 2],
      gender: ['f'],
      image: { url: 'https://img.example.test/c1.png' },
    })

    const { previews } = await service.previewBatch(1, [CharacterScalarSyncFieldEnum.BODY_METRICS])
    const preview = previews[0]

    expect(preview.field).toBe('body_metrics')
    expect(preview.candidates).toHaveLength(1)
    expect(preview.candidates[0]).toMatchObject({
      action: 'update',
      source: 'vndb',
      remote: { height: 160 },
    })
  })

  it('builds batch previews from one external snapshot', async () => {
    const { service, prisma, vndbService } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: null,
      v_id: 'c1',
      name_jp: 'Local',
      name_zh: '',
      name_en: '',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      image: null,
      blood_type: null,
      height: null,
      weight: null,
      bust: null,
      waist: null,
      hips: null,
      cup: null,
      age: null,
      birthday: [],
      gender: [],
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'c1',
      name: 'Remote EN',
      aliases: [],
      description: '',
      blood_type: 'a',
      height: 160,
      gender: [],
    })

    const result = await service.previewBatch(1, [
      CharacterScalarSyncFieldEnum.BODY_METRICS,
      CharacterScalarSyncFieldEnum.BLOOD_TYPE,
      CharacterScalarSyncFieldEnum.BODY_METRICS,
    ])

    expect(result.failedFields).toEqual([])
    expect(result.previews.map(preview => preview.field)).toEqual(['body_metrics', 'blood_type'])
    expect(result.previews.every(preview => preview.summary.total === 1)).toBe(true)
    expect(vndbService.vndbRequest).toHaveBeenCalledTimes(1)
  })

  it('builds all scalar preview fields from a combined Bangumi and VNDB snapshot', async () => {
    const { service, prisma, bangumiAuthService, vndbService } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: '10',
      v_id: '11',
      name_jp: '',
      name_zh: '',
      name_en: '',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      image: null,
      blood_type: null,
      height: null,
      weight: null,
      bust: null,
      waist: null,
      hips: null,
      cup: null,
      age: null,
      birthday: [],
      gender: [],
    })
    bangumiAuthService.bangumiRequest.mockResolvedValue({
      id: 10,
      name: 'Bangumi JP',
      summary: '中文介绍',
      images: { large: 'https://img.example.test/character-bangumi.png' },
      infobox: [
        { key: '简体中文名', value: '中文名' },
        { key: '别名', value: [{ v: 'Bangumi Alias' }] },
      ],
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'c11',
      name: 'VNDB EN',
      original: '日本語名',
      aliases: ['VNDB Alias'],
      description: 'English intro',
      blood_type: 'ab',
      height: 160,
      weight: 50,
      bust: 80,
      waist: 55,
      hips: 82,
      cup: 'C',
      age: 18,
      birthday: [1, 2],
      gender: ['f', null],
      image: { url: 'https://img.example.test/character-vndb.png' },
    })

    const result = await service.previewBatch(1, Object.values(CharacterScalarSyncFieldEnum))

    expect(result.failedFields).toEqual([])
    expect(result.previews.map(preview => preview.field)).toEqual(
      Object.values(CharacterScalarSyncFieldEnum),
    )
    expect(result.previews.every(preview => preview.summary.total === 1)).toBe(true)
    expect(result.previews.find(preview => preview.field === 'names')?.candidates[0]).toMatchObject(
      {
        source: 'merged',
        remote: { name_jp: '日本語名', name_zh: '中文名', name_en: 'VNDB EN' },
      },
    )
    expect(
      result.previews.find(preview => preview.field === 'gender')?.candidates[0],
    ).toMatchObject({
      remote: { gender: ['f'] },
    })
  })

  it('applies selected scalar candidates through the edit service', async () => {
    const { service, prisma, vndbService, characterEditService } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: null,
      v_id: 'c1',
      name_jp: 'Local',
      name_zh: '',
      name_en: '',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      image: null,
      blood_type: null,
      height: null,
      weight: null,
      bust: null,
      waist: null,
      hips: null,
      cup: null,
      age: null,
      birthday: [],
      gender: [],
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'c1',
      name: 'Remote EN',
      aliases: [],
      description: '',
      blood_type: 'ab',
      gender: [],
    })
    const { previews } = await service.previewBatch(1, [CharacterScalarSyncFieldEnum.BLOOD_TYPE])
    const preview = previews[0]
    const req = { user: { sub: 7, role: 2 } }

    await service.apply(
      1,
      CharacterScalarSyncFieldEnum.BLOOD_TYPE,
      [preview.candidates[0].id],
      req as any,
      'sync',
    )

    expect(characterEditService.editCharacterScalar).toHaveBeenCalledWith(
      1,
      { blood_type: 'ab', note: 'sync' },
      req,
    )
  })

  it('does not apply when no selected candidate matches', async () => {
    const { service, prisma, vndbService, characterEditService } = createService()
    ;(prisma.gameCharacter.findUnique as jest.Mock).mockResolvedValue({
      id: 1,
      b_id: null,
      v_id: '1',
      name_jp: 'Local',
      name_zh: '',
      name_en: '',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      image: null,
      blood_type: null,
      height: null,
      weight: null,
      bust: null,
      waist: null,
      hips: null,
      cup: null,
      age: null,
      birthday: [],
      gender: [],
    })
    vndbService.vndbRequest.mockResolvedValue({
      id: 'c1',
      name: 'Remote EN',
      blood_type: 'ab',
    })

    await expect(
      service.apply(1, CharacterScalarSyncFieldEnum.BLOOD_TYPE, ['missing'], {
        user: { sub: 7, role: 2 },
      } as any),
    ).resolves.toEqual({ applied: 0 })
    expect(characterEditService.editCharacterScalar).not.toHaveBeenCalled()
  })
})
