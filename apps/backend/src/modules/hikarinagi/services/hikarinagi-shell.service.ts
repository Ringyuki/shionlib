import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { HikarinagiClient } from '../clients/hikarinagi.client'

@Injectable()
export class HikarinagiShellService {
  private readonly logger = new Logger(HikarinagiShellService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly internal: HikarinagiClient,
    private readonly configService: ShionConfigService,
  ) {}

  async ensure(hikarinagiId: number): Promise<boolean> {
    if (!this.internal.enabled) return false

    const existing = await this.prisma.game.findUnique({
      where: { h_id: hikarinagiId },
      select: { id: true },
    })
    if (existing) return false

    const entry = await this.internal.lookupById(hikarinagiId)
    if (!entry) return false

    const v_id = entry.vndb_id != null ? `v${entry.vndb_id}` : null
    const b_id = entry.bangumi_game_id != null ? String(entry.bangumi_game_id) : null

    const adopted = await this.adopt(hikarinagiId, v_id, b_id)
    if (adopted) return true

    try {
      const created = await this.prisma.game.create({
        data: {
          h_id: hikarinagiId,
          v_id,
          b_id,
          creator_id: this.configService.get('hikarinagi.shell.creator_id'),
        },
        select: { id: true },
      })
      this.logger.log(`created shell ${created.id} for hikarinagi galgame ${hikarinagiId}`)

      return true
    } catch (error) {
      this.logger.warn(
        `could not create a shell for hikarinagi galgame ${hikarinagiId} (v_id=${v_id} b_id=${b_id}): ${(error as Error).message}`,
      )

      return false
    }
  }

  private async adopt(
    hikarinagiId: number,
    v_id: string | null,
    b_id: string | null,
  ): Promise<boolean> {
    const matches = [b_id ? { b_id } : null, v_id ? { v_id } : null].filter(
      (match): match is { b_id: string } | { v_id: string } => match !== null,
    )
    if (!matches.length) return false

    const candidates = await this.prisma.game.findMany({
      where: { h_id: null, OR: matches },
      select: { id: true },
      take: 2,
    })
    if (candidates.length !== 1) {
      if (candidates.length > 1) {
        this.logger.warn(
          `hikarinagi galgame ${hikarinagiId} matches ${candidates.length} unclaimed shionlib rows, leaving them alone`,
        )
      }

      return false
    }

    await this.prisma.game.update({
      where: { id: candidates[0].id },
      data: { h_id: hikarinagiId },
    })
    this.logger.log(`claimed shell ${candidates[0].id} for hikarinagi galgame ${hikarinagiId}`)

    return true
  }
}
