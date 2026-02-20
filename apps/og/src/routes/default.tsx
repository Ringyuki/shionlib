import { Hono } from 'hono'
import { ImageResponse } from '@takumi-rs/image-response'
import { getRenderer } from '@/services/renderer'
import { DefaultOgTemplate } from '@/templates/default'
import { OG_W, OG_H, SUPPORTED_LOCALES, type SupportedLocale } from '@/config'
import { serveOgImage, localeSchema } from './_shared'
import { z } from 'zod'

const titleSchema = z.string().max(200).optional()
const descSchema = z.string().max(400).optional()

const router = new Hono()

router.get('/default', async c => {
  const locale = localeSchema.parse(c.req.query('locale'))
  const title = titleSchema.parse(c.req.query('title') || undefined)
  const description = descSchema.parse(c.req.query('description') || undefined)

  // For default pages, id encodes locale + optional title hash so caching is correct
  const id = title ? `${locale}-custom` : locale

  return serveOgImage(c, {
    type: 'default',
    id,
    locale,
    render: async () => {
      const res = new ImageResponse(
        <DefaultOgTemplate locale={locale as SupportedLocale} title={title} description={description} />,
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
