jest.mock('fs', () => ({
  __esModule: true,
  readFileSync: jest.fn(),
}))

import * as fs from 'fs'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { SitemapType } from '../enums/sitemap/sitemap-type.enum'
import { SitemapService } from './sitemap.service'

describe('SitemapService', () => {
  const makeRequest = (
    headers: Record<string, string | undefined>,
    protocol = 'http',
  ): {
    protocol: string
    get: (key: string) => string | undefined
  } => ({
    protocol,
    get: (key: string) => headers[key.toLowerCase()],
  })

  const createService = () => {
    const prisma = {
      game: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      gameDeveloper: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      gameCharacter: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as unknown as PrismaService

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'siteUrl') return 'https://fallback.example'
        return undefined
      }),
    } as unknown as ShionConfigService

    return { service: new SitemapService(prisma, config), prisma }
  }

  it('getBaseInfos builds absolute urls from forwarded host/proto for game', async () => {
    const { service, prisma } = createService()
    ;(prisma.game.findMany as jest.Mock).mockResolvedValue([
      {
        id: 1,
        created: new Date('2026-01-01T00:00:00.000Z'),
        updated: new Date('2026-01-02T00:00:00.000Z'),
      },
    ])

    const request = makeRequest({
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'api.example.com',
    })
    const items = await service.getBaseInfos(request as any, SitemapType.GAME, {
      page: 2,
      pageSize: 10,
    } as any)

    expect(prisma.game.findMany).toHaveBeenCalledWith({
      where: { status: 1, nsfw: false },
      skip: 10,
      take: 10,
      select: { id: true, created: true, updated: true },
    })
    expect(items).toEqual([
      {
        url: 'https://api.example.com/game/1',
        lastmod: '2026-01-02T00:00:00.000Z',
      },
    ])
  })

  it('getBaseInfos returns developer and character urls by section type', async () => {
    const { service, prisma } = createService()
    ;(prisma.gameDeveloper.findMany as jest.Mock).mockResolvedValue([
      {
        id: 7,
        created: new Date('2026-01-01T00:00:00.000Z'),
        updated: new Date('2026-01-05T00:00:00.000Z'),
      },
    ])
    ;(prisma.gameCharacter.findMany as jest.Mock).mockResolvedValue([
      {
        id: 8,
        created: new Date('2026-01-01T00:00:00.000Z'),
        updated: new Date('2026-01-06T00:00:00.000Z'),
      },
    ])
    const request = makeRequest({
      'x-forwarded-proto': 'https, http',
      'x-forwarded-host': 'edge.example.com, internal.example.com',
    })

    const developers = await service.getBaseInfos(request as any, SitemapType.DEVELOPER, {
      page: 1,
      pageSize: 5,
    } as any)
    const characters = await service.getBaseInfos(request as any, SitemapType.CHARACTER, {
      page: 2,
      pageSize: 3,
    } as any)

    expect(prisma.gameDeveloper.findMany).toHaveBeenCalledWith({
      skip: 0,
      take: 5,
      select: { id: true, created: true, updated: true },
    })
    expect(prisma.gameCharacter.findMany).toHaveBeenCalledWith({
      skip: 3,
      take: 3,
      select: { id: true, created: true, updated: true },
    })
    expect(developers).toEqual([
      {
        url: 'https://edge.example.com/developer/7',
        lastmod: '2026-01-05T00:00:00.000Z',
      },
    ])
    expect(characters).toEqual([
      {
        url: 'https://edge.example.com/character/8',
        lastmod: '2026-01-06T00:00:00.000Z',
      },
    ])
  })

  it('generateIndex emits section sitemap entries by count and page size', async () => {
    const { service, prisma } = createService()
    ;(prisma.game.count as jest.Mock).mockResolvedValue(2)
    ;(prisma.gameDeveloper.count as jest.Mock).mockResolvedValue(50_001)
    ;(prisma.gameCharacter.count as jest.Mock).mockResolvedValue(0)

    const request = makeRequest({ host: 'example.com' })
    const xml = await service.generateIndex(request as any)

    expect(xml).toContain('<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>')
    expect(xml).toContain('http://example.com/sitemap-game-1.xml')
    expect(xml).toContain('http://example.com/sitemap-developer-1.xml')
    expect(xml).toContain('http://example.com/sitemap-developer-2.xml')
    expect(xml).not.toContain('sitemap-character-1.xml')
  })

  it('generateSectionSitemap emits localized alternate links', async () => {
    const { service, prisma } = createService()
    ;(prisma.game.findMany as jest.Mock).mockResolvedValue([
      {
        id: 9,
        created: new Date('2026-01-01T00:00:00.000Z'),
        updated: new Date('2026-01-03T00:00:00.000Z'),
      },
    ])
    const request = makeRequest({ host: 'example.com' })

    const xml = await service.generateSectionSitemap(request as any, SitemapType.GAME, {
      page: 1,
      pageSize: 1,
    } as any)

    expect(xml).toContain('<loc>http://example.com/zh/game/9</loc>')
    expect(xml).toContain('hreflang="ja" href="http://example.com/ja/game/9"')
    expect(xml).toContain('hreflang="en" href="http://example.com/en/game/9"')
    expect(xml).toContain('hreflang="x-default" href="http://example.com/zh/game/9"')
    expect(xml).toContain('<changefreq>weekly</changefreq>')
    expect(xml).toContain('<priority>1.0</priority>')
  })

  it('buildUrl falls back to original when url is not under current site base', () => {
    const { service } = createService()
    const request = makeRequest({}, 'https')
    const url = (service as any).buildUrl(request, 'https://third-party.example/game/9', 'ja')

    expect(url).toBe('https://third-party.example/game/9')
  })

  it('getStylesheet caches in production and bypasses cache in development', () => {
    const { service } = createService()
    const readFileMock = fs.readFileSync as unknown as jest.Mock
    readFileMock.mockReturnValue('<xsl/>')
    readFileMock.mockClear()
    const previous = process.env.NODE_ENV

    process.env.NODE_ENV = 'production'
    ;(service as any).stylesheetCache = 'cached-xsl'
    expect(service.getStylesheet()).toBe('cached-xsl')
    expect(readFileMock).not.toHaveBeenCalled()

    readFileMock.mockClear()
    process.env.NODE_ENV = 'development'
    expect(service.getStylesheet()).toBe('<xsl/>')
    expect(service.getStylesheet()).toBe('<xsl/>')
    expect(readFileMock).toHaveBeenCalledTimes(2)

    process.env.NODE_ENV = previous
  })
})
