import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import {
  EditGameReqDto,
  GameLinkDto,
  EditGameLinkDto,
  EditGameCoverDto,
  GameCoverDto,
  EditGameImageDto,
  GameImageDto,
  GameDeveloperRelationDto,
  EditGameDeveloperDto,
  GameCharacterRelationDto,
  EditGameCharacterDto,
} from '../dto/req/edit-game.req.dto'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { EditActionType } from '../../edit/enums/edit-action-type.enum'
import { EditRelationType } from '../../edit/enums/edit-relation-type.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { pickChanges } from '../helpers/pick-changes'
import { gameRequiredBits } from '../../edit/resolvers/permisson-resolver'
import { formatDoc, rawDataQuery } from '../../search/helpers/format-doc'
import { GameData } from '../interfaces/game.interface'
import { SearchEngine, SEARCH_ENGINE } from '../../search/interfaces/search.interface'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { S3Service } from '../../s3/services/s3.service'
import { IMAGE_STORAGE } from '../../s3/constants/s3.constants'

@Injectable()
export class GameEditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEARCH_ENGINE) private readonly searchEngine: SearchEngine,
    private readonly activityService: ActivityService,
    @Inject(IMAGE_STORAGE) private readonly imageStorage: S3Service,
  ) {}

  async editGameScalar(id: number, dto: EditGameReqDto, req: RequestWithUser) {
    const game = await this.prisma.game.findUnique({
      where: { id },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    const { note, ...rest } = dto
    const { before, after, field_changes } = pickChanges(rest, game)
    if (field_changes.length === 0) return

    const bits = gameRequiredBits(after)
    const field_mask = bits.reduce((m, b) => m | (1n << BigInt(b)), 0n)

    await this.prisma.$transaction(async tx => {
      await tx.game.update({
        where: { id },
        data: {
          ...rest,
          extra_info: dto.extra_info ? (dto.extra_info as any) : undefined,
          staffs: dto.staffs ? (dto.staffs as any) : undefined,
        },
      })

      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.UPDATE_SCALAR,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          field_mask,
          changes: { before, after } as any,
          field_changes,
          note,
        },
        select: { id: true },
      })

      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id: game.id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async editLinks(id: number, links: EditGameLinkDto[], req: RequestWithUser) {
    const linksToEdit = await this.prisma.gameLink.findMany({
      where: { game_id: id, id: { in: links.map(l => l.id) } },
      select: { id: true, url: true, label: true, name: true },
    })
    if (linksToEdit.length === 0) return

    await this.prisma.$transaction(async tx => {
      await tx.gameLink.updateMany({
        where: { game_id: id, id: { in: links.map(l => l.id) } },
        data: links.map(l => ({ url: l.url, label: l.label, name: l.name })),
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.UPDATE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.LINK,
          field_changes: ['links'],
          changes: {
            relation: 'links',
            before: linksToEdit,
            after: links.map(l => ({ id: l.id, url: l.url, label: l.label, name: l.name })),
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })
  }

  async addLinks(id: number, links: GameLinkDto[], req: RequestWithUser) {
    const exisited = await this.prisma.gameLink.findMany({
      where: { game_id: id },
      select: { url: true, label: true, name: true },
    })
    const uniqueLinks = links.filter(l => !exisited.some(e => e.url === l.url))
    if (uniqueLinks.length === 0) return

    await this.prisma.$transaction(async tx => {
      await tx.gameLink.createMany({
        data: uniqueLinks.map(l => ({ game_id: id, url: l.url, label: l.label, name: l.name })),
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.ADD_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.LINK,
          field_changes: ['links'],
          changes: { relation: 'links', added: uniqueLinks } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })
  }

  async removeLinks(id: number, links: number[], req: RequestWithUser) {
    const linksToRemove = await this.prisma.gameLink.findMany({
      where: { game_id: id, id: { in: links } },
      select: { id: true, url: true, label: true, name: true },
    })
    if (linksToRemove.length === 0) return

    await this.prisma.$transaction(async tx => {
      await tx.gameLink.deleteMany({ where: { game_id: id, id: { in: links } } })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.REMOVE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.LINK,
          field_changes: ['links'],
          changes: { relation: 'links', removed: linksToRemove } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })
  }

  async editCovers(id: number, covers: EditGameCoverDto[], req: RequestWithUser) {
    for (const cover of covers) {
      await this.editCover(id, cover, req)
    }

    const game = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })

    await this.searchEngine.upsertGame(formatDoc(game as unknown as GameData))
  }

  async editCover(id: number, cover: EditGameCoverDto, req: RequestWithUser) {
    const coverToEdit = await this.prisma.gameCover.findUnique({
      where: { game_id: id, id: cover.id },
      select: {
        id: true,
        url: true,
        type: true,
        dims: true,
        sexual: true,
        violence: true,
        language: true,
      },
    })
    if (!coverToEdit) return
    const { field_changes } = pickChanges(cover, coverToEdit)
    if (field_changes.length === 0) return

    await this.prisma.$transaction(async tx => {
      const updated = await tx.gameCover.update({
        where: { id: cover.id },
        data: cover,
        select: {
          id: true,
          url: true,
          type: true,
          dims: true,
          sexual: true,
          violence: true,
          language: true,
        },
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.UPDATE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.COVER,
          field_changes: ['covers'],
          changes: {
            relation: 'covers',
            before: [coverToEdit],
            after: [updated],
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async addCovers(id: number, covers: GameCoverDto[], req: RequestWithUser) {
    const exisited = await this.prisma.gameCover.findMany({
      where: { game_id: id },
      select: { url: true, type: true, dims: true, sexual: true, violence: true },
    })
    const uniqueCovers = covers.filter(c => !exisited.some(e => e.url === c.url))
    if (uniqueCovers.length === 0) return

    await this.prisma.$transaction(async tx => {
      await tx.gameCover.createMany({
        data: uniqueCovers.map(c => ({
          game_id: id,
          language: c.language,
          url: c.url,
          type: c.type,
          dims: c.dims,
          sexual: c.sexual,
          violence: c.violence,
        })),
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.ADD_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.COVER,
          field_changes: ['covers'],
          changes: { relation: 'covers', added: uniqueCovers } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async removeCovers(id: number, covers: number[], req: RequestWithUser) {
    const coversToRemove = await this.prisma.gameCover.findMany({
      where: { game_id: id, id: { in: covers } },
      select: { id: true, url: true, type: true, dims: true, sexual: true, violence: true },
    })
    if (coversToRemove.length === 0) return

    const existing = await this.prisma.gameCover.findMany({
      where: { game_id: id },
    })
    if (existing.length <= 1) throw new ShionBizException(ShionBizCode.GAME_COVER_MIN_ONE_REQUIRED)

    await this.prisma.$transaction(async tx => {
      await tx.gameCover.deleteMany({ where: { game_id: id, id: { in: covers } } })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.REMOVE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.COVER,
          field_changes: ['covers'],
          changes: { relation: 'covers', removed: coversToRemove } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    for (const cover of coversToRemove) {
      await this.imageStorage.deleteFile(cover.url, false)
    }

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async editImages(id: number, images: EditGameImageDto[], req: RequestWithUser) {
    for (const image of images) {
      await this.editImage(id, image, req)
    }

    const game = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })

    await this.searchEngine.upsertGame(formatDoc(game as unknown as GameData))
  }

  async editImage(id: number, image: EditGameImageDto, req: RequestWithUser) {
    const imageToEdit = await this.prisma.gameImage.findUnique({
      where: { id: image.id },
      select: {
        id: true,
        url: true,
        dims: true,
        sexual: true,
        violence: true,
        game_id: true,
      },
    })
    if (!imageToEdit || imageToEdit.game_id !== id) return
    if (!imageToEdit) return
    const { field_changes } = pickChanges(image, imageToEdit)
    if (field_changes.length === 0) return

    await this.prisma.$transaction(async tx => {
      const updated = await tx.gameImage.update({
        where: { id: image.id },
        data: image,
        select: {
          id: true,
          url: true,
          dims: true,
          sexual: true,
          violence: true,
        },
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.UPDATE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.IMAGE,
          field_changes: ['images'],
          changes: {
            relation: 'images',
            before: [imageToEdit],
            after: [updated],
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async addImages(id: number, images: GameImageDto[], req: RequestWithUser) {
    const exisited = await this.prisma.gameImage.findMany({
      where: { game_id: id },
      select: { url: true, dims: true, sexual: true, violence: true },
    })
    const uniqueImages = images.filter(i => !exisited.some(e => e.url === i.url))
    if (uniqueImages.length === 0) return

    await this.prisma.$transaction(async tx => {
      await tx.gameImage.createMany({
        data: uniqueImages.map(i => ({
          game_id: id,
          url: i.url,
          dims: i.dims,
          sexual: i.sexual,
          violence: i.violence,
        })),
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.ADD_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.IMAGE,
          field_changes: ['images'],
          changes: { relation: 'images', added: uniqueImages } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async removeImages(id: number, images: number[], req: RequestWithUser) {
    const imagesToRemove = await this.prisma.gameImage.findMany({
      where: { game_id: id, id: { in: images } },
      select: { id: true, url: true, dims: true, sexual: true, violence: true },
    })
    if (imagesToRemove.length === 0) return

    await this.prisma.$transaction(async tx => {
      await tx.gameImage.deleteMany({ where: { game_id: id, id: { in: images } } })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.REMOVE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.IMAGE,
          field_changes: ['images'],
          changes: { relation: 'images', removed: imagesToRemove } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    for (const image of imagesToRemove) {
      await this.imageStorage.deleteFile(image.url, false)
    }

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async addDevelopers(id: number, developers: GameDeveloperRelationDto[], req: RequestWithUser) {
    const game = await this.prisma.game.findUnique({ where: { id }, select: { id: true } })
    if (!game) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)

    const existing = await this.prisma.gameDeveloperRelation.findMany({
      where: { game_id: id },
      select: { developer_id: true },
    })
    const existingIds = new Set(existing.map(e => e.developer_id))
    const uniqueDevelopers = developers
      .filter(d => !existingIds.has(d.developer_id))
      .map(d => ({
        game_id: id,
        developer_id: d.developer_id,
        role: d.role ?? null,
      }))
    if (uniqueDevelopers.length === 0) return

    const uniqueDevelopersWithNames = await Promise.all(
      uniqueDevelopers.map(async d => {
        const developer = await this.prisma.gameDeveloper.findUnique({
          where: { id: d.developer_id },
          select: { name: true },
        })
        return {
          ...d,
          developer: { name: developer?.name ?? null },
        }
      }),
    )

    await this.prisma.$transaction(async tx => {
      await tx.gameDeveloperRelation.createMany({
        data: uniqueDevelopersWithNames.map(d => ({
          game_id: id,
          developer_id: d.developer_id,
          role: d.role ?? null,
        })),
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.ADD_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.DEVELOPER,
          field_changes: ['developers'],
          changes: {
            relation: 'developers',
            added: uniqueDevelopersWithNames.map(d => ({
              role: d.role,
              developer_id: d.developer_id,
              developer: { name: d.developer.name },
            })),
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async removeDevelopers(id: number, relationIds: number[], req: RequestWithUser) {
    const relationsToRemove = await this.prisma.gameDeveloperRelation.findMany({
      where: { game_id: id, id: { in: relationIds } },
      select: { id: true, developer_id: true, role: true, developer: { select: { name: true } } },
    })
    if (relationsToRemove.length === 0) return

    const existing = await this.prisma.gameDeveloperRelation.findMany({
      where: { game_id: id },
      select: { developer_id: true },
    })
    const existingIds = new Set(existing.map(e => e.developer_id))
    if (existingIds.size <= 1)
      throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_MIN_ONE_REQUIRED)

    await this.prisma.$transaction(async tx => {
      await tx.gameDeveloperRelation.deleteMany({
        where: { game_id: id, id: { in: relationIds } },
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.REMOVE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.DEVELOPER,
          field_changes: ['developers'],
          changes: {
            relation: 'developers',
            removed: relationsToRemove.map(r => ({
              role: r.role,
              developer_id: r.developer_id,
              developer: { name: r.developer.name },
            })),
          },
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async editDevelopers(id: number, developers: EditGameDeveloperDto[], req: RequestWithUser) {
    for (const developer of developers) {
      await this.editDeveloper(id, developer, req)
    }

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async editDeveloper(id: number, developer: EditGameDeveloperDto, req: RequestWithUser) {
    const relationToEdit = await this.prisma.gameDeveloperRelation.findUnique({
      where: { id: developer.id },
      select: {
        id: true,
        developer_id: true,
        role: true,
        game_id: true,
        developer: { select: { name: true } },
      },
    })
    if (!relationToEdit || relationToEdit.game_id !== id) return

    const { field_changes } = pickChanges({ role: developer.role }, relationToEdit)
    if (field_changes.length === 0) return

    await this.prisma.$transaction(async tx => {
      const updated = await tx.gameDeveloperRelation.update({
        where: { id: developer.id },
        data: { role: developer.role ?? null },
        select: { id: true, developer_id: true, role: true, developer: { select: { name: true } } },
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.UPDATE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.DEVELOPER,
          field_changes: ['developers'],
          changes: {
            relation: 'developers',
            before: [
              {
                role: relationToEdit.role,
                developer_id: relationToEdit.developer_id,
                developer: { name: relationToEdit.developer.name },
              },
            ],
            after: [
              {
                role: updated.role,
                developer_id: updated.developer_id,
                developer: { name: updated.developer.name },
              },
            ],
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })
  }

  async addCharacters(id: number, characters: GameCharacterRelationDto[], req: RequestWithUser) {
    const game = await this.prisma.game.findUnique({ where: { id }, select: { id: true } })
    if (!game) throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)

    const existing = await this.prisma.gameCharacterRelation.findMany({
      where: { game_id: id },
      select: { character_id: true },
    })
    const existingIds = new Set(existing.map(e => e.character_id))
    const uniqueCharacters = characters
      .filter(c => !existingIds.has(c.character_id))
      .map(c => ({
        game_id: id,
        character_id: c.character_id,
        role: c.role ?? null,
        image: c.image ?? null,
        actor: c.actor ?? null,
      }))
    if (uniqueCharacters.length === 0) return

    const uniqueCharactersWithNames = await Promise.all(
      uniqueCharacters.map(async c => {
        const character = await this.prisma.gameCharacter.findUnique({
          where: { id: c.character_id },
          select: { name_jp: true },
        })
        return {
          ...c,
          character: { name: character?.name_jp ?? null },
        }
      }),
    )

    await this.prisma.$transaction(async tx => {
      await tx.gameCharacterRelation.createMany({
        data: uniqueCharactersWithNames.map(c => ({
          game_id: id,
          character_id: c.character_id,
          role: c.role ?? null,
          image: c.image ?? null,
          actor: c.actor ?? null,
        })),
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.ADD_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.CHARACTER,
          field_changes: ['characters'],
          changes: {
            relation: 'characters',
            added: uniqueCharactersWithNames.map(c => ({
              role: c.role,
              character_id: c.character_id,
              character: { name: c.character.name },
            })),
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async removeCharacters(id: number, relationIds: number[], req: RequestWithUser) {
    const relationsToRemove = await this.prisma.gameCharacterRelation.findMany({
      where: { game_id: id, id: { in: relationIds } },
      select: {
        id: true,
        role: true,
        image: true,
        actor: true,
        character: { select: { id: true, name_jp: true, name_zh: true, name_en: true } },
      },
    })
    if (relationsToRemove.length === 0) return

    const existing = await this.prisma.gameCharacterRelation.findMany({
      where: { game_id: id },
      select: { character_id: true },
    })
    const existingIds = new Set(existing.map(e => e.character_id))
    if (existingIds.size <= 1)
      throw new ShionBizException(ShionBizCode.GAME_CHARACTER_MIN_ONE_REQUIRED)

    await this.prisma.$transaction(async tx => {
      await tx.gameCharacterRelation.deleteMany({ where: { game_id: id, id: { in: relationIds } } })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.REMOVE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.CHARACTER,
          field_changes: ['characters'],
          changes: relationsToRemove.map(r => ({
            id: r.id,
            role: r.role,
            image: r.image,
            actor: r.actor,
            character: {
              name_jp: r.character.name_jp,
              name_zh: r.character.name_zh,
              name_en: r.character.name_en,
            },
          })),
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })

    const updated = await this.prisma.game.findUnique({
      where: { id },
      select: rawDataQuery,
    })
    await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
  }

  async editCharacters(id: number, characters: EditGameCharacterDto[], req: RequestWithUser) {
    for (const character of characters) {
      await this.editCharacter(id, character, req)
    }
  }

  async editCharacter(id: number, character: EditGameCharacterDto, req: RequestWithUser) {
    const relationToEdit = await this.prisma.gameCharacterRelation.findUnique({
      where: { id: character.id },
      select: {
        id: true,
        role: true,
        image: true,
        actor: true,
        game_id: true,
        character: { select: { id: true, name_jp: true, name_zh: true, name_en: true } },
      },
    })
    if (!relationToEdit || relationToEdit.game_id !== id) return

    const { field_changes } = pickChanges(
      { role: character.role, image: character.image, actor: character.actor },
      relationToEdit,
    )
    if (field_changes.length === 0) return

    await this.prisma.$transaction(async tx => {
      const updated = await tx.gameCharacterRelation.update({
        where: { id: character.id },
        data: {
          role: character.role,
          image: character.image,
          actor: character.actor,
        },
        select: {
          id: true,
          role: true,
          image: true,
          actor: true,
          character: { select: { id: true, name_jp: true, name_zh: true, name_en: true } },
        },
      })
      const editRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.UPDATE_RELATION,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          relation_type: EditRelationType.CHARACTER,
          field_changes: ['characters'],
          changes: {
            relation: 'characters',
            before: [
              {
                role: relationToEdit.role,
                image: relationToEdit.image,
                actor: relationToEdit.actor,
                character: {
                  name_jp: relationToEdit.character.name_jp,
                  name_zh: relationToEdit.character.name_zh,
                  name_en: relationToEdit.character.name_en,
                },
              },
            ],
            after: [
              {
                role: updated.role,
                image: updated.image,
                actor: updated.actor,
                character: {
                  name_jp: updated.character.name_jp,
                  name_zh: updated.character.name_zh,
                  name_en: updated.character.name_en,
                },
              },
            ],
          } as any,
        },
        select: { id: true },
      })
      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: editRecord.id,
        },
        tx,
      )
    })
  }
}
