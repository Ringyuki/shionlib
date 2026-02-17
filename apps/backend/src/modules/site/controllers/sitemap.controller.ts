import { Controller, Get, Header, Res, Param, ParseIntPipe, Req } from '@nestjs/common'
import { SitemapService } from '../services/sitemap.service'
import { CacheService } from '../../cache/services/cache.service'
import { Request, Response } from 'express'
import { SitemapType } from '../enums/sitemap/sitemap-type.enum'

@Controller()
export class SitemapController {
  constructor(
    private readonly sitemapService: SitemapService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSitemapIndex(@Req() req: Request, @Res() res: Response): Promise<void> {
    const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host')
    const cacheKey = `sitemap:index:${host}`
    const cached = await this.cacheService.get<string>(cacheKey)
    if (cached) {
      res.type('application/xml; charset=utf-8').send(cached)
      return
    }

    const xml = await this.sitemapService.generateIndex(req)
    await this.cacheService.set(cacheKey, xml, 60 * 60 * 1000)
    res.type('application/xml; charset=utf-8').send(xml)
    return
  }

  @Get('sitemap.xsl')
  @Header('Content-Type', 'text/xsl; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=86400')
  async getSitemapStylesheet(@Res() res: Response): Promise<void> {
    res.type('text/xsl; charset=utf-8').send(this.sitemapService.getStylesheet())
    return
  }

  @Get('sitemap-:type-:page.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  async getSectionSitemap(
    @Param('type') type: SitemapType,
    @Param('page', ParseIntPipe) page: number,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    if (![SitemapType.GAME, SitemapType.DEVELOPER, SitemapType.CHARACTER].includes(type)) {
      res
        .type('application/xml; charset=utf-8')
        .send(
          '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        )
      return
    }

    const host = req.get('x-forwarded-host')?.split(',')[0]?.trim() || req.get('host')
    const cacheKey = `sitemap:${type}:${page}:${host}`
    const cached = await this.cacheService.get<string>(cacheKey)
    if (cached) {
      res.type('application/xml; charset=utf-8').send(cached)
      return
    }

    const xml = await this.sitemapService.generateSectionSitemap(req, type, {
      page,
      pageSize: 50000,
    })
    await this.cacheService.set(cacheKey, xml, 60 * 60 * 1000)
    res.type('application/xml; charset=utf-8').send(xml)
    return
  }
}
