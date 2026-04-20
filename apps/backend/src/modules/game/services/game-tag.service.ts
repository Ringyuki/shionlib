import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma.service'

@Injectable()
export class GameTagService {
  constructor(private readonly prisma: PrismaService) {}

  normalizeTag(raw: string): string {
    return raw.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  normalizeDisplayTag(raw: string): string {
    return raw.trim().replace(/\s+/g, ' ')
  }

  /** Resolves a raw tag string to its canonical tag id and display alias. */
  async resolveTag(
    tx: Prisma.TransactionClient,
    raw: string,
  ): Promise<{ tagId: number; alias: string | null }> {
    const normalized = this.normalizeTag(raw)
    const display = this.normalizeDisplayTag(raw)
    const alias = display !== normalized ? display : null

    let tag = await tx.tag.findUnique({ where: { name: normalized } })
    if (!tag) {
      tag = await tx.tag.findFirst({ where: { aliases: { has: display } } })
    }

    if (!tag) {
      tag = await tx.tag.create({
        data: { name: normalized, aliases: alias ? [alias] : [] },
      })
    } else if (alias && !tag.aliases.includes(alias)) {
      tag = await tx.tag.update({ where: { id: tag.id }, data: { aliases: { push: alias } } })
    }

    return { tagId: tag.id, alias }
  }

  /**
   * Replace the full tag set for a game.
   * Diffs existing relations, increments/decrements counts, updates relations.
   */
  async setGameTags(
    gameId: number,
    rawTags: string[],
    txClient?: Prisma.TransactionClient,
  ): Promise<void> {
    const execute = async (tx: Prisma.TransactionClient) => {
      const existing = await tx.gameTagRelation.findMany({ where: { game_id: gameId } })
      const existingById = new Map(existing.map(r => [r.tag_id, r]))
      const existingIds = new Set(existingById.keys())

      const resolved = new Map<number, string | null>()
      for (const raw of rawTags) {
        const { tagId, alias } = await this.resolveTag(tx, raw)
        resolved.set(tagId, alias)
      }

      const toRemove = [...existingIds].filter(id => !resolved.has(id))
      const toAdd = [...resolved.entries()].filter(([id]) => !existingIds.has(id))
      const toUpdate = [...resolved.entries()].filter(([id, alias]) => {
        const relation = existingById.get(id)
        return relation && (relation.tag_alias ?? null) !== alias
      })

      if (toRemove.length > 0) {
        await tx.gameTagRelation.deleteMany({
          where: { game_id: gameId, tag_id: { in: toRemove } },
        })
        await tx.tag.updateMany({
          where: { id: { in: toRemove } },
          data: { count: { decrement: 1 } },
        })
      }

      if (toAdd.length > 0) {
        await tx.gameTagRelation.createMany({
          data: toAdd.map(([tag_id, tag_alias]) => ({ game_id: gameId, tag_id, tag_alias })),
          skipDuplicates: true,
        })
        await tx.tag.updateMany({
          where: { id: { in: toAdd.map(([id]) => id) } },
          data: { count: { increment: 1 } },
        })
      }

      for (const [tag_id, tag_alias] of toUpdate) {
        await tx.gameTagRelation.update({
          where: { game_id_tag_id: { game_id: gameId, tag_id } },
          data: { tag_alias },
        })
      }
    }

    if (txClient) {
      await execute(txClient)
    } else {
      await this.prisma.$transaction(execute)
    }
  }
}
