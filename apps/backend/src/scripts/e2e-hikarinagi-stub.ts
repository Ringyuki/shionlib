import 'dotenv/config'
import { createServer } from 'node:http'
import { Pool } from 'pg'
import { withDefault } from '../common/utils/env.util'

/**
 * e2e 专用的 hikarinagi 内部通道替身。
 * 读取 e2e 自己的 shionlib 库，把种子里的本地条目行现场转成上游的响应形状，
 * 避免桩数据与种子数据各存一份而漂移。h_id 与 games.id 相同。
 */
const pool = new Pool({ connectionString: withDefault('DATABASE_URL', '') })
const secret = withDefault('PARTNER_API_SECRET', '')
const port = Number(withDefault('STUB_PORT', '5003'))

const media = (row: Record<string, unknown>, index: number) => ({
  id: index + 1,
  src: String(row.url ?? ''),
  width: Array.isArray(row.dims) ? (row.dims[0] ?? null) : null,
  height: Array.isArray(row.dims) ? (row.dims[1] ?? null) : null,
  sexual: Number(row.sexual ?? 0),
  violence: Number(row.violence ?? 0),
})

const coversOf = async (gameId: number) => {
  const { rows } = await pool.query(
    'select url, language, type, dims, sexual, violence from game_covers where game_id = $1 order by id asc',
    [gameId],
  )
  return rows.map((row, index) => ({
    votes: 1,
    language: row.language ?? null,
    kind: row.type ?? null,
    media: media(row, index),
  }))
}

const cardOf = async (row: Record<string, unknown>) => {
  const covers = await coversOf(Number(row.id))
  return {
    id: Number(row.id),
    origin_title: String(row.title_jp || row.title_zh || row.title_en || ''),
    trans_title: (row.title_zh as string) || null,
    en_title: (row.title_en as string) || null,
    origin_lang: 'ja',
    aliases: (row.aliases as string[]) ?? [],
    adv_type: (row.type as string) ?? null,
    origin_intro: (row.intro_jp as string) || null,
    trans_intro: (row.intro_zh as string) || null,
    en_intro: (row.intro_en as string) || null,
    nsfw: Boolean(row.nsfw),
    release_date: row.release_date ? new Date(row.release_date as string).toISOString() : null,
    release_date_tbd: Boolean(row.release_date_tba),
    max_cover_sexual: covers.reduce((max, cover) => Math.max(max, cover.media.sexual), 0),
    covers,
  }
}

const idsQuery = async (params: URLSearchParams) => {
  const where: string[] = ['g.status = 1']
  const values: unknown[] = []
  const add = (clause: string, value: unknown) => {
    values.push(value)
    where.push(clause.replace('$?', `$${values.length}`))
  }

  if (params.get('content_limit') === 'NEVER_SHOW_NSFW_CONTENT') where.push('g.nsfw is not true')
  if (params.get('exclude_rated_covers') === 'true')
    where.push('not exists (select 1 from game_covers c where c.game_id = g.id and c.sexual <> 0)')
  const producer = params.get('producer_ids')
  if (producer)
    add(
      'exists (select 1 from game_developer_relations r where r.game_id = g.id and r.developer_id = $?)',
      Number(producer),
    )
  const character = params.get('character_id')
  if (character)
    add(
      'exists (select 1 from game_character_relations r where r.game_id = g.id and r.character_id = $?)',
      Number(character),
    )
  const tags = params.get('tags')
  if (tags)
    add(
      'exists (select 1 from game_tag_relations r join tags t on t.id = r.tag_id where r.game_id = g.id and lower(t.name) = any($?))',
      tags.split(',').map(tag => tag.toLowerCase()),
    )
  const excludeTags = params.get('exclude_tags')
  if (excludeTags)
    add(
      'not exists (select 1 from game_tag_relations r join tags t on t.id = r.tag_id where r.game_id = g.id and lower(t.name) = any($?))',
      excludeTags.split(',').map(tag => tag.toLowerCase()),
    )
  const platforms = params.get('platforms')
  if (platforms) add('g.platform && $?', platforms.split(','))
  const after = params.get('released_after')
  if (after) add('g.release_date >= $?', new Date(after))
  const before = params.get('released_before')
  if (before) add('g.release_date <= $?', new Date(before))
  const periods = params.get('release_periods')
  if (periods) {
    values.push(periods.split(','))
    const slot = `$${values.length}`
    where.push(
      `(to_char(g.release_date, 'YYYY-MM') = any(${slot}) or to_char(g.release_date, 'YYYY') = any(${slot}))`,
    )
  }

  const direction = params.get('sort_order') === 'asc' ? 'asc' : 'desc'
  const { rows } = await pool.query(
    `select g.id from games g where ${where.join(' and ')} order by g.release_date ${direction} nulls last, g.id desc`,
    values,
  )

  return rows.map(row => Number(row.id))
}

const send = (res: import('node:http').ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      success: status < 400,
      data,
      request_id: 'e2e-stub',
      timestamp: new Date().toISOString(),
    }),
  )
}

const readBody = async (req: import('node:http').IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return chunks.length
    ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>)
    : {}
}

const server = createServer((req, res) => {
  void (async () => {
    if (req.headers['x-internal-secret'] !== secret) {
      send(res, { code: 'AUTH_FORBIDDEN' }, 403)
      return
    }

    const url = new URL(req.url ?? '/', 'http://stub')
    const path = url.pathname.replace('/api/v3/internal', '')

    if (path === '/galgames/ids') {
      const ids = await idsQuery(url.searchParams)
      send(res, { ids, total: ids.length })
      return
    }

    if (path === '/galgames/search') {
      const keyword = `%${(url.searchParams.get('q') ?? '').toLowerCase()}%`
      const { rows } = await pool.query(
        'select id from games where status = 1 and (lower(title_jp) like $1 or lower(title_zh) like $1 or lower(title_en) like $1) order by id asc',
        [keyword],
      )
      const ids = rows.map(row => Number(row.id))
      send(res, { ids, meta: { total_items: ids.length, total_pages: 1 } })
      return
    }

    if (path === '/galgames/batch' && req.method === 'POST') {
      const body = await readBody(req)
      const ids = (body.ids as number[]) ?? []
      if (!ids.length) return send(res, [])
      const { rows } = await pool.query('select * from games where id = any($1) and status = 1', [
        ids,
      ])
      const cards: Record<string, unknown>[] = []
      for (const row of rows) {
        const card = await cardOf(row)
        const { rows: dev } = await pool.query(
          'select d.id, d.name from game_developer_relations r join game_developers d on d.id = r.developer_id where r.game_id = $1 limit 1',
          [row.id],
        )
        cards.push({
          ...card,
          developer: dev[0] ? { id: Number(dev[0].id), name: dev[0].name } : null,
        })
      }
      send(res, cards)
      return
    }

    const detail = /^\/galgames\/(\d+)\/detail$/.exec(path)
    if (detail) {
      const id = Number(detail[1])
      const { rows } = await pool.query('select * from games where id = $1', [id])
      if (!rows.length) return send(res, null)
      const row = rows[0]
      const card = await cardOf(row)
      const { rows: images } = await pool.query(
        'select url, dims, sexual, violence from game_images where game_id = $1 order by id asc',
        [id],
      )
      const { rows: links } = await pool.query(
        'select name, label, url from game_links where game_id = $1 order by id asc',
        [id],
      )
      const { rows: tags } = await pool.query(
        'select t.id, t.name, t.count from game_tag_relations r join tags t on t.id = r.tag_id where r.game_id = $1 order by t.count desc nulls last, t.id asc',
        [id],
      )
      const { rows: producers } = await pool.query(
        'select r.role, d.id, d.name, d.aliases from game_developer_relations r join game_developers d on d.id = r.developer_id where r.game_id = $1',
        [id],
      )
      const { rows: characters } = await pool.query(
        'select r.role, c.* from game_character_relations r join game_characters c on c.id = r.character_id where r.game_id = $1 order by c.id asc',
        [id],
      )

      send(res, {
        galgame: {
          ...card,
          platforms: (row.platform as string[]) ?? [],
          images: images.map((image, index) => media(image, index)),
          steam_apps: [],
          external_links: links.map(link => ({
            name: link.name ?? '',
            label: link.label ?? '',
            url: link.url ?? '',
          })),
        },
        characters: characters.map(character => ({
          role: character.role === '开发' ? 'MAIN' : String(character.role ?? 'MAIN').toUpperCase(),
          actors: [],
          character: {
            id: Number(character.id),
            name: character.name_jp ?? character.name_zh ?? '',
            trans_name: character.name_zh ?? null,
            en_name: character.name_en ?? null,
            aliases: character.aliases ?? [],
            intro: character.intro_jp ?? null,
            trans_intro: character.intro_zh ?? null,
            en_intro: character.intro_en ?? null,
            gender: Array.isArray(character.gender) ? (character.gender[0] ?? null) : null,
            blood_type: character.blood_type ?? null,
            height: character.height ?? null,
            weight: character.weight ?? null,
            bust: character.bust ?? null,
            waist: character.waist ?? null,
            hips: character.hips ?? null,
            cup: character.cup ?? null,
            age: character.age ?? null,
            birthday_month: Array.isArray(character.birthday)
              ? (character.birthday[0] ?? null)
              : null,
            birthday_day: Array.isArray(character.birthday)
              ? (character.birthday[1] ?? null)
              : null,
            image: character.image
              ? {
                  id: Number(character.id),
                  src: String(character.image),
                  width: null,
                  height: null,
                }
              : null,
          },
        })),
        staff: [],
        producers: producers.map(producer => ({
          role: 'DEVELOPER',
          note: '',
          producer: {
            id: Number(producer.id),
            name: producer.name,
            aliases: producer.aliases ?? [],
            logo: null,
          },
        })),
        relations: [],
        tags: tags.map(tag => ({
          tag: { id: Number(tag.id), name: tag.name, aliases: [], count: Number(tag.count ?? 0) },
        })),
      })
      return
    }

    const character = /^\/characters\/(\d+)$/.exec(path)
    if (character) {
      const { rows } = await pool.query('select * from game_characters where id = $1', [
        Number(character[1]),
      ])
      if (!rows.length) return send(res, null)
      const row = rows[0]
      send(res, {
        id: Number(row.id),
        name: row.name_jp ?? row.name_zh ?? '',
        trans_name: row.name_zh ?? null,
        en_name: row.name_en ?? null,
        aliases: row.aliases ?? [],
        intro: row.intro_jp ?? null,
        trans_intro: row.intro_zh ?? null,
        en_intro: row.intro_en ?? null,
        blood_type: row.blood_type ?? null,
        height: row.height ?? null,
        weight: row.weight ?? null,
        bust: row.bust ?? null,
        waist: row.waist ?? null,
        hips: row.hips ?? null,
        cup: row.cup ?? null,
        age: row.age ?? null,
        birthday_month: Array.isArray(row.birthday) ? (row.birthday[0] ?? null) : null,
        birthday_day: Array.isArray(row.birthday) ? (row.birthday[1] ?? null) : null,
        gender: Array.isArray(row.gender) ? (row.gender[0] ?? null) : null,
        image: row.image
          ? { id: Number(row.id), src: String(row.image), width: null, height: null }
          : null,
      })
      return
    }

    const producer = /^\/producers\/(\d+)$/.exec(path)
    if (producer) {
      const { rows } = await pool.query('select * from game_developers where id = $1', [
        Number(producer[1]),
      ])
      if (!rows.length) return send(res, null)
      const row = rows[0]
      send(res, {
        id: Number(row.id),
        name: row.name,
        aliases: row.aliases ?? [],
        intro: row.intro_jp ?? null,
        trans_intro: row.intro_zh ?? null,
        en_intro: row.intro_en ?? null,
        website: row.website ?? null,
        country: '日本',
        established: null,
        labels: [],
        logo: row.logo
          ? { id: Number(row.id), src: String(row.logo), width: null, height: null }
          : null,
        vndb_id: row.v_id ?? null,
        bangumi_id: row.b_id ?? null,
      })
      return
    }

    if (path === '/galgames/lookup') {
      const byId = url.searchParams.get('id')
      const byVndb = url.searchParams.get('vndb_id')
      const byBangumi = url.searchParams.get('bangumi_game_id')
      const [column, value] = byId
        ? ['id', byId]
        : byVndb
          ? ['v_id', `v${byVndb}`]
          : ['b_id', byBangumi]
      const { rows } = await pool.query(
        `select id, v_id, b_id from games where ${column} = $1 limit 1`,
        [column === 'id' ? Number(value) : value],
      )
      const row = rows[0]
      send(
        res,
        row
          ? {
              id: Number(row.id),
              vndb_id: row.v_id ? Number(String(row.v_id).replace(/^v/i, '')) : null,
              bangumi_game_id: row.b_id ? Number(row.b_id) : null,
            }
          : null,
      )
      return
    }

    if (path === '/catalog/changes') {
      send(res, { items: [], latest_id: 0, has_more: false })
      return
    }

    send(res, null, 404)
  })().catch((error: unknown) => {
    console.error('[e2e-stub]', error)
    send(res, { code: 'STUB_ERROR', message: String(error) }, 500)
  })
})

server.listen(port, () => console.log(`[e2e-stub] hikarinagi stub listening on ${port}`))
