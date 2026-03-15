import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { PrismaService } from '../prisma.service'
import { GameEditService } from '../modules/game/services/game-edit.service'
import { ShionlibUserRoles } from '../shared/enums/auth/user-role.enum'
import { RequestWithUser } from '../shared/interfaces/auth/request-with-user.interface'
import { Logger } from '@nestjs/common'

const DELAY_MS = 100
const MAX_RETRIES = 3
const RETRY_BASE_MS = 2000
const BACKOFF_429_MS = 15000

type SyncStatus = 'pending' | 'success' | 'skipped' | 'failed'

const systemReq = {
  user: {
    sub: 1,
    role: ShionlibUserRoles.SUPER_ADMIN,
    content_limit: 0,
    type: 'access' as const,
  },
} as RequestWithUser

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function is429(err: any): boolean {
  const msg: string = err?.args?.message ?? err?.message ?? ''
  return msg.includes('429') || msg.toLowerCase().includes('too many')
}

async function sync(
  gameEditService: GameEditService,
  gameId: number,
  logger: Logger,
): Promise<{ status: Exclude<SyncStatus, 'pending'>; synced: number }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await gameEditService.syncRelationsFromBangumi(gameId, systemReq)
      return { status: result?.synced > 0 ? 'success' : 'skipped', synced: result?.synced ?? 0 }
    } catch (err) {
      if (is429(err)) {
        logger.warn(`Game #${gameId}: 429 rate limited, backing off ${BACKOFF_429_MS}ms...`)
        await sleep(BACKOFF_429_MS)
        // don't count 429 as a retry attempt — try again immediately
        attempt--
        continue
      }
      if (attempt < MAX_RETRIES) {
        const wait = RETRY_BASE_MS * attempt
        logger.warn(
          `Game #${gameId}: attempt ${attempt} failed (${err.message}), retrying in ${wait}ms`,
        )
        await sleep(wait)
      } else {
        logger.warn(`Game #${gameId}: all ${MAX_RETRIES} attempts failed — ${err.message}`)
        return { status: 'failed', synced: 0 }
      }
    }
  }
  return { status: 'failed', synced: 0 }
}

async function main() {
  const logger = new Logger('sync-bangumi-relations')
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  })

  const prisma = app.get(PrismaService)
  const gameEditService = app.get(GameEditService)

  const games = await prisma.game.findMany({
    where: { b_id: { not: null } },
    select: { id: true, b_id: true, title_jp: true },
    orderBy: { id: 'asc' },
  })

  logger.log(`Found ${games.length} games with Bangumi ID`)

  const statusMap = new Map<number, SyncStatus>(games.map(g => [g.id, 'pending']))
  let totalSynced = 0

  for (let i = 0; i < games.length; i++) {
    const game = games[i]
    const label = `[${i + 1}/${games.length}] Game #${game.id} (${game.title_jp ?? game.b_id})`

    const { status, synced } = await sync(gameEditService, game.id, logger)
    statusMap.set(game.id, status)
    totalSynced += synced

    if (status === 'success') {
      logger.log(`${label}: +${synced} relations`)
    }

    await sleep(DELAY_MS)
  }

  const counts = { success: 0, skipped: 0, failed: 0 }
  for (const status of statusMap.values()) {
    if (status !== 'pending') counts[status]++
  }

  logger.log(
    `Done. synced=${totalSynced} new relations | success=${counts.success} | skipped=${counts.skipped} | failed=${counts.failed}`,
  )

  if (counts.failed > 0) {
    const failedIds = [...statusMap.entries()].filter(([, s]) => s === 'failed').map(([id]) => id)
    logger.warn(`Failed game IDs: ${failedIds.join(', ')}`)
  }

  await app.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
