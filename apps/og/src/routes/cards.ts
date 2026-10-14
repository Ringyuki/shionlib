import { Hono } from 'hono'
import { z } from 'zod'
import type { Locale } from '@/config'
import {
  characterCard,
  developerCard,
  docsCard,
  gameCard,
  homeCard,
  resourceCard,
  translatorCard,
  userCard,
  walkthroughCard,
  type Card,
} from '@/cards/load'
import { idSchema, localeSchema, serveOgImage } from './serve'

const entities: Record<string, (id: number, locale: Locale) => Promise<Card>> = {
  game: gameCard,
  resource: resourceCard,
  walkthrough: walkthroughCard,
  character: characterCard,
  developer: developerCard,
  translator: translatorCard,
  user: userCard,
}

const field = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform(value => value?.trim() || undefined)

const docsQuery = z.object({
  title: field(200),
  description: field(400),
  banner: field(600),
  category: field(40),
  author_name: field(100),
  author_avatar: field(600),
  date: field(40),
})

async function digest(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash).slice(0, 12))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const cards = new Hono()

cards.get('/docs', async c => {
  const locale = localeSchema.parse(c.req.query('locale'))
  const parsed = docsQuery.safeParse(c.req.query())
  if (!parsed.success || !parsed.data.title) {
    return c.json({ error: 'Invalid document' }, 400)
  }
  const query = parsed.data
  const id = await digest(JSON.stringify(query))
  return serveOgImage(c, {
    type: 'docs',
    id,
    locale,
    card: () =>
      docsCard(
        {
          title: query.title ?? '',
          description: query.description,
          banner: query.banner,
          category: query.category,
          authorName: query.author_name,
          authorAvatar: query.author_avatar,
          date: query.date,
        },
        locale,
      ),
  })
})

cards.get('/default', c => {
  const locale = localeSchema.parse(c.req.query('locale'))
  return serveOgImage(c, { type: 'default', id: 'home', locale, card: () => homeCard(locale) })
})

for (const [type, card] of Object.entries(entities)) {
  cards.get(`/${type}/:id`, c => {
    const parsed = idSchema.safeParse(c.req.param('id'))
    if (!parsed.success) {
      return c.json({ error: 'Invalid id' }, 400)
    }
    const locale = localeSchema.parse(c.req.query('locale'))
    return serveOgImage(c, {
      type,
      id: String(parsed.data),
      locale,
      card: () => card(parsed.data, locale),
    })
  })
}
