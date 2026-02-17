import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { PrismaService } from '../prisma.service'
import { SEARCH_ENGINE, SearchEngine } from '../modules/search/interfaces/search.interface'
import type { IndexedGame } from '../modules/search/interfaces/index.interface'
import { formatDoc, rawDataQuery } from '../modules/search/helpers/format-doc'
import { GameData } from '../modules/game/interfaces/game.interface'
import { Logger } from '@nestjs/common'

async function buildIndexedGameBatch(prisma: PrismaService, skip: number, take: number) {
  const games = await prisma.game.findMany({
    skip,
    take,
    orderBy: [{ id: 'asc' }],
    select: rawDataQuery,
  })

  const docs: IndexedGame[] = games.map(g => formatDoc(g as unknown as GameData))

  return docs
}

async function main() {
  const logger = new Logger('reindex-all')
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  })
  const prisma = app.get(PrismaService)
  const searchEngine = app.get<SearchEngine>(SEARCH_ENGINE)

  logger.log('Clearing all existing game documents from the search engine...')
  await searchEngine.deleteAllGames()
  logger.log('Existing documents cleared.')

  const total = await prisma.game.count()
  const batchSize = 500
  let processed = 0
  for (let skip = 0; skip < total; skip += batchSize) {
    const docs = await buildIndexedGameBatch(prisma, skip, batchSize)
    if (docs.length) {
      await searchEngine.bulkUpsertGames(docs)
    }
    processed += docs.length

    logger.log(`Indexed ${processed}/${total}`)
  }
  logger.log(`Reindex completed, indexed ${total} games`)
  await app.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
