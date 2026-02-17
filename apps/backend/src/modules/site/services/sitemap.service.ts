import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { SiteItem } from '../types/sitemap/SiteItem'
import { SitemapType } from '../enums/sitemap/sitemap-type.enum'
import { IndexItem } from '../types/sitemap/IndexItem'
import { SiteMapReqDto } from '../dto/req/site-map.req.dto'
import { Lang } from '../../../shared/types/i18n/lang.types'
import { Request } from 'express'

@Injectable()
export class SitemapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ShionConfigService,
  ) {}

  private getSiteUrl(request: Request): string {
    const protocol = request.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.protocol
    const host = request.get('x-forwarded-host')?.split(',')[0]?.trim() || request.get('host')

    return host ? `${protocol}://${host}` : this.configService.get('siteUrl')
  }

  private readonly supportedLangs: Lang[] = ['zh', 'ja', 'en']
  private readonly defaultLang: Lang = 'zh'
  private stylesheetCache?: string
  private get stylesheetUrl(): string {
    return '/sitemap.xsl'
  }
  private get stylesheetPath(): string {
    return path.join(__dirname, '../assets/sitemap.xsl')
  }

  async getBaseInfos(
    request: Request,
    type: SitemapType,
    options: SiteMapReqDto,
  ): Promise<SiteItem[]> {
    const { page, pageSize } = options
    const skip = (page - 1) * pageSize

    const buildUrl = (t: SitemapType, id: number) => {
      return `${this.getSiteUrl(request)}/${t}/${id}`
    }
    let items: SiteItem[] = []

    if (type === SitemapType.GAME) {
      const games = await this.prisma.game.findMany({
        where: { status: 1, nsfw: false },
        skip,
        take: pageSize,
        select: { id: true, created: true, updated: true },
      })
      items = games.map(game => ({
        url: buildUrl(type, game.id),
        lastmod: game.updated.toISOString(),
      }))
    } else if (type === SitemapType.DEVELOPER) {
      const developers = await this.prisma.gameDeveloper.findMany({
        skip,
        take: pageSize,
        select: { id: true, created: true, updated: true },
      })
      items = developers.map(developer => ({
        url: buildUrl(type, developer.id),
        lastmod: developer.updated.toISOString(),
      }))
    } else if (type === SitemapType.CHARACTER) {
      const characters = await this.prisma.gameCharacter.findMany({
        skip,
        take: pageSize,
        select: { id: true, created: true, updated: true },
      })
      items = characters.map(character => ({
        url: buildUrl(type, character.id),
        lastmod: character.updated.toISOString(),
      }))
    }
    return items
  }

  async generateIndex(request: Request): Promise<string> {
    const pageSize = 50000

    const [gameCount, developerCount, characterCount] = await Promise.all([
      this.prisma.game.count({ where: { status: 1, nsfw: false } }),
      this.prisma.gameDeveloper.count(),
      this.prisma.gameCharacter.count(),
    ])
    const sections: IndexItem[] = [
      { type: SitemapType.GAME, count: gameCount },
      { type: SitemapType.DEVELOPER, count: developerCount },
      { type: SitemapType.CHARACTER, count: characterCount },
    ]

    const now = new Date().toISOString()
    const entries: string[] = []

    for (const s of sections) {
      const totalPages = Math.ceil(s.count / pageSize)
      for (let p = 1; p <= totalPages; p++) {
        entries.push(
          `<sitemap><loc>${this.getSiteUrl(request)}/sitemap-${s.type}-${p}.xml</loc><lastmod>${now}</lastmod></sitemap>`,
        )
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="${this.stylesheetUrl}"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
      '\n',
    )}\n</sitemapindex>`
  }

  async generateSectionSitemap(
    request: Request,
    type: SitemapType,
    options: SiteMapReqDto,
  ): Promise<string> {
    const changefreq = 'weekly'
    const priority = type === SitemapType.GAME ? '1.0' : '0.8'

    const items = await this.getBaseInfos(request, type, options)
    const urls = items
      .map(i => {
        const url = i.url
        const alternates = this.supportedLangs
          .map(l => {
            return `<xhtml:link rel="alternate" hreflang="${l}" href="${this.buildUrl(request, url, l)}"/>`
          })
          .join('')
        const xDefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${this.buildUrl(request, url, this.defaultLang)}"/>`
        const lastmod = `<lastmod>${i.lastmod}</lastmod>`
        return `<url><loc>${this.buildUrl(request, url, this.defaultLang)}</loc>${alternates}${xDefault}${lastmod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`
      })
      .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>\n<?xml-stylesheet type="text/xsl" href="${this.stylesheetUrl}"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>`
  }

  private buildUrl(request: Request, originalUrl: string, lang: Lang): string {
    const siteUrl = this.getSiteUrl(request)
    const base = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl
    if (!originalUrl.startsWith(base + '/')) return originalUrl
    const path = originalUrl.slice((base + '/').length)
    return `${base}/${lang}/${path}`
  }

  getStylesheet(): string {
    if (process.env.NODE_ENV === 'development') {
      return fs.readFileSync(this.stylesheetPath, 'utf8')
    }
    if (!this.stylesheetCache) {
      this.stylesheetCache = fs.readFileSync(this.stylesheetPath, 'utf8')
    }
    return this.stylesheetCache
  }
}
