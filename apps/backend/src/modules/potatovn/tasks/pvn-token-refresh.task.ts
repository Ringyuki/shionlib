import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../../prisma.service'
import { PotatoVNBindingService } from '../services/potatovn-binding.service'
import { REFRESH_THRESHOLD_MS } from '../constants/task.constant'

@Injectable()
export class PvnTokenRefreshTask {
  private readonly logger = new Logger(PvnTokenRefreshTask.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly potatovnBindingService: PotatoVNBindingService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async handleCron() {
    const threshold = new Date(Date.now() + REFRESH_THRESHOLD_MS)

    const bindings = await this.prisma.userPvnBinding.findMany({
      where: { pvn_token_expires: { lte: threshold } },
      select: { user_id: true },
    })
    if (bindings.length === 0) return

    this.logger.log(`Refreshing PVN tokens for ${bindings.length} binding(s)`)
    for (const { user_id } of bindings) {
      try {
        await this.potatovnBindingService.refreshToken(user_id)
      } catch (err) {
        this.logger.warn(`Failed to refresh PVN token for user ${user_id}: ${err?.message}`)
      }
    }
  }
}
