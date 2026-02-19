import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { SitemapController } from '../../src/modules/site/controllers/sitemap.controller'
import { SitemapService } from '../../src/modules/site/services/sitemap.service'
import { CacheService } from '../../src/modules/cache/services/cache.service'
import { SitemapType } from '../../src/modules/site/enums/sitemap/sitemap-type.enum'

describe('Sitemap (integration)', () => {
  let app: INestApplication
  const sitemapService = {
    generateIndex: jest.fn(),
    getStylesheet: jest.fn(),
    generateSectionSitemap: jest.fn(),
  }
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SitemapController],
      providers: [
        { provide: SitemapService, useValue: sitemapService },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(requestId())
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('GET /sitemap.xml returns cached index xml', async () => {
    cacheService.get.mockResolvedValueOnce('<cached-index/>')

    const res = await request(app.getHttpServer())
      .get('/sitemap.xml')
      .set('host', 'a.example.com')
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(res.headers['content-type']).toContain('application/xml; charset=utf-8')
    expect(res.headers['cache-control']).toContain('public, max-age=3600')
    expect(res.text).toBe('<cached-index/>')
    expect(cacheService.get).toHaveBeenCalledWith('sitemap:index:a.example.com')
    expect(sitemapService.generateIndex).not.toHaveBeenCalled()
  })

  it('GET /sitemap.xml generates and caches xml on miss', async () => {
    cacheService.get.mockResolvedValueOnce(undefined)
    sitemapService.generateIndex.mockResolvedValueOnce('<index/>')

    const res = await request(app.getHttpServer())
      .get('/sitemap.xml')
      .set('x-forwarded-host', 'b.example.com, proxy.internal')
      .expect(200)

    expect(res.text).toBe('<index/>')
    expect(sitemapService.generateIndex).toHaveBeenCalledTimes(1)
    expect(cacheService.set).toHaveBeenCalledWith(
      'sitemap:index:b.example.com',
      '<index/>',
      3600000,
    )
  })

  it('GET /sitemap.xsl returns stylesheet', async () => {
    sitemapService.getStylesheet.mockReturnValueOnce('<xsl/>')

    const res = await request(app.getHttpServer()).get('/sitemap.xsl').expect(200)

    expect(res.headers['content-type']).toContain('text/xsl; charset=utf-8')
    expect(res.headers['cache-control']).toContain('public, max-age=86400')
    expect(res.text).toBe('<xsl/>')
  })

  it('GET /sitemap-:type-:page.xml returns cached section xml when exists', async () => {
    cacheService.get.mockResolvedValueOnce('<section-cached/>')

    const res = await request(app.getHttpServer())
      .get('/sitemap-game-2.xml')
      .set('host', 'c.example.com')
      .expect(200)

    expect(res.text).toBe('<section-cached/>')
    expect(cacheService.get).toHaveBeenCalledWith('sitemap:game:2:c.example.com')
    expect(sitemapService.generateSectionSitemap).not.toHaveBeenCalled()
  })

  it('GET /sitemap-:type-:page.xml generates section xml and caches on miss', async () => {
    cacheService.get.mockResolvedValueOnce(undefined)
    sitemapService.generateSectionSitemap.mockResolvedValueOnce('<section/>')

    const res = await request(app.getHttpServer())
      .get('/sitemap-developer-3.xml')
      .set('host', 'd.example.com')
      .expect(200)

    expect(res.text).toBe('<section/>')
    expect(sitemapService.generateSectionSitemap).toHaveBeenCalledWith(
      expect.anything(),
      SitemapType.DEVELOPER,
      { page: 3, pageSize: 50000 },
    )
    expect(cacheService.set).toHaveBeenCalledWith(
      'sitemap:developer:3:d.example.com',
      '<section/>',
      3600000,
    )
  })

  it('GET /sitemap-:type-:page.xml returns empty urlset for invalid type', async () => {
    const res = await request(app.getHttpServer()).get('/sitemap-unknown-1.xml').expect(200)

    expect(res.headers['content-type']).toContain('application/xml; charset=utf-8')
    expect(res.text).toContain('<urlset')
    expect(cacheService.get).not.toHaveBeenCalled()
    expect(sitemapService.generateSectionSitemap).not.toHaveBeenCalled()
  })

  it('GET /sitemap-:type-:page.xml returns 400 when page is invalid', async () => {
    await request(app.getHttpServer()).get('/sitemap-game-abc.xml').expect(400)
  })
})
