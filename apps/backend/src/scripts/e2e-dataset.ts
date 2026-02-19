import 'dotenv/config'
import argon2 from 'argon2'
import Redis from 'ioredis'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  ActivityType,
  GameCharacterBloodType,
  GameCharacterGender,
  GameCharacterRole,
  Prisma,
  PrismaClient,
  UserLang,
} from '@prisma/client'
import { RECENT_UPDATE_KEY } from '../modules/game/constants/recent-update.constant'
import { withDefault } from '../common/utils/env.util'
import {
  game_character_relations as fixture_game_character_relations,
  game_characters as fixture_game_characters,
  game_covers as fixture_game_covers,
  game_developer_relations as fixture_game_developer_relations,
  game_developers as fixture_game_developers,
  game_images as fixture_game_images,
  game_links as fixture_game_links,
  games as fixture_games,
} from './e2e-fixtures/tables'

type Command = 'reset' | 'seed' | 'prepare'

const pool = new Pool({ connectionString: withDefault('DATABASE_URL', '') })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const LOG_PREFIX = '[e2e-dataset]'
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'ShionlibE2E123!'

const FIXTURES = {
  admin: {
    name: 'e2e_admin',
    email: 'e2e_admin@shionlib.local',
    role: 2,
  },
  user: {
    name: 'e2e_user',
    email: 'e2e_user@shionlib.local',
    role: 1,
  },
} as const

const toInt = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

const log = (message: string) => {
  console.log(`${LOG_PREFIX} ${message}`)
}

const warn = (message: string) => {
  console.warn(`${LOG_PREFIX} WARN: ${message}`)
}

const parseCommand = (): Command => {
  const arg = process.argv[2] as Command | undefined
  if (!arg) return 'prepare'
  if (arg === 'reset' || arg === 'seed' || arg === 'prepare') return arg
  throw new Error(`Unsupported command "${arg}". Use one of: reset | seed | prepare`)
}

const getRedisClient = () => {
  const host = process.env.REDIS_HOST
  if (!host) return null
  const port = toInt(process.env.REDIS_PORT, 6379)
  const db = toInt(process.env.REDIS_DB, 0)

  return new Redis({
    host,
    port,
    db,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  })
}

const flushRedis = async () => {
  const redis = getRedisClient()
  if (!redis) {
    warn('REDIS_HOST is not set, skip redis flush.')
    return
  }

  try {
    await redis.connect()
    await redis.flushdb()
    log('Redis DB flushed.')
  } catch (error) {
    warn(`Failed to flush redis: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    redis.disconnect()
  }
}

const pushRecentUpdates = async (gameIds: number[]) => {
  const redis = getRedisClient()
  if (!redis) {
    warn('REDIS_HOST is not set, skip recent-update priming.')
    return
  }

  try {
    await redis.connect()
    const now = Date.now()
    for (const [index, gameId] of gameIds.entries()) {
      await redis.zadd(RECENT_UPDATE_KEY, String(now - index), String(gameId))
    }
    log(`Primed redis sorted set "${RECENT_UPDATE_KEY}" with ${gameIds.length} game ids.`)
  } catch (error) {
    warn(
      `Failed to prime redis recent updates: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    redis.disconnect()
  }
}

const truncateBusinessTables = async () => {
  const tableResult = await prisma.$queryRaw<{ tables: string | null }[]>`
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') AS tables
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `
  const tables = tableResult[0]?.tables
  if (!tables) {
    log('No business tables found to truncate.')
    return
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`)
  log('Postgres business tables truncated with RESTART IDENTITY CASCADE.')
}

const makeCommentContent = (text: string): Prisma.InputJsonValue => {
  return {
    root: {
      type: 'root',
      version: 1,
      format: '',
      indent: 0,
      direction: null,
      children: [
        {
          type: 'paragraph',
          version: 1,
          format: '',
          indent: 0,
          direction: null,
          children: [
            {
              type: 'text',
              version: 1,
              text,
              mode: 'normal',
              style: '',
              detail: 0,
              format: 0,
            },
          ],
        },
      ],
    },
  }
}

const parsePgTextArray = (value: string[] | string | null | undefined): string[] => {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const body = trimmed.slice(1, -1)
    if (!body) return []
    return body
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }
  return [trimmed]
}

const resetData = async () => {
  log('Reset started...')
  await truncateBusinessTables()
  await flushRedis()
  log('Reset completed.')
}

const seedData = async () => {
  log('Seed started...')
  const passwordHash = await argon2.hash(E2E_PASSWORD)
  if (fixture_games.length === 0) {
    throw new Error('No fixture games found under e2e-fixtures/tables/games.ts')
  }

  const admin = await prisma.user.create({
    data: {
      name: FIXTURES.admin.name,
      email: FIXTURES.admin.email,
      password: passwordHash,
      role: FIXTURES.admin.role,
      lang: UserLang.en,
      content_limit: 3,
      upload_quota: {
        create: {
          size: 20_000_000_000n,
          used: 0n,
          is_first_grant: true,
        },
      },
      favorites: {
        create: {
          name: 'default',
          default: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      favorites: {
        select: {
          id: true,
          default: true,
        },
      },
    },
  })

  const member = await prisma.user.create({
    data: {
      name: FIXTURES.user.name,
      email: FIXTURES.user.email,
      password: passwordHash,
      role: FIXTURES.user.role,
      lang: UserLang.en,
      content_limit: 2,
      upload_quota: {
        create: {
          size: 10_000_000_000n,
          used: 0n,
          is_first_grant: true,
        },
      },
      favorites: {
        create: {
          name: 'default',
          default: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      favorites: {
        select: {
          id: true,
          default: true,
        },
      },
    },
  })

  const developerIdMap = new Map<number, number>()
  for (const developer of fixture_game_developers) {
    const created = await prisma.gameDeveloper.create({
      data: {
        b_id: developer.b_id,
        v_id: developer.v_id,
        name: developer.name ?? '',
        aliases: [...(developer.aliases ?? [])],
        logo: developer.logo,
        intro_jp: developer.intro_jp ?? '',
        intro_zh: developer.intro_zh ?? '',
        intro_en: developer.intro_en ?? '',
        website: developer.website,
        extra_info: (developer.extra_info ?? []) as Prisma.InputJsonValue,
      },
      select: {
        id: true,
      },
    })
    developerIdMap.set(developer.id, created.id)
  }

  for (const developer of fixture_game_developers) {
    if (!developer.parent_developer_id) continue
    const currentId = developerIdMap.get(developer.id)
    const parentId = developerIdMap.get(developer.parent_developer_id)
    if (!currentId || !parentId) continue
    await prisma.gameDeveloper.update({
      where: {
        id: currentId,
      },
      data: {
        parent_developer_id: parentId,
      },
    })
  }

  const characterIdMap = new Map<number, number>()
  for (const character of fixture_game_characters) {
    const created = await prisma.gameCharacter.create({
      data: {
        b_id: character.b_id,
        v_id: character.v_id,
        image: character.image,
        name_jp: character.name_jp ?? '',
        name_zh: character.name_zh,
        name_en: character.name_en,
        aliases: [...(character.aliases ?? [])],
        intro_jp: character.intro_jp ?? '',
        intro_zh: character.intro_zh ?? '',
        intro_en: character.intro_en ?? '',
        blood_type: character.blood_type ? (character.blood_type as GameCharacterBloodType) : null,
        height: character.height,
        weight: character.weight,
        bust: character.bust,
        waist: character.waist,
        hips: character.hips,
        cup: character.cup,
        age: character.age,
        birthday: character.birthday ?? undefined,
        gender: parsePgTextArray(character.gender).map(item => item as GameCharacterGender),
      },
      select: {
        id: true,
      },
    })
    characterIdMap.set(character.id, created.id)
  }

  const coversByGameId = new Map<number, (typeof fixture_game_covers)[number][]>()
  for (const item of fixture_game_covers) {
    if (!coversByGameId.has(item.game_id)) coversByGameId.set(item.game_id, [])
    coversByGameId.get(item.game_id)?.push(item)
  }

  const imagesByGameId = new Map<number, (typeof fixture_game_images)[number][]>()
  for (const item of fixture_game_images) {
    if (!imagesByGameId.has(item.game_id)) imagesByGameId.set(item.game_id, [])
    imagesByGameId.get(item.game_id)?.push(item)
  }

  const linksByGameId = new Map<number, (typeof fixture_game_links)[number][]>()
  for (const item of fixture_game_links) {
    if (!linksByGameId.has(item.game_id)) linksByGameId.set(item.game_id, [])
    linksByGameId.get(item.game_id)?.push(item)
  }

  const developerRelationsByGameId = new Map<
    number,
    (typeof fixture_game_developer_relations)[number][]
  >()
  for (const item of fixture_game_developer_relations) {
    if (!developerRelationsByGameId.has(item.game_id)) {
      developerRelationsByGameId.set(item.game_id, [])
    }
    developerRelationsByGameId.get(item.game_id)?.push(item)
  }

  const characterRelationsByGameId = new Map<
    number,
    (typeof fixture_game_character_relations)[number][]
  >()
  for (const item of fixture_game_character_relations) {
    if (!characterRelationsByGameId.has(item.game_id)) {
      characterRelationsByGameId.set(item.game_id, [])
    }
    characterRelationsByGameId.get(item.game_id)?.push(item)
  }

  const gameIdMap = new Map<number, number>()
  const createdGameIds: number[] = []

  for (const [index, game] of fixture_games.entries()) {
    const coverRows = coversByGameId.get(game.id) ?? []
    const imageRows = imagesByGameId.get(game.id) ?? []
    const linkRows = linksByGameId.get(game.id) ?? []
    const developerRelationRows = developerRelationsByGameId.get(game.id) ?? []
    const characterRelationRows = characterRelationsByGameId.get(game.id) ?? []

    const developerCreates = developerRelationRows
      .map(relation => {
        const mappedDeveloperId = developerIdMap.get(relation.developer_id)
        if (!mappedDeveloperId) {
          warn(
            `Missing mapped developer id for relation ${relation.id} (developer_id=${relation.developer_id})`,
          )
          return null
        }
        return {
          role: relation.role,
          developer_id: mappedDeveloperId,
        }
      })
      .filter(Boolean) as { role: string | null; developer_id: number }[]

    const characterCreates = characterRelationRows
      .map(relation => {
        const mappedCharacterId = characterIdMap.get(relation.character_id)
        if (!mappedCharacterId) {
          warn(
            `Missing mapped character id for relation ${relation.id} (character_id=${relation.character_id})`,
          )
          return null
        }
        return {
          image: relation.image,
          actor: relation.actor,
          role: relation.role ? (relation.role as GameCharacterRole) : null,
          character_id: mappedCharacterId,
        }
      })
      .filter(Boolean) as {
      image: string | null
      actor: string | null
      role: GameCharacterRole | null
      character_id: number
    }[]

    const creatorId = index === 0 ? admin.id : member.id
    const created = await prisma.game.create({
      data: {
        creator_id: creatorId,
        v_id: game.v_id,
        b_id: game.b_id,
        title_jp: game.title_jp ?? '',
        title_zh: game.title_zh ?? '',
        title_en: game.title_en ?? '',
        aliases: [...(game.aliases ?? [])],
        intro_jp: game.intro_jp ?? '',
        intro_zh: game.intro_zh ?? '',
        intro_en: game.intro_en ?? '',
        release_date: game.release_date ? new Date(game.release_date) : null,
        release_date_tba: game.release_date_tba ?? false,
        extra_info: (game.extra_info ?? []) as Prisma.InputJsonValue,
        tags: [...(game.tags ?? [])],
        staffs: (game.staffs ?? []) as Prisma.InputJsonValue,
        nsfw: Boolean(game.nsfw),
        type: game.type,
        platform: [...(game.platform ?? [])],
        status: game.status ?? 1,
        hot_score: game.hot_score ?? 0,
        views: game.views ?? 0,
        downloads: game.downloads ?? 0,
        covers: {
          create: coverRows.map(cover => ({
            language: cover.language,
            url: cover.url,
            type: cover.type,
            dims: [...(cover.dims ?? [])],
            sexual: cover.sexual,
            violence: cover.violence,
          })),
        },
        images: {
          create: imageRows.map(image => ({
            url: image.url,
            dims: [...(image.dims ?? [])],
            sexual: image.sexual,
            violence: image.violence,
          })),
        },
        link: {
          create: linkRows.map(link => ({
            url: link.url,
            label: link.label,
            name: link.name,
          })),
        },
        developers: {
          create: developerCreates,
        },
        characters: {
          create: characterCreates,
        },
      },
      select: {
        id: true,
        title_en: true,
        title_jp: true,
        title_zh: true,
      },
    })

    gameIdMap.set(game.id, created.id)
    createdGameIds.push(created.id)
  }

  const primaryFixtureGame = fixture_games.find(game => game.id === 1) ?? fixture_games[0]
  const primaryGameId = gameIdMap.get(primaryFixtureGame.id)
  if (!primaryGameId) {
    throw new Error(`Primary fixture game (old id=${primaryFixtureGame.id}) was not created`)
  }

  const rootComment = await prisma.comment.create({
    data: {
      content: makeCommentContent('Seeded root comment for E2E.'),
      html: '<p>Seeded root comment for E2E.</p>',
      game_id: primaryGameId,
      creator_id: member.id,
      status: 1,
    },
    select: {
      id: true,
    },
  })

  await prisma.comment.create({
    data: {
      content: makeCommentContent('Seeded reply comment for E2E.'),
      html: '<p>Seeded reply comment for E2E.</p>',
      game_id: primaryGameId,
      creator_id: admin.id,
      parent_id: rootComment.id,
      root_id: rootComment.id,
      status: 1,
    },
  })

  await prisma.comment.update({
    where: {
      id: rootComment.id,
    },
    data: {
      reply_count: 1,
    },
  })

  await prisma.activity.createMany({
    data: [
      {
        type: ActivityType.GAME_CREATE,
        user_id: admin.id,
        game_id: createdGameIds[0],
      },
      {
        type: ActivityType.GAME_CREATE,
        user_id: admin.id,
        game_id: createdGameIds[1] ?? createdGameIds[0],
      },
      {
        type: ActivityType.COMMENT,
        user_id: member.id,
        game_id: primaryGameId,
        comment_id: rootComment.id,
      },
    ],
  })

  const memberDefaultFavorite = member.favorites.find(item => item.default)
  if (memberDefaultFavorite) {
    await prisma.favoriteItem.create({
      data: {
        favorite_id: memberDefaultFavorite.id,
        game_id: primaryGameId,
        note: 'Seeded favorite item for E2E tests.',
      },
    })
  }

  await pushRecentUpdates(createdGameIds)

  log('Seed completed.')
  log(`E2E login user: ${FIXTURES.user.name} / ${E2E_PASSWORD}`)
  log(`Primary game id: ${primaryGameId}, title: ${primaryFixtureGame.title_en}`)
}

async function main() {
  const command = parseCommand()
  if (command === 'reset') {
    await resetData()
    return
  }
  if (command === 'seed') {
    await seedData()
    return
  }

  await resetData()
  await seedData()
}

main()
  .catch(error => {
    console.error(`${LOG_PREFIX} ERROR:`, error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
