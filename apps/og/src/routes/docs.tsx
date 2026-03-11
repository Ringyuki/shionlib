import { Hono } from 'hono'
import { ImageResponse } from '@takumi-rs/image-response'
import { z } from 'zod'
import { getRenderer } from '@/services/renderer'
import { DocsOgTemplate } from '@/templates/docs'
import { OG_W, OG_H, SupportedLocale } from '@/config'
import { serveOgImage, localeSchema } from './_shared'

const slugSchema = z.string().max(200).optional()
const titleSchema = z.string().max(200).optional()
const descSchema = z.string().max(400).optional()
const bannerSchema = z.string().max(600).optional()
const nameSchema = z.string().max(100).optional()

const router = new Hono()

router.get('/docs', async c => {
  const locale = localeSchema.parse(c.req.query('locale'))
  const slug = slugSchema.parse(c.req.query('slug') || undefined)
  const title = titleSchema.parse(c.req.query('title') || undefined) ?? ''
  const description = descSchema.parse(c.req.query('description') || undefined)
  const banner = bannerSchema.parse(c.req.query('banner') || undefined)
  const authorName = nameSchema.parse(c.req.query('author_name') || undefined)
  const authorAvatar = bannerSchema.parse(c.req.query('author_avatar') || undefined)

  // Extract category from slug prefix (e.g. "guides/download-games" → "guides")
  const category = slug?.split('/')[0]

  // Stable cache key derived from slug, replacing "/" with ":"
  const id = slug ? slug.replaceAll('/', ':') : locale

  return serveOgImage(c, {
    type: 'docs',
    id,
    locale,
    render: async () => {
      const res = new ImageResponse(
        <DocsOgTemplate
          locale={locale as SupportedLocale}
          title={title}
          description={description}
          banner={banner}
          authorName={authorName}
          authorAvatar={authorAvatar}
          category={category}
        />,
        {
          renderer: getRenderer(),
          width: OG_W,
          height: OG_H,
          format: 'webp',
        },
      )
      return Buffer.from(await res.arrayBuffer())
    },
  })
})

export default router
