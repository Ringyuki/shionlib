import { Inject, Injectable, Logger } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma.service'
import { SearchEngine, SEARCH_ENGINE } from '../../search/interfaces/search.interface'
import { formatDoc, rawDataQuery } from '../../search/helpers/format-doc'
import { GameData } from '../../game/interfaces/game.interface'
import { GameTagService } from '../../game/services/game-tag.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { HikarinagiClient } from '../clients/hikarinagi.client'
import { HikarinagiOpenClient } from '../clients/hikarinagi-open.client'
import {
  OpenGalgameCharacter,
  OpenGalgameDetail,
  OpenGalgameProducer,
} from '../interfaces/open-api.interface'
import {
  mapActor,
  mapCharacterRole,
  mapCoverKind,
  mapCoverLanguage,
  mapDeveloperRole,
  mapGalgameScalars,
  mapStaffs,
  mediaDims,
} from '../mappers/galgame-sync.mapper'
import { mapCharacterFields, mapDeveloperFields } from '../mappers/entity-sync.mapper'

export interface GalgameSyncReport {
  h_id: number
  game_id: number
  resolution: 'created' | 'claimed' | 'linked'
  covers: { added: number; updated: number; removed: number }
  images: { added: number; updated: number; removed: number }
  links: number
  developers: { created: number; matched: number; unlinked: number }
  characters: { created: number; matched: number; unlinked: number }
}

class DryRunRollback extends Error {}

@Injectable()
export class HikarinagiSyncService {
  private readonly logger = new Logger(HikarinagiSyncService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly open: HikarinagiOpenClient,
    private readonly internal: HikarinagiClient,
    private readonly gameTagService: GameTagService,
    private readonly configService: ShionConfigService,
    @Inject(SEARCH_ENGINE) private readonly searchEngine: SearchEngine,
  ) {}

  async applyGalgame(hId: number, dryRun = false): Promise<GalgameSyncReport | null> {
    const detail = await this.open.galgame(hId)
    if (!detail) {
      if (!dryRun) await this.hideGalgame(hId)
      return null
    }

    const [characters, staffs, producers] = await Promise.all([
      this.open.galgameCharacters(hId),
      this.open.galgameStaff(hId),
      this.open.galgameProducers(hId),
    ])

    let report: GalgameSyncReport | null = null
    const run = async (tx: Prisma.TransactionClient) => {
      const resolved = await this.resolveGame(tx, hId)
      await tx.game.update({
        where: { id: resolved.id },
        data: { ...mapGalgameScalars(detail), staffs: mapStaffs(staffs), status: 1 },
      })
      report = {
        h_id: hId,
        game_id: resolved.id,
        resolution: resolved.resolution,
        covers: await this.syncCovers(tx, resolved.id, detail),
        images: await this.syncImages(tx, resolved.id, detail),
        links: await this.syncLinks(tx, resolved.id, detail),
        developers: await this.syncDevelopers(tx, resolved.id, producers),
        characters: await this.syncCharacters(tx, resolved.id, characters),
      }
    }

    if (dryRun) {
      await this.prisma
        .$transaction(async tx => {
          await run(tx)
          throw new DryRunRollback()
        })
        .catch((error: unknown) => {
          if (!(error instanceof DryRunRollback)) throw error
        })
      this.logger.log(`[dry-run] ${JSON.stringify(report)}`)
      return report
    }

    await this.prisma.$transaction(run)
    const gameId = report!.game_id
    await this.gameTagService.setGameTags(
      gameId,
      detail.tags.map(tag => tag.name),
    )
    await this.reindex(gameId)
    return report
  }

  async hideGalgame(hId: number): Promise<null> {
    const game = await this.prisma.game.findUnique({ where: { h_id: hId }, select: { id: true } })
    if (!game) return null
    await this.prisma.game.update({ where: { id: game.id }, data: { status: 2 } })
    await this.reindex(game.id)
    this.logger.log(`galgame h_id=${hId} hidden (game_id=${game.id})`)
    return null
  }

  async mergeGalgame(loserHId: number, canonicalHId: number): Promise<void> {
    const loser = await this.prisma.game.findUnique({
      where: { h_id: loserHId },
      select: { id: true },
    })
    if (!loser) return
    const canonical = await this.prisma.game.findUnique({
      where: { h_id: canonicalHId },
      select: { id: true },
    })
    if (canonical) {
      await this.prisma.game.update({ where: { id: loser.id }, data: { h_id: null, status: 2 } })
      await this.reindex(loser.id)
      this.logger.log(
        `galgame h_id=${loserHId} merged into h_id=${canonicalHId}; local game ${loser.id} hidden`,
      )
      return
    }
    await this.prisma.game.update({ where: { id: loser.id }, data: { h_id: canonicalHId } })
    await this.applyGalgame(canonicalHId)
  }

  async applyCharacter(hId: number): Promise<void> {
    const detail = await this.open.character(hId)
    if (!detail) return
    const character = await this.prisma.gameCharacter.findUnique({
      where: { h_id: hId },
      select: { id: true, image: true },
    })
    if (!character) return
    await this.prisma.gameCharacter.update({
      where: { id: character.id },
      data: {
        ...mapCharacterFields(detail),
        ...(character.image || !detail.image?.url ? {} : { image: detail.image.url }),
      },
    })
  }

  async applyProducer(hId: number): Promise<void> {
    const detail = await this.open.producer(hId)
    if (!detail) return
    const developer = await this.prisma.gameDeveloper.findUnique({
      where: { h_id: hId },
      select: { id: true, logo: true },
    })
    if (!developer) return
    await this.prisma.gameDeveloper.update({
      where: { id: developer.id },
      data: {
        ...mapDeveloperFields(detail),
        ...(developer.logo || !detail.logo?.url ? {} : { logo: detail.logo.url }),
      },
    })
  }

  private async resolveGame(
    tx: Prisma.TransactionClient,
    hId: number,
  ): Promise<{ id: number; resolution: GalgameSyncReport['resolution'] }> {
    const linked = await tx.game.findUnique({ where: { h_id: hId }, select: { id: true } })
    if (linked) return { id: linked.id, resolution: 'linked' }

    const mapping = await this.internal.lookupById(hId)
    const v_id = mapping?.vndb_id != null ? `v${mapping.vndb_id}` : null
    const b_id = mapping?.bangumi_game_id != null ? String(mapping.bangumi_game_id) : null

    const claimable = await tx.game.findFirst({
      where: {
        h_id: null,
        OR: [...(v_id ? [{ v_id }] : []), ...(b_id ? [{ b_id }] : [])],
      },
      select: { id: true },
    })
    if (claimable) {
      await tx.game.update({ where: { id: claimable.id }, data: { h_id: hId } })
      return { id: claimable.id, resolution: 'claimed' }
    }

    const created = await tx.game.create({
      data: {
        h_id: hId,
        v_id,
        b_id,
        creator_id: this.configService.get('hikarinagi.sync.creator_id'),
      },
      select: { id: true },
    })
    return { id: created.id, resolution: 'created' }
  }

  private async syncCovers(
    tx: Prisma.TransactionClient,
    gameId: number,
    detail: OpenGalgameDetail,
  ): Promise<GalgameSyncReport['covers']> {
    const existing = await tx.gameCover.findMany({ where: { game_id: gameId } })
    const byUrl = new Map(existing.map(row => [row.source_url ?? row.url, row]))
    const seen = new Set<number>()
    const counts = { added: 0, updated: 0, removed: 0 }

    for (const cover of detail.covers) {
      const matched = byUrl.get(cover.url)
      const data = {
        language: mapCoverLanguage(cover.language),
        type: mapCoverKind(cover.kind),
        dims: mediaDims(cover),
        sexual: cover.sexual,
        violence: cover.violence,
      }
      if (matched) {
        seen.add(matched.id)
        counts.updated += 1
        await tx.gameCover.update({ where: { id: matched.id }, data })
        continue
      }
      const created = await tx.gameCover.create({
        data: { ...data, game_id: gameId, url: cover.url, source: 'hikarinagi' },
        select: { id: true },
      })
      counts.added += 1
      seen.add(created.id)
    }

    const stale = existing.filter(row => !seen.has(row.id)).map(row => row.id)
    if (stale.length) await tx.gameCover.deleteMany({ where: { id: { in: stale } } })
    counts.removed = stale.length
    return counts
  }

  private async syncImages(
    tx: Prisma.TransactionClient,
    gameId: number,
    detail: OpenGalgameDetail,
  ): Promise<GalgameSyncReport['images']> {
    const existing = await tx.gameImage.findMany({ where: { game_id: gameId } })
    const byUrl = new Map(existing.map(row => [row.source_url ?? row.url, row]))
    const seen = new Set<number>()
    const counts = { added: 0, updated: 0, removed: 0 }

    for (const image of detail.images) {
      const matched = byUrl.get(image.url)
      const data = { dims: mediaDims(image), sexual: image.sexual, violence: image.violence }
      if (matched) {
        seen.add(matched.id)
        counts.updated += 1
        await tx.gameImage.update({ where: { id: matched.id }, data })
        continue
      }
      const created = await tx.gameImage.create({
        data: { ...data, game_id: gameId, url: image.url, source: 'hikarinagi' },
        select: { id: true },
      })
      counts.added += 1
      seen.add(created.id)
    }

    const stale = existing.filter(row => !seen.has(row.id)).map(row => row.id)
    if (stale.length) await tx.gameImage.deleteMany({ where: { id: { in: stale } } })
    counts.removed = stale.length
    return counts
  }

  private async syncLinks(
    tx: Prisma.TransactionClient,
    gameId: number,
    detail: OpenGalgameDetail,
  ): Promise<number> {
    await tx.gameLink.deleteMany({ where: { game_id: gameId } })
    const links = [
      ...(detail.homepage
        ? [{ name: 'website', label: 'Official website', url: detail.homepage }]
        : []),
      ...detail.external_links,
    ]
    const unique = new Map(links.map(link => [link.url, link]))
    if (!unique.size) return 0
    await tx.gameLink.createMany({
      data: [...unique.values()].map(link => ({
        game_id: gameId,
        url: link.url,
        label: link.label,
        name: link.name,
      })),
    })
    return unique.size
  }

  private async syncDevelopers(
    tx: Prisma.TransactionClient,
    gameId: number,
    producers: OpenGalgameProducer[],
  ): Promise<GalgameSyncReport['developers']> {
    const counts = { created: 0, matched: 0, unlinked: 0 }
    const keep: number[] = []
    for (const row of producers) {
      const resolved = await this.resolveDeveloper(tx, row)
      const developerId = resolved.id
      if (resolved.created) counts.created += 1
      else counts.matched += 1
      keep.push(developerId)
      await tx.gameDeveloperRelation.upsert({
        where: { game_id_developer_id: { game_id: gameId, developer_id: developerId } },
        create: { game_id: gameId, developer_id: developerId, role: mapDeveloperRole(row.role) },
        update: { role: mapDeveloperRole(row.role) },
      })
    }
    const dropped = await tx.gameDeveloperRelation.deleteMany({
      where: { game_id: gameId, developer_id: { notIn: keep.length ? keep : [0] } },
    })
    counts.unlinked = dropped.count
    return counts
  }

  private async resolveDeveloper(
    tx: Prisma.TransactionClient,
    row: OpenGalgameProducer,
  ): Promise<{ id: number; created: boolean }> {
    const linked = await tx.gameDeveloper.findUnique({
      where: { h_id: row.producer.id },
      select: { id: true },
    })
    if (linked) return { id: linked.id, created: false }

    const named = await tx.gameDeveloper.findFirst({
      where: { h_id: null, name: row.producer.name },
      select: { id: true },
    })
    if (named) {
      await tx.gameDeveloper.update({ where: { id: named.id }, data: { h_id: row.producer.id } })
      return { id: named.id, created: false }
    }

    const created = await tx.gameDeveloper.create({
      data: { h_id: row.producer.id, name: row.producer.name },
      select: { id: true },
    })
    return { id: created.id, created: true }
  }

  private async syncCharacters(
    tx: Prisma.TransactionClient,
    gameId: number,
    characters: OpenGalgameCharacter[],
  ): Promise<GalgameSyncReport['characters']> {
    const counts = { created: 0, matched: 0, unlinked: 0 }
    const keep: number[] = []
    for (const row of characters) {
      const resolved = await this.resolveCharacter(tx, row)
      const characterId = resolved.id
      if (resolved.created) counts.created += 1
      else counts.matched += 1
      keep.push(characterId)
      const relation = {
        role: mapCharacterRole(row.role),
        actor: mapActor(row),
        image: row.character.image?.url ?? null,
      }
      await tx.gameCharacterRelation.upsert({
        where: { game_id_character_id: { game_id: gameId, character_id: characterId } },
        create: { game_id: gameId, character_id: characterId, ...relation },
        update: { role: relation.role, actor: relation.actor },
      })
    }
    const dropped = await tx.gameCharacterRelation.deleteMany({
      where: { game_id: gameId, character_id: { notIn: keep.length ? keep : [0] } },
    })
    counts.unlinked = dropped.count
    return counts
  }

  private async resolveCharacter(
    tx: Prisma.TransactionClient,
    row: OpenGalgameCharacter,
  ): Promise<{ id: number; created: boolean }> {
    const linked = await tx.gameCharacter.findUnique({
      where: { h_id: row.character.id },
      select: { id: true },
    })
    if (linked) return { id: linked.id, created: false }

    const named = await tx.gameCharacter.findFirst({
      where: { h_id: null, name_jp: row.character.name },
      select: { id: true },
    })
    if (named) {
      await tx.gameCharacter.update({ where: { id: named.id }, data: { h_id: row.character.id } })
      return { id: named.id, created: false }
    }

    const created = await tx.gameCharacter.create({
      data: {
        h_id: row.character.id,
        name_jp: row.character.name,
        name_zh: row.character.trans_name,
        image: row.character.image?.url ?? null,
      },
      select: { id: true },
    })
    return { id: created.id, created: true }
  }

  private async reindex(gameId: number): Promise<void> {
    const row = await this.prisma.game.findUnique({ where: { id: gameId }, select: rawDataQuery })
    if (row) await this.searchEngine.upsertGame(formatDoc(row as unknown as GameData))
  }
}
