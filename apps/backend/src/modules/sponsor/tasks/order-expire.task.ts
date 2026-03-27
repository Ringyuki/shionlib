import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../../../prisma.service'

@Injectable()
export class OrderExpireTask {
  private readonly logger = new Logger(OrderExpireTask.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    try {
      const now = new Date()

      const { count } = await this.prisma.sponsorOrder.updateMany({
        where: {
          status: 'NEW',
          expires_at: { lt: now },
        },
        data: { status: 'EXPIRED' },
      })

      if (count > 0) {
        this.logger.log(`Expired ${count} stale sponsor order(s)`)
      }
    } catch (error) {
      this.logger.error('Error expiring sponsor orders', error)
    }
  }
}
