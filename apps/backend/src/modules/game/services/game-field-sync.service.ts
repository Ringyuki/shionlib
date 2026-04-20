import { Inject, Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { BangumiAuthService } from '../../bangumi/services/bangumi-auth.service'
import { VNDBService } from '../../vndb/services/vndb.service'
import { GameDataFetcherService } from './game-data-fetcher.service'
import { GameEditService } from './game-edit.service'
import { GameEntityUpsertService } from './game-entity-upsert.service'
import { GameTagService } from './game-tag.service'
import {
  EditGameCoverDto,
  EditGameDeveloperDto,
  EditGameImageDto,
  EditGameReqDto,
  GameCharacterRole,
  GameCoverDto,
  GameDeveloperRelationDto,
  GameImageDto,
  GameLinkDto,
  GameScalarSyncFieldEnum,
} from '../dto/req/edit-game.req.dto'
import { GameCharacter, GameData, GameDeveloper, GameCover } from '../interfaces/game.interface'
import { BangumiSubjectRelation } from '../interfaces/bangumi/subject-relation.res.interface'
import { VNDBGameItemRes } from '../interfaces/vndb/game-item.res'
import { VNDBReleaseItemRes } from '../interfaces/vndb/release-item.res'
import { BANGUMI_RELATION_MAP } from '../constants/game-relation.constant'
import { dedupeCharactersInPlace, dedupeDevelopersInPlace } from '../helpers/dedupe'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { EditActionType } from '../../edit/enums/edit-action-type.enum'
import { EditRelationType } from '../../edit/enums/edit-relation-type.enum'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { SearchEngine, SEARCH_ENGINE } from '../../search/interfaces/search.interface'
import { formatDoc, rawDataQuery } from '../../search/helpers/format-doc'

export type GameSyncField =
  | 'links'
  | 'covers'
  | 'images'
  | 'developers'
  | 'characters'
  | 'relations'

type SyncPreviewField = GameSyncField | GameScalarSyncFieldEnum

type SyncCandidateAction = 'add' | 'update' | 'remove' | 'unmatched'
type SyncCandidateConfidence = 'exact' | 'high' | 'medium' | 'low'

export interface GameFieldSyncCandidate {
  id: string
  action: SyncCandidateAction
  source: 'bangumi' | 'vndb' | 'merged'
  title: string
  subtitle?: string
  confidence: SyncCandidateConfidence
  defaultSelected: boolean
  applicable: boolean
  local?: Record<string, any>
  remote?: Record<string, any>
  warnings?: string[]
}

interface InternalGameFieldSyncCandidate extends GameFieldSyncCandidate {
  apply?: Record<string, any>
}

interface ExternalSnapshot {
  finalGameData: Partial<GameData>
  finalCharactersData: GameCharacter[]
  finalProducersData: GameDeveloper[]
  finalCoversData: GameCover[]
}

@Injectable()
export class GameFieldSyncService {
  private readonly logger = new Logger(GameFieldSyncService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly bangumiAuthService: BangumiAuthService,
    private readonly vndbService: VNDBService,
    private readonly gameDataFetcherService: GameDataFetcherService,
    private readonly gameEditService: GameEditService,
    private readonly gameEntityUpsertService: GameEntityUpsertService,
    private readonly gameTagService: GameTagService,
    private readonly activityService: ActivityService,
    @Inject(SEARCH_ENGINE) private readonly searchEngine: SearchEngine,
  ) {}

  async preview(gameId: number, field: GameSyncField) {
    const candidates = await this.buildCandidates(gameId, field)
    return this.toPreview(field, candidates)
  }

  async previewScalar(gameId: number, field: GameScalarSyncFieldEnum) {
    const candidates = await this.buildScalarCandidates(gameId, field)
    return this.toPreview(field, candidates)
  }

  async apply(gameId: number, field: GameSyncField, candidateIds: string[], req: RequestWithUser) {
    const selectedIds = new Set(candidateIds)
    const candidates = (await this.buildCandidates(gameId, field)).filter(
      c => c.applicable && selectedIds.has(c.id),
    )
    if (candidates.length === 0) return { applied: 0 }

    switch (field) {
      case 'links':
        await this.applyLinks(gameId, candidates, req)
        break
      case 'covers':
        await this.applyCovers(gameId, candidates, req)
        break
      case 'images':
        await this.applyImages(gameId, candidates, req)
        break
      case 'developers':
        await this.applyDevelopers(gameId, candidates, req)
        break
      case 'characters':
        await this.applyCharacters(gameId, candidates, req)
        break
      case 'relations':
        await this.applyRelations(gameId, candidates, req)
        break
    }

    return { applied: candidates.length }
  }

  async applyScalar(
    gameId: number,
    field: GameScalarSyncFieldEnum,
    candidateIds: string[],
    req: RequestWithUser,
    note?: string,
  ) {
    const selectedIds = new Set(candidateIds)
    const candidates = (await this.buildScalarCandidates(gameId, field)).filter(
      c => c.applicable && selectedIds.has(c.id),
    )
    if (candidates.length === 0) return { applied: 0 }

    const scalar = candidates.reduce<EditGameReqDto>((acc, candidate) => {
      return { ...acc, ...(candidate.apply?.scalar as EditGameReqDto) }
    }, {})
    if (Object.keys(scalar).length === 0) return { applied: 0 }

    await this.gameEditService.editGameScalar(gameId, { ...scalar, note }, req)
    return { applied: candidates.length }
  }

  private async buildCandidates(gameId: number, field: GameSyncField) {
    switch (field) {
      case 'links':
        return this.buildLinkCandidates(gameId)
      case 'covers':
        return this.buildCoverCandidates(gameId)
      case 'images':
        return this.buildImageCandidates(gameId)
      case 'developers':
        return this.buildDeveloperCandidates(gameId)
      case 'characters':
        return this.buildCharacterCandidates(gameId)
      case 'relations':
        return this.buildRelationCandidates(gameId)
    }
  }

  private async buildScalarCandidates(
    gameId: number,
    field: GameScalarSyncFieldEnum,
  ): Promise<InternalGameFieldSyncCandidate[]> {
    const game = await this.loadScalarGame(gameId)
    const snapshot = await this.loadExternalSnapshot(game)
    const external = snapshot.finalGameData
    const localTags = game.tags.map(r => r.tag_alias ?? r.tag.name).sort()

    switch (field) {
      case GameScalarSyncFieldEnum.TITLES:
        return this.scalarGroupCandidate(gameId, field, 'merged', {
          local: this.pickDefined({
            title_jp: game.title_jp,
            title_zh: game.title_zh,
            title_en: game.title_en,
          }),
          remote: this.pickNonEmpty({
            title_jp: external.title_jp,
            title_zh: external.title_zh,
            title_en: external.title_en,
          }),
          title: 'Titles',
        })
      case GameScalarSyncFieldEnum.ALIASES:
        return this.scalarGroupCandidate(gameId, field, 'merged', {
          local: { aliases: game.aliases ?? [] },
          remote: { aliases: external.aliases ?? [] },
          title: 'Aliases',
          skipEmptyRemote: true,
        })
      case GameScalarSyncFieldEnum.INTROS:
        return this.scalarGroupCandidate(gameId, field, 'merged', {
          local: this.pickDefined({
            intro_jp: game.intro_jp,
            intro_zh: game.intro_zh,
            intro_en: game.intro_en,
          }),
          remote: this.pickNonEmpty({
            intro_jp: external.intro_jp,
            intro_zh: external.intro_zh,
            intro_en: external.intro_en,
          }),
          title: 'Introductions',
        })
      case GameScalarSyncFieldEnum.RELEASE: {
        const releaseDate = this.validDate(external.release_date)
        if (!releaseDate) return []
        return this.scalarGroupCandidate(gameId, field, 'vndb', {
          local: {
            release_date: game.release_date?.toISOString() ?? null,
            release_date_tba: game.release_date_tba,
          },
          remote: {
            release_date: releaseDate.toISOString(),
            release_date_tba: false,
          },
          title: 'Release date',
        })
      }
      case GameScalarSyncFieldEnum.TYPE:
        return this.scalarGroupCandidate(gameId, field, 'bangumi', {
          local: { type: game.type },
          remote: this.pickNonEmpty({ type: external.type }),
          title: 'Type',
        })
      case GameScalarSyncFieldEnum.PLATFORMS:
        return this.scalarGroupCandidate(gameId, field, 'vndb', {
          local: { platform: game.platform ?? [] },
          remote: { platform: external.platform ?? [] },
          title: 'Platforms',
          skipEmptyRemote: true,
        })
      case GameScalarSyncFieldEnum.EXTRA:
        return this.scalarGroupCandidate(gameId, field, 'bangumi', {
          local: { extra_info: game.extra_info ?? [] },
          remote: { extra_info: external.extra_info ?? [] },
          title: 'Extra info',
          skipEmptyRemote: true,
        })
      case GameScalarSyncFieldEnum.STAFFS:
        return this.scalarGroupCandidate(gameId, field, 'bangumi', {
          local: { staffs: game.staffs ?? [] },
          remote: { staffs: external.staffs ?? [] },
          title: 'Staffs',
          skipEmptyRemote: true,
        })
      case GameScalarSyncFieldEnum.TAGS:
        return this.scalarGroupCandidate(gameId, field, 'bangumi', {
          local: { tags: localTags },
          remote: {
            tags: this.dedupeTagsByCanonical((external.tags as unknown as string[]) ?? []),
          },
          title: 'Tags',
          skipEmptyRemote: true,
        })
    }
  }

  private async buildLinkCandidates(gameId: number): Promise<InternalGameFieldSyncCandidate[]> {
    const game = await this.loadGame(gameId)
    const snapshot = await this.loadExternalSnapshot(game)
    const externalLinks = this.uniqueBy(snapshot.finalGameData.links ?? [], link =>
      this.normalizeUrl(link.url),
    )
    const localLinks = await this.prisma.gameLink.findMany({
      where: { game_id: gameId },
      select: { id: true, url: true, label: true, name: true },
    })
    const localByUrl = new Map(localLinks.map(l => [this.normalizeUrl(l.url), l]))

    return externalLinks.flatMap(link => {
      const normalized = this.normalizeUrl(link.url)
      const local = localByUrl.get(normalized)
      if (!local) {
        return [
          this.candidate('links', 'add', normalized, {
            source: 'vndb',
            title: link.name || link.label || link.url,
            subtitle: link.url,
            confidence: 'exact',
            defaultSelected: true,
            remote: link,
            apply: { link },
          }),
        ]
      }

      if (local.label !== link.label || local.name !== link.name) {
        return [
          this.candidate('links', 'update', `${local.id}:${normalized}`, {
            source: 'vndb',
            title: link.name || link.label || link.url,
            subtitle: link.url,
            confidence: 'exact',
            defaultSelected: false,
            local,
            remote: link,
            apply: { link: { ...link, id: local.id } },
          }),
        ]
      }

      return []
    })
  }

  private async buildCoverCandidates(gameId: number): Promise<InternalGameFieldSyncCandidate[]> {
    const game = await this.loadGame(gameId)
    const snapshot = await this.loadExternalSnapshot(game)
    const externalCovers = this.uniqueBy(snapshot.finalCoversData ?? [], c =>
      this.mediaSourceKey(c),
    ).map(c => ({ ...c, language: this.normalizeCoverLanguage(c.language) }))
    const localCovers = await this.prisma.gameCover.findMany({
      where: { game_id: gameId },
      select: {
        id: true,
        language: true,
        url: true,
        type: true,
        dims: true,
        sexual: true,
        violence: true,
        source: true,
        source_key: true,
        source_url: true,
      },
    })
    const hasLocalProvenance = localCovers.some(c => c.source || c.source_key || c.source_url)

    return externalCovers.flatMap(cover => {
      const local = localCovers.find(c => this.sameMedia(c, cover))
      const sourceKey = this.mediaSourceKey(cover)
      if (!local) {
        const warnings =
          localCovers.length > 0 && !hasLocalProvenance
            ? ['Existing covers do not have source metadata; confirm manually to avoid duplicates.']
            : undefined
        return [
          this.candidate('covers', 'add', sourceKey, {
            source: 'vndb',
            title: `${cover.language || 'unknown'} / ${cover.type}`,
            subtitle: cover.url,
            confidence: cover.source_key ? 'exact' : 'medium',
            defaultSelected: !warnings,
            remote: cover,
            warnings,
            apply: { cover },
          }),
        ]
      }

      const remote = { ...cover, id: local.id }
      if (this.mediaFieldsChanged(local, remote)) {
        return [
          this.candidate('covers', 'update', `${local.id}:${sourceKey}`, {
            source: 'vndb',
            title: `${cover.language || 'unknown'} / ${cover.type}`,
            subtitle: cover.url,
            confidence: 'exact',
            defaultSelected: this.isEmptyDims(local.dims),
            local,
            remote,
            apply: { cover: remote },
          }),
        ]
      }

      return []
    })
  }

  private async buildImageCandidates(gameId: number): Promise<InternalGameFieldSyncCandidate[]> {
    const game = await this.loadGame(gameId)
    const snapshot = await this.loadExternalSnapshot(game)
    const externalImages = this.uniqueBy(snapshot.finalGameData.images ?? [], image =>
      this.mediaSourceKey(image),
    )
    const localImages = await this.prisma.gameImage.findMany({
      where: { game_id: gameId },
      select: {
        id: true,
        url: true,
        dims: true,
        sexual: true,
        violence: true,
        source: true,
        source_key: true,
        source_url: true,
      },
    })
    const hasLocalProvenance = localImages.some(i => i.source || i.source_key || i.source_url)

    return externalImages.flatMap(image => {
      const local = localImages.find(i => this.sameMedia(i, image))
      const sourceKey = this.mediaSourceKey(image)
      if (!local) {
        const warnings =
          localImages.length > 0 && !hasLocalProvenance
            ? ['Existing images do not have source metadata; confirm manually to avoid duplicates.']
            : undefined
        return [
          this.candidate('images', 'add', sourceKey, {
            source: 'vndb',
            title: this.formatDims(image.dims) || image.url,
            subtitle: image.url,
            confidence: image.source_key ? 'exact' : 'medium',
            defaultSelected: !warnings,
            remote: image,
            warnings,
            apply: { image },
          }),
        ]
      }

      const remote = { ...image, id: local.id }
      if (this.mediaFieldsChanged(local, remote)) {
        return [
          this.candidate('images', 'update', `${local.id}:${sourceKey}`, {
            source: 'vndb',
            title: this.formatDims(image.dims) || image.url,
            subtitle: image.url,
            confidence: 'exact',
            defaultSelected: this.isEmptyDims(local.dims),
            local,
            remote,
            apply: { image: remote },
          }),
        ]
      }

      return []
    })
  }

  private async buildDeveloperCandidates(
    gameId: number,
  ): Promise<InternalGameFieldSyncCandidate[]> {
    const game = await this.loadGame(gameId)
    const snapshot = await this.loadExternalSnapshot(game)
    const developers = this.uniqueBy(snapshot.finalProducersData ?? [], d =>
      d.b_id ? `b:${d.b_id}` : d.v_id ? `v:${d.v_id}` : `n:${this.normalizeText(d.name)}`,
    )
    const [localRelations, matchedDevelopers] = await Promise.all([
      this.prisma.gameDeveloperRelation.findMany({
        where: { game_id: gameId },
        select: {
          id: true,
          developer_id: true,
          role: true,
          developer: { select: { id: true, b_id: true, v_id: true, name: true, aliases: true } },
        },
      }),
      this.findDeveloperMatches(developers),
    ])
    const relationByDeveloperId = new Map(localRelations.map(r => [r.developer_id, r]))

    return developers.flatMap(developer => {
      const match = this.matchDeveloper(developer, matchedDevelopers)
      const relation = match ? relationByDeveloperId.get(match.developer.id) : undefined
      const title = developer.name || match?.developer.name || 'Unknown developer'
      const role = '开发'

      if (!relation) {
        return [
          this.candidate('developers', 'add', this.externalEntityKey(developer), {
            source:
              developer.b_id && developer.v_id ? 'merged' : developer.b_id ? 'bangumi' : 'vndb',
            title,
            subtitle: match
              ? `Matched local developer #${match.developer.id}`
              : 'Will create developer',
            confidence: match?.confidence ?? 'exact',
            defaultSelected: (match?.confidence ?? 'exact') !== 'low',
            remote: { ...developer, role },
            warnings: match?.confidence === 'medium' ? ['Matched by name or alias.'] : undefined,
            apply: { developer, developerId: match?.developer.id, role },
          }),
        ]
      }

      if (relation.role !== role) {
        return [
          this.candidate('developers', 'update', `${relation.id}:role`, {
            source:
              developer.b_id && developer.v_id ? 'merged' : developer.b_id ? 'bangumi' : 'vndb',
            title,
            subtitle: `Relation #${relation.id}`,
            confidence: 'exact',
            defaultSelected: this.isEmptyValue(relation.role),
            local: { role: relation.role },
            remote: { role },
            apply: { relation: { id: relation.id, developer_id: relation.developer_id, role } },
          }),
        ]
      }

      return []
    })
  }

  private async buildCharacterCandidates(
    gameId: number,
  ): Promise<InternalGameFieldSyncCandidate[]> {
    const game = await this.loadGame(gameId)
    const snapshot = await this.loadExternalSnapshot(game)
    const characters = this.uniqueBy(snapshot.finalCharactersData ?? [], c =>
      c.b_id ? `b:${c.b_id}` : c.v_id ? `v:${c.v_id}` : `n:${this.characterDisplayName(c)}`,
    )
    const [localRelations, matchedCharacters] = await Promise.all([
      this.prisma.gameCharacterRelation.findMany({
        where: { game_id: gameId },
        select: {
          id: true,
          character_id: true,
          role: true,
          actor: true,
          image: true,
          character: {
            select: {
              id: true,
              b_id: true,
              v_id: true,
              name_jp: true,
              name_zh: true,
              name_en: true,
              aliases: true,
            },
          },
        },
      }),
      this.findCharacterMatches(characters),
    ])
    const relationByCharacterId = new Map(localRelations.map(r => [r.character_id, r]))

    const candidates = characters.flatMap(character => {
      const match = this.matchCharacter(character, matchedCharacters)
      const relation = match ? relationByCharacterId.get(match.character.id) : undefined
      const title =
        this.characterDisplayName(character) || this.characterDisplayName(match?.character)

      if (!relation) {
        return [
          this.candidate('characters', 'add', this.externalEntityKey(character), {
            source:
              character.b_id && character.v_id ? 'merged' : character.b_id ? 'bangumi' : 'vndb',
            title: title || 'Unknown character',
            subtitle: match
              ? `Matched local character #${match.character.id}`
              : 'Will create character',
            confidence: match?.confidence ?? 'exact',
            defaultSelected: false,
            remote: {
              name: title,
              role: character.role,
              actor: character.actor,
              b_id: character.b_id,
              v_id: character.v_id,
            },
            warnings: match?.confidence === 'medium' ? ['Matched by name or alias.'] : undefined,
            apply: {
              character,
              characterId: match?.character.id,
              role: character.role,
              actor: character.actor,
            },
          }),
        ]
      }

      const patch: { role?: GameCharacterRole; actor?: string } = {}
      const local: Record<string, any> = {}
      const remote: Record<string, any> = {}
      if (character.role && relation.role !== character.role) {
        patch.role = character.role as GameCharacterRole
        local.role = relation.role
        remote.role = character.role
      }
      if (character.actor && relation.actor !== character.actor) {
        patch.actor = character.actor
        local.actor = relation.actor
        remote.actor = character.actor
      }
      if (Object.keys(patch).length === 0) return []

      const fillsEmpty = Object.keys(remote).every(k => this.isEmptyValue(local[k]))
      return [
        this.candidate('characters', 'update', `${relation.id}:${this.hash(remote)}`, {
          source: character.b_id && character.v_id ? 'merged' : character.b_id ? 'bangumi' : 'vndb',
          title: title || 'Unknown character',
          subtitle: `Relation #${relation.id}`,
          confidence: 'exact',
          defaultSelected: fillsEmpty,
          local,
          remote,
          apply: {
            relation: {
              id: relation.id,
              character_id: relation.character_id,
              role: patch.role ?? relation.role ?? undefined,
              actor: patch.actor ?? relation.actor ?? undefined,
            },
          },
        }),
      ]
    })

    const addCandidates = candidates.filter(c => c.action === 'add')
    for (const candidate of addCandidates) {
      const role = candidate.remote?.role
      candidate.defaultSelected =
        candidate.confidence !== 'medium' &&
        (this.isImportantCharacterRole(role) ||
          (addCandidates.length <= 20 && role !== GameCharacterRole.APPEARS))
    }
    return candidates
  }

  private async buildRelationCandidates(gameId: number): Promise<InternalGameFieldSyncCandidate[]> {
    const game = await this.loadGame(gameId)
    if (!game.b_id) throw new ShionBizException(ShionBizCode.COMMON_VALIDATION_FAILED)

    const bangumiRelations = await this.bangumiAuthService.bangumiRequest<BangumiSubjectRelation[]>(
      `https://api.bgm.tv/v0/subjects/${game.b_id}/subjects`,
    )
    const mappable = bangumiRelations.filter(r => BANGUMI_RELATION_MAP[r.relation])
    const bIds = mappable.map(r => String(r.id))
    const [existingGames, localRelations] = await Promise.all([
      this.prisma.game.findMany({
        where: { b_id: { in: bIds } },
        select: { id: true, b_id: true, title_jp: true, title_zh: true, title_en: true },
      }),
      this.prisma.gameRelation.findMany({
        where: { from_game_id: gameId },
        select: { id: true, to_game_id: true, relation: true },
      }),
    ])
    const bIdToGame = new Map(existingGames.map(g => [g.b_id!, g]))
    const localByToId = new Map(localRelations.map(r => [r.to_game_id, r]))

    return mappable.flatMap(sourceRelation => {
      const relation = BANGUMI_RELATION_MAP[sourceRelation.relation]
      const target = bIdToGame.get(String(sourceRelation.id))
      const title = sourceRelation.name_cn || sourceRelation.name || `Bangumi #${sourceRelation.id}`
      if (!target) {
        return [
          this.candidate('relations', 'unmatched', `${sourceRelation.id}:${relation}`, {
            source: 'bangumi',
            title,
            subtitle: 'No local game with this Bangumi ID',
            confidence: 'exact',
            defaultSelected: false,
            applicable: false,
            remote: {
              b_id: String(sourceRelation.id),
              relation,
              bangumi_relation: sourceRelation.relation,
            },
          }),
        ]
      }

      const local = localByToId.get(target.id)
      if (!local) {
        return [
          this.candidate('relations', 'add', `${target.id}:${relation}`, {
            source: 'bangumi',
            title,
            subtitle: `#${target.id}`,
            confidence: 'exact',
            defaultSelected: true,
            remote: { to_game_id: target.id, relation, to_game: target },
            apply: { relation: { to_game_id: target.id, relation } },
          }),
        ]
      }

      if (local.relation !== relation) {
        return [
          this.candidate('relations', 'update', `${local.id}:${relation}`, {
            source: 'bangumi',
            title,
            subtitle: `#${target.id}`,
            confidence: 'exact',
            defaultSelected: false,
            local: { relation: local.relation },
            remote: { relation, to_game_id: target.id, to_game: target },
            apply: { relation: { id: local.id, relation } },
          }),
        ]
      }

      return []
    })
  }

  private async applyLinks(
    gameId: number,
    candidates: InternalGameFieldSyncCandidate[],
    req: RequestWithUser,
  ) {
    const linksToAdd = candidates
      .filter(c => c.action === 'add')
      .map(c => c.apply?.link)
      .filter(Boolean) as GameLinkDto[]
    const linksToEdit = candidates
      .filter(c => c.action === 'update')
      .map(c => c.apply?.link)
      .filter(Boolean) as any[]

    if (linksToAdd.length) await this.gameEditService.addLinks(gameId, linksToAdd, req)
    if (linksToEdit.length) await this.gameEditService.editLinks(gameId, linksToEdit, req)
  }

  private async applyCovers(
    gameId: number,
    candidates: InternalGameFieldSyncCandidate[],
    req: RequestWithUser,
  ) {
    const coversToAdd = candidates
      .filter(c => c.action === 'add')
      .map(c => c.apply?.cover)
      .filter(Boolean) as GameCoverDto[]
    const coversToEdit = candidates
      .filter(c => c.action === 'update')
      .map(c => c.apply?.cover)
      .filter(Boolean) as EditGameCoverDto[]

    if (coversToAdd.length) await this.gameEditService.addCovers(gameId, coversToAdd, req)
    if (coversToEdit.length) await this.gameEditService.editCovers(gameId, coversToEdit, req)
  }

  private async applyImages(
    gameId: number,
    candidates: InternalGameFieldSyncCandidate[],
    req: RequestWithUser,
  ) {
    const imagesToAdd = candidates
      .filter(c => c.action === 'add')
      .map(c => c.apply?.image)
      .filter(Boolean) as GameImageDto[]
    const imagesToEdit = candidates
      .filter(c => c.action === 'update')
      .map(c => c.apply?.image)
      .filter(Boolean) as EditGameImageDto[]

    if (imagesToAdd.length) await this.gameEditService.addImages(gameId, imagesToAdd, req)
    if (imagesToEdit.length) await this.gameEditService.editImages(gameId, imagesToEdit, req)
  }

  private async applyDevelopers(
    gameId: number,
    candidates: InternalGameFieldSyncCandidate[],
    req: RequestWithUser,
  ) {
    await this.applyDeveloperAdds(gameId, candidates, req)
    const developersToEdit = candidates
      .filter(c => c.action === 'update')
      .map(c => c.apply?.relation)
      .filter(Boolean) as EditGameDeveloperDto[]

    if (developersToEdit.length)
      await this.gameEditService.editDevelopers(gameId, developersToEdit, req)
  }

  private async applyCharacters(
    gameId: number,
    candidates: InternalGameFieldSyncCandidate[],
    req: RequestWithUser,
  ) {
    await this.applyCharacterAdds(gameId, candidates, req)
    const charactersToEdit = candidates
      .filter(c => c.action === 'update')
      .map(c => c.apply?.relation)
      .filter(Boolean) as any[]

    if (charactersToEdit.length)
      await this.gameEditService.editCharacters(gameId, charactersToEdit, req)
  }

  private async applyDeveloperAdds(
    gameId: number,
    candidates: InternalGameFieldSyncCandidate[],
    req: RequestWithUser,
  ) {
    const addCandidates = candidates.filter(c => c.action === 'add')
    if (addCandidates.length === 0) return

    let added = 0
    await this.prisma.$transaction(async tx => {
      const game = await tx.game.findUnique({ where: { id: gameId }, select: { id: true } })
      if (!game) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)

      const existing = await tx.gameDeveloperRelation.findMany({
        where: { game_id: gameId },
        select: { developer_id: true },
      })
      const existingIds = new Set(existing.map(e => e.developer_id))
      const toCreate: GameDeveloperRelationDto[] = []

      for (const candidate of addCandidates) {
        const developerId =
          candidate.apply?.developerId ??
          (
            await this.gameEntityUpsertService.findOrCreateDeveloper(
              tx,
              candidate.apply?.developer as GameDeveloper,
            )
          ).id
        if (existingIds.has(developerId)) continue
        existingIds.add(developerId)
        toCreate.push({ developer_id: developerId, role: candidate.apply?.role })
      }
      if (toCreate.length === 0) return

      const developers = await tx.gameDeveloper.findMany({
        where: { id: { in: toCreate.map(d => d.developer_id) } },
        select: { id: true, name: true },
      })
      const developerById = new Map(developers.map(d => [d.id, d]))

      await tx.gameDeveloperRelation.createMany({
        data: toCreate.map(d => ({
          game_id: gameId,
          developer_id: d.developer_id,
          role: d.role ?? null,
        })),
      })

      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: gameId,
          action: EditActionType.ADD_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.DEVELOPER,
          field_changes: ['developers'],
          changes: {
            relation: 'developers',
            added: toCreate.map(d => ({
              role: d.role ?? null,
              developer_id: d.developer_id,
              developer: { name: developerById.get(d.developer_id)?.name ?? null },
            })),
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: gameId,
          edit_record_id: editRecord.id,
        },
        tx,
      )
      added = toCreate.length
    })

    if (added > 0) await this.reindexGame(gameId)
  }

  private async applyCharacterAdds(
    gameId: number,
    candidates: InternalGameFieldSyncCandidate[],
    req: RequestWithUser,
  ) {
    const addCandidates = candidates.filter(c => c.action === 'add')
    if (addCandidates.length === 0) return

    let added = 0
    await this.prisma.$transaction(async tx => {
      const game = await tx.game.findUnique({ where: { id: gameId }, select: { id: true } })
      if (!game) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)

      const existing = await tx.gameCharacterRelation.findMany({
        where: { game_id: gameId },
        select: { character_id: true },
      })
      const existingIds = new Set(existing.map(e => e.character_id))
      const toCreate: {
        character_id: number
        role?: GameCharacterRole
        actor?: string
      }[] = []

      for (const candidate of addCandidates) {
        const characterId =
          candidate.apply?.characterId ??
          (
            await this.gameEntityUpsertService.findOrCreateCharacter(
              tx,
              candidate.apply?.character as GameCharacter,
            )
          ).id
        if (existingIds.has(characterId)) continue
        existingIds.add(characterId)
        toCreate.push({
          character_id: characterId,
          role: candidate.apply?.role,
          actor: candidate.apply?.actor,
        })
      }
      if (toCreate.length === 0) return

      const characters = await tx.gameCharacter.findMany({
        where: { id: { in: toCreate.map(c => c.character_id) } },
        select: { id: true, name_jp: true, name_zh: true, name_en: true },
      })
      const characterById = new Map(characters.map(c => [c.id, c]))

      await tx.gameCharacterRelation.createMany({
        data: toCreate.map(c => ({
          game_id: gameId,
          character_id: c.character_id,
          role: c.role ?? null,
          actor: c.actor ?? null,
        })),
      })

      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: gameId,
          action: EditActionType.ADD_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.CHARACTER,
          field_changes: ['characters'],
          changes: {
            relation: 'characters',
            added: toCreate.map(c => ({
              role: c.role ?? null,
              character_id: c.character_id,
              character: { name: this.characterDisplayName(characterById.get(c.character_id)) },
            })),
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: gameId,
          edit_record_id: editRecord.id,
        },
        tx,
      )
      added = toCreate.length
    })

    if (added > 0) await this.reindexGame(gameId)
  }

  private async applyRelations(
    gameId: number,
    candidates: InternalGameFieldSyncCandidate[],
    req: RequestWithUser,
  ) {
    const relationsToAdd = candidates
      .filter(c => c.action === 'add')
      .map(c => c.apply?.relation)
      .filter(Boolean) as any[]
    const relationsToEdit = candidates
      .filter(c => c.action === 'update')
      .map(c => c.apply?.relation)
      .filter(Boolean) as any[]

    if (relationsToAdd.length)
      await this.gameEditService.addGameRelations(gameId, relationsToAdd, req)
    if (relationsToEdit.length)
      await this.gameEditService.editGameRelations(gameId, relationsToEdit, req)
  }

  private async loadGame(gameId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, b_id: true, v_id: true },
    })
    if (!game) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    return game
  }

  private async loadScalarGame(gameId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        b_id: true,
        v_id: true,
        title_jp: true,
        title_zh: true,
        title_en: true,
        aliases: true,
        intro_jp: true,
        intro_zh: true,
        intro_en: true,
        release_date: true,
        release_date_tba: true,
        type: true,
        platform: true,
        extra_info: true,
        staffs: true,
        tags: { select: { tag_alias: true, tag: { select: { name: true } } } },
      },
    })
    if (!game) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    return game
  }

  private async loadExternalSnapshot(game: { b_id: string | null; v_id: string | null }) {
    if (game.b_id) {
      try {
        return await this.gameDataFetcherService.fetchData(
          game.b_id,
          this.stripVndbPrefix(game.v_id ?? undefined),
          true,
        )
      } catch (err) {
        this.logger.warn(`Bangumi based sync snapshot failed: ${err.message}`)
        if (!game.v_id) throw err
      }
    }

    if (game.v_id) return this.fetchVNDBOnlySnapshot(game.v_id)

    return {
      finalGameData: {},
      finalCharactersData: [],
      finalProducersData: [],
      finalCoversData: [],
    }
  }

  private async reindexGame(gameId: number) {
    const updated = await this.prisma.game.findUnique({
      where: { id: gameId },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  private async fetchVNDBOnlySnapshot(vId: string): Promise<ExternalSnapshot> {
    const normalizedVId = this.ensureVndbPrefix(vId)
    const [rawGameData, rawReleasesData] = await Promise.all([
      this.vndbService.vndbRequest<VNDBGameItemRes>(
        'single',
        ['id', '=', normalizedVId],
        [
          'id',
          'titles{title,lang,latin,main}',
          'aliases',
          'released',
          'description',
          'olang',
          'platforms',
          'screenshots{url,dims,sexual,violence}',
          'va.character{id,aliases,description,name,original,blood_type,height,weight,bust,waist,hips,cup,age,birthday,gender,image{url,sexual,violence},vns{role,id}}',
          'developers{id,name,original,aliases,type,description,extlinks{url,label,name}}',
          'extlinks{url,label,name}',
          'image{url,dims,sexual,violence}',
        ],
        'vn',
      ),
      this.vndbService.vndbRequest<VNDBReleaseItemRes>(
        'multiple',
        ['vn', '=', ['id', '=', normalizedVId]],
        [
          'images{type,photo,id,url,dims,sexual,violence}',
          'languages{lang,title,latin,mtl}',
          'platforms',
          'extlinks{url,label,name}',
        ],
        'release',
        100,
      ),
    ])

    const links = [...(rawGameData.extlinks ?? [])]
    for (const release of rawReleasesData) links.push(...(release.extlinks ?? []))
    const finalGameData: Partial<GameData> = {
      v_id: normalizedVId,
      aliases: rawGameData.aliases ?? [],
      release_date: rawGameData.released ? new Date(rawGameData.released) : undefined,
      intro_en: rawGameData.description,
      platform: rawGameData.platforms as any,
    }
    for (const title of rawGameData.titles ?? []) {
      if (title.lang === 'jp') finalGameData.title_jp = title.title
      if (title.lang === 'zh-Hans') finalGameData.title_zh = title.title
      if (title.lang === 'en') finalGameData.title_en = title.title
    }

    const finalCharactersData = (rawGameData.va ?? []).map(va => ({
      v_id: va.character.id,
      name_jp: va.character.original || va.character.name,
      name_en: va.character.name,
      aliases: va.character.aliases,
      intro_en: va.character.description,
      role: va.character.vns.find(vn => vn.id === normalizedVId)?.role,
      blood_type: va.character.blood_type,
      height: va.character.height,
      weight: va.character.weight,
      bust: va.character.bust,
      waist: va.character.waist,
      hips: va.character.hips,
      cup: va.character.cup,
      age: va.character.age,
      birthday: va.character.birthday,
      gender: va.character.gender,
      image: va.character.image?.url,
    }))
    dedupeCharactersInPlace(finalCharactersData)

    const finalProducersData = (rawGameData.developers ?? []).map(developer => ({
      v_id: developer.id,
      name: developer.original || developer.name || developer.aliases?.[0] || '',
      aliases: developer.aliases,
      intro_en: developer.description,
      website: developer.extlinks?.find(e => e.label === 'Official website')?.url,
    }))
    dedupeDevelopersInPlace(finalProducersData)

    const finalCoversData = this.buildVNDBCovers(rawReleasesData)
    if (finalCoversData.length > 0 && finalCoversData.every(c => c.sexual > 1)) {
      finalGameData.nsfw = true
    }

    return {
      finalGameData: {
        ...finalGameData,
        links: this.uniqueBy(links, link => this.normalizeUrl(link.url)).slice(0, 5),
        images: (rawGameData.screenshots ?? []).map(s => ({
          url: s.url,
          dims: s.dims,
          sexual: s.sexual,
          violence: s.violence,
          source: 'vndb',
          source_key: s.url,
          source_url: s.url,
        })),
      } as Partial<GameData>,
      finalCharactersData,
      finalProducersData,
      finalCoversData,
    }
  }

  private buildVNDBCovers(rawReleasesData: VNDBReleaseItemRes[]) {
    const covers: GameCover[] = []
    for (const release of rawReleasesData) {
      for (const image of release.images ?? []) {
        if (!['pkgfront', 'dig'].includes(image.type)) continue
        covers.push({
          language: this.normalizeCoverLanguage(
            image.languages?.[0] || release.languages?.[0]?.lang,
          ),
          type: image.type,
          url: image.url,
          dims: image.dims,
          sexual: image.sexual,
          violence: image.violence,
          source: 'vndb',
          source_key: image.id || image.url,
          source_url: image.url,
        })
      }
    }
    return this.uniqueBy(covers, c => this.mediaSourceKey(c)).slice(0, 30)
  }

  private async findDeveloperMatches(developers: GameDeveloper[]) {
    const ors = developers.flatMap(d =>
      [
        d.b_id ? { b_id: d.b_id } : undefined,
        d.v_id ? { v_id: d.v_id } : undefined,
        d.name ? { name: d.name } : undefined,
        d.aliases?.length ? { aliases: { hasSome: d.aliases } } : undefined,
      ].filter(Boolean),
    )
    if (ors.length === 0) return []
    return this.prisma.gameDeveloper.findMany({
      where: { OR: ors as any },
      select: { id: true, b_id: true, v_id: true, name: true, aliases: true },
    })
  }

  private matchDeveloper(
    developer: GameDeveloper,
    candidates: Awaited<ReturnType<GameFieldSyncService['findDeveloperMatches']>>,
  ) {
    const exact = candidates.find(
      c =>
        (developer.b_id && c.b_id === developer.b_id) ||
        (developer.v_id && c.v_id === developer.v_id),
    )
    if (exact) return { developer: exact, confidence: 'exact' as SyncCandidateConfidence }

    const names = [developer.name, ...(developer.aliases ?? [])]
      .map(v => this.normalizeText(v))
      .filter(Boolean)
    const nameMatch = candidates.find(c =>
      [c.name, ...(c.aliases ?? [])].some(name => names.includes(this.normalizeText(name))),
    )
    if (nameMatch) return { developer: nameMatch, confidence: 'medium' as SyncCandidateConfidence }
    return undefined
  }

  private async findCharacterMatches(characters: GameCharacter[]) {
    const ors = characters.flatMap(c => {
      const names = [c.name_jp, c.name_zh, c.name_en, ...(c.aliases ?? [])].filter(
        Boolean,
      ) as string[]
      return [
        c.b_id ? { b_id: c.b_id } : undefined,
        c.v_id ? { v_id: c.v_id } : undefined,
        ...names.map(name => ({ OR: [{ name_jp: name }, { name_zh: name }, { name_en: name }] })),
        names.length ? { aliases: { hasSome: names } } : undefined,
      ].filter(Boolean)
    })
    if (ors.length === 0) return []
    return this.prisma.gameCharacter.findMany({
      where: { OR: ors as any },
      select: {
        id: true,
        b_id: true,
        v_id: true,
        name_jp: true,
        name_zh: true,
        name_en: true,
        aliases: true,
      },
    })
  }

  private matchCharacter(
    character: GameCharacter,
    candidates: Awaited<ReturnType<GameFieldSyncService['findCharacterMatches']>>,
  ) {
    const exact = candidates.find(
      c =>
        (character.b_id && c.b_id === character.b_id) ||
        (character.v_id && c.v_id === character.v_id),
    )
    if (exact) return { character: exact, confidence: 'exact' as SyncCandidateConfidence }

    const names = [
      character.name_jp,
      character.name_zh,
      character.name_en,
      ...(character.aliases ?? []),
    ]
      .map(v => this.normalizeText(v))
      .filter(Boolean)
    const nameMatch = candidates.find(c =>
      [c.name_jp, c.name_zh, c.name_en, ...(c.aliases ?? [])].some(name =>
        names.includes(this.normalizeText(name)),
      ),
    )
    if (nameMatch) return { character: nameMatch, confidence: 'medium' as SyncCandidateConfidence }
    return undefined
  }

  private scalarGroupCandidate(
    gameId: number,
    field: GameScalarSyncFieldEnum,
    source: 'bangumi' | 'vndb' | 'merged',
    options: {
      local: Record<string, any>
      remote: Record<string, any>
      title: string
      skipEmptyRemote?: boolean
    },
  ): InternalGameFieldSyncCandidate[] {
    const remote = this.pickDefined(options.remote)
    if (options.skipEmptyRemote && Object.values(remote).every(value => this.isEmptyValue(value)))
      return []
    if (Object.keys(remote).length === 0) return []

    const local = this.pickDefined(
      Object.fromEntries(Object.keys(remote).map(key => [key, options.local[key]])),
    )
    if (this.stableEqual(local, remote)) return []

    return [
      this.candidate(field, 'update', `${gameId}:${field}:${this.hash(remote)}`, {
        source,
        title: options.title,
        subtitle: 'Scalar field group',
        confidence: 'exact',
        defaultSelected: Object.values(local).every(value => this.isEmptyValue(value)),
        local,
        remote,
        apply: { scalar: remote },
      }),
    ]
  }

  private dedupeTagsByCanonical(tags: string[]) {
    const byCanonical = new Map<string, string>()
    for (const rawTag of tags) {
      const canonical = this.gameTagService.normalizeTag(rawTag)
      const display = this.gameTagService.normalizeDisplayTag(rawTag)
      if (!canonical || byCanonical.has(canonical)) continue
      byCanonical.set(canonical, display)
    }
    return [...byCanonical.values()].sort()
  }

  private toPreview(field: SyncPreviewField, candidates: InternalGameFieldSyncCandidate[]) {
    return {
      field,
      generatedAt: new Date().toISOString(),
      summary: {
        total: candidates.length,
        add: candidates.filter(c => c.action === 'add').length,
        update: candidates.filter(c => c.action === 'update').length,
        unmatched: candidates.filter(c => c.action === 'unmatched').length,
        defaultSelected: candidates.filter(c => c.defaultSelected && c.applicable).length,
      },
      candidates: candidates.map(candidate => {
        const publicCandidate = { ...candidate }
        delete publicCandidate.apply
        return publicCandidate
      }),
    }
  }

  private candidate(
    field: SyncPreviewField,
    action: SyncCandidateAction,
    key: string,
    candidate: Omit<GameFieldSyncCandidate, 'id' | 'action' | 'applicable'> &
      Partial<Pick<GameFieldSyncCandidate, 'applicable'>> & { apply?: Record<string, any> },
  ): InternalGameFieldSyncCandidate {
    return {
      id: this.candidateId(field, action, key),
      action,
      applicable: candidate.applicable ?? true,
      ...candidate,
    }
  }

  private candidateId(field: SyncPreviewField, action: SyncCandidateAction, key: string) {
    return `${field}:${action}:${this.hash(key)}`
  }

  private hash(value: unknown) {
    return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)
  }

  private normalizeUrl(url?: string) {
    if (!url) return ''
    try {
      const parsed = new URL(url.trim())
      parsed.hash = ''
      parsed.hostname = parsed.hostname.toLowerCase()
      return parsed.toString().replace(/\/$/, '')
    } catch {
      return url.trim().replace(/\/$/, '')
    }
  }

  private normalizeText(value?: string | null) {
    return (value ?? '').trim().toLowerCase()
  }

  private pickDefined<T extends Record<string, any>>(value: T) {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    ) as Partial<T>
  }

  private pickNonEmpty<T extends Record<string, any>>(value: T) {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => !this.isEmptyValue(item)),
    ) as Partial<T>
  }

  private normalizeCoverLanguage(language?: string | null) {
    if (!language) return 'other'
    const lang = language.toLowerCase()
    if (lang.includes('zh')) return 'zh'
    if (lang.includes('ja') || lang.includes('jp')) return 'jp'
    if (lang.includes('en')) return 'en'
    return 'other'
  }

  private stripVndbPrefix(vId?: string) {
    return vId?.replace(/^v/, '')
  }

  private ensureVndbPrefix(vId: string) {
    return vId.startsWith('v') ? vId : `v${vId}`
  }

  private sameMedia(
    local: {
      url: string
      source?: string | null
      source_key?: string | null
      source_url?: string | null
    },
    remote: { url: string; source?: string; source_key?: string; source_url?: string },
  ) {
    return (
      (!!remote.source &&
        !!remote.source_key &&
        local.source === remote.source &&
        local.source_key === remote.source_key) ||
      (!!remote.source_url && local.source_url === remote.source_url) ||
      this.normalizeUrl(local.url) === this.normalizeUrl(remote.url)
    )
  }

  private mediaFieldsChanged(
    local: { dims: number[]; sexual: number; violence: number; [key: string]: any },
    remote: { dims: number[]; sexual: number; violence: number; [key: string]: any },
  ) {
    return (
      JSON.stringify(local.dims ?? []) !== JSON.stringify(remote.dims ?? []) ||
      local.sexual !== remote.sexual ||
      local.violence !== remote.violence ||
      (remote.language && local.language !== remote.language) ||
      (remote.type && local.type !== remote.type) ||
      (remote.source && local.source !== remote.source) ||
      (remote.source_key && local.source_key !== remote.source_key) ||
      (remote.source_url && local.source_url !== remote.source_url)
    )
  }

  private mediaSourceKey(media: {
    source?: string
    source_key?: string
    source_url?: string
    url: string
  }) {
    return `${media.source ?? 'url'}:${media.source_key ?? media.source_url ?? this.normalizeUrl(media.url)}`
  }

  private formatDims(dims?: number[]) {
    return dims?.length === 2 ? `${dims[0]}x${dims[1]}` : ''
  }

  private isEmptyDims(dims?: number[]) {
    return !dims?.length || dims.every(v => v === 0)
  }

  private isEmptyValue(value: unknown) {
    return (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    )
  }

  private stableEqual(a: unknown, b: unknown) {
    return JSON.stringify(this.sortJson(a)) === JSON.stringify(this.sortJson(b))
  }

  private sortJson(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => this.sortJson(item))
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, this.sortJson(item)]),
    )
  }

  private validDate(value?: Date | null) {
    return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null
  }

  private characterDisplayName(
    character?: {
      name_jp?: string | null
      name_zh?: string | null
      name_en?: string | null
    } | null,
  ) {
    return character?.name_zh || character?.name_jp || character?.name_en || ''
  }

  private externalEntityKey(entity: {
    b_id?: string
    v_id?: string
    name?: string
    name_jp?: string
  }) {
    return entity.b_id
      ? `bangumi:${entity.b_id}`
      : entity.v_id
        ? `vndb:${entity.v_id}`
        : `name:${this.normalizeText(entity.name ?? entity.name_jp)}`
  }

  private isImportantCharacterRole(role?: string) {
    return role === GameCharacterRole.MAIN || role === GameCharacterRole.PRIMARY
  }

  private uniqueBy<T>(items: T[], getKey: (item: T) => string) {
    const map = new Map<string, T>()
    for (const item of items) {
      const key = getKey(item)
      if (!map.has(key)) map.set(key, item)
    }
    return [...map.values()]
  }
}
