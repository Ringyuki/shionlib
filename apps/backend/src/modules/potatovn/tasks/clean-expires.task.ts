import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../../prisma.service'

@Injectable()
export class CleanExpiresTask {
  private readonly logger = new Logger(CleanExpiresTask.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    const now = new Date()
    const bindings = await this.prisma.userPvnBinding.findMany({
      where: { pvn_token_expires: { lt: now } },
      select: { user_id: true },
    })
    if (bindings.length === 0) return

    this.logger.log(`Cleaning expired PVN data for ${bindings.length} binding(s)`)
    for (const { user_id } of bindings) {
      try {
        await this.prisma.userPvnBinding.delete({ where: { user_id } })
        await this.prisma.userGamePvnMapping.deleteMany({ where: { user_id } })
      } catch (err) {
        this.logger.warn(`Failed to clean expired PVN data for user ${user_id}: ${err?.message}`)
      }
    }
  }
}
