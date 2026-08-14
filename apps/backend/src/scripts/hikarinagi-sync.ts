import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from '../app.module'
import { PrismaService } from '../prisma.service'
import { HikarinagiChangesService } from '../modules/hikarinagi/services/hikarinagi-changes.service'
import { HikarinagiSyncService } from '../modules/hikarinagi/services/hikarinagi-sync.service'

// Mirror galgame entries from hikarinagi. Dry-run by default: every write runs inside a
// transaction that is rolled back, so the reported counts are what a real run would change.
//   node dist/scripts/hikarinagi-sync.js --ids=1,2,3
//   node dist/scripts/hikarinagi-sync.js --ids=1,2,3 --write
//   node dist/scripts/hikarinagi-sync.js --changes --write
//   node dist/scripts/hikarinagi-sync.js --limit=20 --write

function argValue(name: string): string {
  const arg = process.argv.find(item => item.startsWith(`--${name}=`))
  return arg ? arg.slice(name.length + 3) : ''
}

async function main() {
  const logger = new Logger('hikarinagi-sync')
  const write = process.argv.includes('--write')
  const changes = process.argv.includes('--changes')
  const ids = argValue('ids')
    .split(',')
    .map(Number)
    .filter(value => Number.isInteger(value) && value > 0)
  const limit = Number(argValue('limit')) || 0

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  })

  try {
    if (changes) {
      if (!write) throw new Error('--changes 会推进游标,必须显式加 --write')
      const result = await app.get(HikarinagiChangesService).consume()
      logger.log(`changes: ${JSON.stringify(result)}`)
      return
    }

    const targets = ids.length
      ? ids
      : (
          await app.get(PrismaService).game.findMany({
            where: { h_id: { not: null } },
            select: { h_id: true },
            orderBy: { id: 'asc' },
            take: limit || 10,
          })
        ).flatMap(row => (row.h_id === null ? [] : [row.h_id]))

    if (!targets.length) {
      logger.warn('没有可同步的目标,先用 --ids= 指定 hikarinagi galgame id')
      return
    }

    const sync = app.get(HikarinagiSyncService)
    let failed = 0
    for (const hId of targets) {
      try {
        const report = await sync.applyGalgame(hId, !write)
        if (report && write) logger.log(`applied: ${JSON.stringify(report)}`)
      } catch (error) {
        failed += 1
        logger.error(`h_id=${hId} failed: ${String(error)}`)
      }
    }
    logger.log(
      `done: targets=${targets.length} failed=${failed} mode=${write ? 'write' : 'dry-run'}`,
    )
    if (failed) process.exitCode = 1
  } finally {
    await app.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
