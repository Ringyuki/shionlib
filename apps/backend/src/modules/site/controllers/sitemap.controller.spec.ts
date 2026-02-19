import { SitemapType } from '../enums/sitemap/sitemap-type.enum'
import { SitemapController } from './sitemap.controller'

describe('SitemapController', () => {
  const createController = () => {
    const sitemapService = {
      generateIndex: jest.fn(),
      getStylesheet: jest.fn(),
      generateSectionSitemap: jest.fn(),
    }
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    }

    return {
      sitemapService,
      cacheService,
      controller: new SitemapController(sitemapService as any, cacheService as any),
    }
  }

  const createRes = () => {
    const res = {
      type: jest.fn(),
      send: jest.fn(),
    }
    ;(res.type as jest.Mock).mockReturnValue(res)
    ;(res.send as jest.Mock).mockReturnValue(res)
    return res
  }

  it('getSitemapIndex returns cached xml when available', async () => {
    const { controller, cacheService, sitemapService } = createController()
    const req = {
      get: (key: string) => {
        if (key === 'x-forwarded-host') return 'a.example.com, proxy'
        return undefined
      },
    }
    const res = createRes()
    cacheService.get.mockResolvedValue('<cached-index/>')

    await controller.getSitemapIndex(req as any, res as any)

    expect(cacheService.get).toHaveBeenCalledWith('sitemap:index:a.example.com')
    expect(sitemapService.generateIndex).not.toHaveBeenCalled()
    expect(res.type).toHaveBeenCalledWith('application/xml; charset=utf-8')
    expect(res.send).toHaveBeenCalledWith('<cached-index/>')
  })

  it('getSitemapIndex generates and caches xml on miss', async () => {
    const { controller, cacheService, sitemapService } = createController()
    const req = { get: (key: string) => (key === 'host' ? 'b.example.com' : undefined) }
    const res = createRes()
    cacheService.get.mockResolvedValue(undefined)
    sitemapService.generateIndex.mockResolvedValue('<index/>')

    await controller.getSitemapIndex(req as any, res as any)

    expect(sitemapService.generateIndex).toHaveBeenCalledWith(req)
    expect(cacheService.set).toHaveBeenCalledWith(
      'sitemap:index:b.example.com',
      '<index/>',
      3600000,
    )
    expect(res.send).toHaveBeenCalledWith('<index/>')
  })

  it('getSitemapStylesheet sends xsl', async () => {
    const { controller, sitemapService } = createController()
    const res = createRes()
    sitemapService.getStylesheet.mockReturnValue('<xsl/>')

    await controller.getSitemapStylesheet(res as any)

    expect(res.type).toHaveBeenCalledWith('text/xsl; charset=utf-8')
    expect(res.send).toHaveBeenCalledWith('<xsl/>')
  })

  it('getSectionSitemap returns empty urlset for invalid type', async () => {
    const { controller, sitemapService, cacheService } = createController()
    const req = { get: () => 'example.com' }
    const res = createRes()

    await controller.getSectionSitemap('unknown' as any, 1, req as any, res as any)

    expect(sitemapService.generateSectionSitemap).not.toHaveBeenCalled()
    expect(cacheService.get).not.toHaveBeenCalled()
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<urlset'))
  })

  it('getSectionSitemap returns cached xml when exists', async () => {
    const { controller, cacheService, sitemapService } = createController()
    const req = { get: (key: string) => (key === 'host' ? 'c.example.com' : undefined) }
    const res = createRes()
    cacheService.get.mockResolvedValue('<section-cached/>')

    await controller.getSectionSitemap(SitemapType.GAME, 2, req as any, res as any)

    expect(cacheService.get).toHaveBeenCalledWith('sitemap:game:2:c.example.com')
    expect(sitemapService.generateSectionSitemap).not.toHaveBeenCalled()
    expect(res.send).toHaveBeenCalledWith('<section-cached/>')
  })

  it('getSectionSitemap generates and caches xml on miss', async () => {
    const { controller, cacheService, sitemapService } = createController()
    const req = { get: (key: string) => (key === 'host' ? 'd.example.com' : undefined) }
    const res = createRes()
    cacheService.get.mockResolvedValue(undefined)
    sitemapService.generateSectionSitemap.mockResolvedValue('<section/>')

    await controller.getSectionSitemap(SitemapType.DEVELOPER, 3, req as any, res as any)

    expect(sitemapService.generateSectionSitemap).toHaveBeenCalledWith(req, SitemapType.DEVELOPER, {
      page: 3,
      pageSize: 50000,
    })
    expect(cacheService.set).toHaveBeenCalledWith(
      'sitemap:developer:3:d.example.com',
      '<section/>',
      3600000,
    )
    expect(res.send).toHaveBeenCalledWith('<section/>')
  })
})
