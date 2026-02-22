import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PotatoVNGameMappingService } from '../services/potatovn-game-mapping.service'
import { PrismaService } from '../../../prisma.service'

@Injectable()
export class PvnDataSyncTask {
  private readonly logger = new Logger(PvnDataSyncTask.name)

  constructor(
    private readonly potatovnGameMappingService: PotatoVNGameMappingService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    const bindings = await this.prisma.userPvnBinding.findMany({
      select: { user_id: true },
    })
    if (bindings.length === 0) return

    this.logger.log(`Syncing PVN data for ${bindings.length} binding(s)`)
    for (const { user_id } of bindings) {
      try {
        await this.potatovnGameMappingService.syncLibrary(user_id)
      } catch (err) {
        this.logger.warn(`Failed to sync PVN data for user ${user_id}: ${err?.message}`)
      }
    }
  }
}
