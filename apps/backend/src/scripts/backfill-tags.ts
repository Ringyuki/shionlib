import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { PrismaService } from '../prisma.service'
import { GameTagService } from '../modules/game/services/game-tag.service'
import { Logger } from '@nestjs/common'

async function main() {
  const logger = new Logger('backfill-tags')
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  })

  const prisma = app.get(PrismaService)
  const gameTagService = app.get(GameTagService)

  // This script has already been run. The legacy `tags String[]` column has been dropped.
  // Keeping this file for reference only.
  logger.log('Backfill already completed. Legacy tags column has been dropped.')

  const games: { id: number; tags: string[] }[] = []
  logger.log(`Found ${games.length} games with legacy tags`)

  let processed = 0
  let failed = 0

  for (const game of games) {
    try {
      await gameTagService.setGameTags(game.id, game.tags)
      processed++
      if (processed % 100 === 0) {
        logger.log(`Progress: ${processed}/${games.length}`)
      }
    } catch (err) {
      logger.warn(`Game #${game.id} failed: ${err.message}`)
      failed++
    }
  }

  const tagCount = await prisma.tag.count()
  logger.log(`Done. processed=${processed} failed=${failed} total_tags=${tagCount}`)

  await app.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
