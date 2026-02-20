import { Hono } from 'hono'
import { ImageResponse } from '@takumi-rs/image-response'
import { getRenderer } from '@/services/renderer'
import { getCharacterMetadata } from '@/services/metadata'
import { CharacterOgTemplate } from '@/templates/character'
import { OG_W, OG_H } from '@/config'
import { serveOgImage, localeSchema, idSchema } from './_shared'

const router = new Hono()

router.get('/:id', async c => {
  const idResult = idSchema.safeParse(c.req.param('id'))
  if (!idResult.success) return c.json({ error: 'Invalid id' }, 400)

  const id = idResult.data
  const locale = localeSchema.parse(c.req.query('locale'))

  return serveOgImage(c, {
    type: 'character',
    id,
    locale,
    render: async () => {
      const data = await getCharacterMetadata(id, locale)
      const res = new ImageResponse(<CharacterOgTemplate {...data} locale={locale} />, {
        renderer: getRenderer(),
        width: OG_W,
        height: OG_H,
        format: 'webp',
      })
      return Buffer.from(await res.arrayBuffer())
    },
  })
})

export default router
