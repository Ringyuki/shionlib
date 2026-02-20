import 'dotenv/config'
import argon2 from 'argon2'
import Redis from 'ioredis'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { Prisma, PrismaClient } from '@prisma/client'
import { RECENT_UPDATE_KEY } from '../modules/game/constants/recent-update.constant'
import { withDefault } from '../common/utils/env.util'
import {
  e2e_users,
  field_permission_mappings,
  seedGameGraph,
  seedPostGameContent,
  seedUsers,
} from './e2e-fixtures/dataset'

type Command = 'reset' | 'seed' | 'prepare'

const pool = new Pool({ connectionString: withDefault('DATABASE_URL', '') })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const LOG_PREFIX = '[e2e-dataset]'
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD || 'ShionlibE2E123!'

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

const resetData = async () => {
  log('Reset started...')
  await truncateBusinessTables()
  await flushRedis()
  log('Reset completed.')
}

const seedData = async () => {
  log('Seed started...')
  const passwordHash = await argon2.hash(E2E_PASSWORD)

  const { admin, member, mutableMember } = await seedUsers(prisma, passwordHash)

  await prisma.fieldPermissionMapping.createMany({
    data: field_permission_mappings,
  })

  const { createdGameIds, primaryGameId, malwareGameId, primaryFixtureGameTitleEn } =
    await seedGameGraph({
      prisma,
      adminId: admin.id,
      memberId: member.id,
      warn,
    })

  await seedPostGameContent({
    prisma,
    makeCommentContent,
    adminId: admin.id,
    memberId: member.id,
    memberFavorites: member.favorites,
    mutableMemberId: mutableMember.id,
    primaryGameId,
    malwareGameId,
    createdGameIds,
  })

  await pushRecentUpdates(createdGameIds)

  log('Seed completed.')
  log(`E2E login user: ${e2e_users.user.name} / ${E2E_PASSWORD}`)
  log(`Primary game id: ${primaryGameId}, title: ${primaryFixtureGameTitleEn}`)
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
