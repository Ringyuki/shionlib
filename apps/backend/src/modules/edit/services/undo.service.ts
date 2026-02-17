import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { Prisma } from '@prisma/client'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { PermissionEntity } from '../enums/permission-entity.enum'
import { EditActionType } from '../enums/edit-action-type.enum'
import { EditRelationType } from '../enums/edit-relation-type.enum'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'
import { SearchEngine, SEARCH_ENGINE } from '../../search/interfaces/search.interface'
import { GameData } from '../../game/interfaces/game.interface'
import { formatDoc, rawDataQuery } from '../../search/helpers/format-doc'
import { UndoReqDto } from '../dto/req/undo.req.dto'
import { extractRelationId, extractRelationKey } from '../helpers/undo'
import { UndoMode } from '../enums/undo.enum'
import { ScalarChanges, RelationChanges } from '../interfaces/undo.interface'
import { S3Service } from '../../s3/services/s3.service'
import { IMAGE_STORAGE } from '../../s3/constants/s3.constants'

@Injectable()
export class UndoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    @Inject(SEARCH_ENGINE) private readonly searchEngine: SearchEngine,
    @Inject(IMAGE_STORAGE) private readonly imageStorage: S3Service,
  ) {}

  async undo(editRecordId: number, req: RequestWithUser, dto: UndoReqDto) {
    const target = await this.prisma.editRecord.findUnique({
      where: { id: editRecordId },
      select: {
        id: true,
        entity: true,
        target_id: true,
        action: true,
        relation_type: true,
        field_changes: true,
        changes: true,
        created: true,
        updated: true,
      },
    })
    if (!target) throw new ShionBizException(ShionBizCode.EDIT_RECORD_NOT_FOUND)

    const alreadyUndo = await this.prisma.editRecord.findFirst({
      where: { undo_of_id: target.id },
      select: { id: true },
    })
    if (alreadyUndo) throw new ShionBizException(ShionBizCode.EDIT_RECORD_ALREADY_UNDONE)

    const { mode, force, dryRun } = dto
    const laterRecords = await this.prisma.editRecord.findMany({
      where: {
        entity: target.entity,
        target_id: target.target_id,
        created: { gt: target.created },
        undo: false,
        undone_by: null,
      },
      orderBy: { created: 'asc' },
      select: {
        id: true,
        entity: true,
        target_id: true,
        action: true,
        relation_type: true,
        field_changes: true,
        changes: true,
        created: true,
      },
    })
    const overlapping = laterRecords.filter(r => this.isOverlap(target, r))
    if (mode === UndoMode.STRICT && overlapping.length > 0 && !force) {
      throw new ShionBizException(ShionBizCode.EDIT_RECORD_CONFLICT)
    }
    if (dryRun) {
      return {
        target: target.id,
        mode,
        willUndo: [
          target.id,
          ...(mode === UndoMode.CASCADE ? overlapping.map(o => o.id).reverse() : []),
        ],
        conflicts: overlapping.map(o => o.id),
      }
    }

    if (mode === UndoMode.CASCADE) {
      // cascade mode
      // undo the overlapping records in reverse order, and then undo the target record
      const chain = [...overlapping].reverse().concat([target])
      await this.prisma.$transaction(async tx => {
        for (const rec of chain) {
          await this.applyInverse(tx, rec, req)
        }
      })
      await this.refreshIndex(target.entity as PermissionEntity, target.target_id)
      return
    }

    // strict mode
    // only undo the target record
    await this.prisma.$transaction(async tx => {
      await this.applyInverse(tx, target, req)
    })
    await this.refreshIndex(target.entity as PermissionEntity, target.target_id)
  }

  private isOverlap(a: any, b: any): boolean {
    if (a.entity !== b.entity || a.target_id !== b.target_id) return false

    const actionA: EditActionType = a.action
    const actionB: EditActionType = b.action

    // scalar
    // if the field changes of two records have any intersection, they are conflicting
    if (actionA === EditActionType.UPDATE_SCALAR || actionB === EditActionType.UPDATE_SCALAR) {
      const setA = new Set<string>(a.field_changes ?? [])
      const setB = new Set<string>(b.field_changes ?? [])
      for (const k of setA) if (setB.has(k)) return true
      // if one is scalar and the other is relation, they are usually not conflicting
      if (
        actionA === EditActionType.UPDATE_SCALAR &&
        [
          EditActionType.ADD_RELATION,
          EditActionType.REMOVE_RELATION,
          EditActionType.UPDATE_RELATION,
          EditActionType.SET_RELATION,
        ].includes(actionB)
      ) {
        return false
      }
      if (
        actionB === EditActionType.UPDATE_SCALAR &&
        [
          EditActionType.ADD_RELATION,
          EditActionType.REMOVE_RELATION,
          EditActionType.UPDATE_RELATION,
          EditActionType.SET_RELATION,
        ].includes(actionA)
      ) {
        return false
      }
    }

    // relation
    // they are conflicting only if the relation type is the same
    if (a.relation_type !== b.relation_type) return false

    // UPDATE_RELATION
    // they are conflicting only if the id is the same
    if (actionA === EditActionType.UPDATE_RELATION || actionB === EditActionType.UPDATE_RELATION) {
      const idsA = extractRelationId(a.changes)
      const idsB = extractRelationId(b.changes)
      return idsA.some(id => idsB.includes(id))
    }

    // ADD / REMOVE / SET
    // they are conflicting only if the id or unique key is the same
    const keysA = extractRelationKey(a.changes)
    const keysB = extractRelationKey(b.changes)
    return keysA.some(k => keysB.includes(k))
  }

  private async applyInverse(tx: Prisma.TransactionClient, rec: any, req: RequestWithUser) {
    if (rec.entity === PermissionEntity.GAME) {
      await this.inverseGame(tx, rec, req)
      return
    }
    if (rec.entity === PermissionEntity.DEVELOPER) {
      await this.inverseDeveloper(tx, rec, req)
      return
    }
    if (rec.entity === PermissionEntity.CHARACTER) {
      await this.inverseCharacter(tx, rec, req)
      return
    }
    throw new ShionBizException(ShionBizCode.COMMON_NOT_IMPLEMENTED)
  }

  private async inverseGame(tx: Prisma.TransactionClient, rec: any, req: RequestWithUser) {
    const id = rec.target_id as number
    const action: EditActionType = rec.action
    const relation: EditRelationType | null = rec.relation_type
    const changes = rec.changes as ScalarChanges | RelationChanges | null

    if (action === EditActionType.UPDATE_SCALAR) {
      const before = (changes as ScalarChanges)?.before ?? {}
      const data = before as Record<string, unknown>

      if (Object.keys(data).length > 0) {
        await tx.game.update({ where: { id }, data })
      }

      const afterNow = Object.keys(data).length > 0 ? data : {}
      const undoRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.GAME,
          target_id: id,
          action: EditActionType.UPDATE_SCALAR,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          field_changes: Object.keys(data),
          changes: { before: (changes as ScalarChanges)?.after ?? {}, after: afterNow } as any,
          note: `undo of #${rec.id}`,
          undo: true,
          undo_of_id: rec.id,
        },
        select: { id: true },
      })

      await this.activityService.create(
        {
          type: ActivityType.GAME_EDIT,
          user_id: req.user.sub,
          game_id: id,
          edit_record_id: undoRecord.id,
        },
        tx,
      )
      return
    }

    if (relation === EditRelationType.LINK) {
      if (action === EditActionType.ADD_RELATION) {
        const added = (changes as RelationChanges)?.added ?? []
        // if has id, delete by id, otherwise delete by unique key
        const ids = added.map(a => a.id).filter((v: any) => typeof v === 'number')
        if (ids.length > 0)
          await tx.gameLink.deleteMany({ where: { game_id: id, id: { in: ids } } })
        const withoutId = added.filter(a => typeof a.id !== 'number')
        for (const a of withoutId) {
          await tx.gameLink.deleteMany({
            where: { game_id: id, url: a.url ?? '', label: a.label ?? '', name: a.name ?? '' },
          })
        }
        const undoRecord = await tx.editRecord.create({
          data: {
            entity: PermissionEntity.GAME,
            target_id: id,
            action: EditActionType.REMOVE_RELATION,
            actor_id: req.user.sub,
            actor_role: req.user.role,
            relation_type: EditRelationType.LINK,
            field_changes: ['links'],
            changes: { relation: 'links', removed: added },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }

      if (action === EditActionType.REMOVE_RELATION) {
        const removed = (changes as RelationChanges)?.removed ?? []
        if (removed.length > 0) {
          await tx.gameLink.createMany({
            data: removed.map((l: any) => ({
              game_id: id,
              url: l.url,
              label: l.label,
              name: l.name,
            })),
          })
        }
        const undoRecord = await tx.editRecord.create({
          data: {
            entity: PermissionEntity.GAME,
            target_id: id,
            action: EditActionType.ADD_RELATION,
            actor_id: req.user.sub,
            actor_role: req.user.role,
            relation_type: EditRelationType.LINK,
            field_changes: ['links'],
            changes: { relation: 'links', added: removed },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }

      if (action === EditActionType.UPDATE_RELATION) {
        const before = (changes as RelationChanges)?.before?.[0]
        if (before?.id) {
          await tx.gameLink.update({
            where: { id: before.id },
            data: { url: before.url, label: before.label, name: before.name },
          })
        }
        const undoRecord = await tx.editRecord.create({
          data: {
            entity: PermissionEntity.GAME,
            target_id: id,
            action: EditActionType.UPDATE_RELATION,
            actor_id: req.user.sub,
            actor_role: req.user.role,
            relation_type: EditRelationType.LINK,
            field_changes: ['links'],
            changes: { relation: 'links', after: before ? [before] : [] },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }
    }

    if (relation === EditRelationType.COVER) {
      if (action === EditActionType.UPDATE_RELATION) {
        const before = (changes as RelationChanges)?.before?.[0]
        const after = (changes as RelationChanges)?.after?.[0]
        if (before?.id) {
          await tx.gameCover.update({
            where: { id: before.id },
            data: {
              url: before.url,
              type: before.type,
              dims: before.dims,
              sexual: before.sexual,
              violence: before.violence,
              language: before.language,
            },
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
        }
        const undoRecord = await tx.editRecord.create({
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
              before: [after],
              after: [before],
            },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }
    }

    if (relation === EditRelationType.IMAGE) {
      if (action === EditActionType.ADD_RELATION) {
        const added = (changes as RelationChanges)?.added ?? []
        const ids = added.map(a => a.id).filter((v: any) => typeof v === 'number')
        if (ids.length > 0)
          await tx.gameImage.deleteMany({ where: { game_id: id, id: { in: ids } } })
        const withoutId = added.filter(a => typeof a.id !== 'number')
        for (const a of withoutId) {
          await tx.gameImage.deleteMany({
            where: { game_id: id, url: a.url ?? '' },
          })
        }
        const undoRecord = await tx.editRecord.create({
          data: {
            entity: PermissionEntity.GAME,
            target_id: id,
            action: EditActionType.REMOVE_RELATION,
            actor_id: req.user.sub,
            actor_role: req.user.role,
            relation_type: EditRelationType.IMAGE,
            field_changes: ['images'],
            changes: { relation: 'images', removed: added },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }

      if (action === EditActionType.REMOVE_RELATION) {
        const removed = (changes as RelationChanges)?.removed ?? []
        if (removed.length > 0) {
          await tx.gameImage.createMany({
            data: removed.map((i: any) => ({
              game_id: id,
              url: i.url,
              dims: i.dims,
              sexual: i.sexual,
              violence: i.violence,
            })),
          })
        }
        const undoRecord = await tx.editRecord.create({
          data: {
            entity: PermissionEntity.GAME,
            target_id: id,
            action: EditActionType.ADD_RELATION,
            actor_id: req.user.sub,
            actor_role: req.user.role,
            relation_type: EditRelationType.IMAGE,
            field_changes: ['images'],
            changes: { relation: 'images', added: removed },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }

      if (action === EditActionType.UPDATE_RELATION) {
        const before = (changes as RelationChanges)?.before?.[0]
        const after = (changes as RelationChanges)?.after?.[0]
        if (before?.id) {
          await tx.gameImage.update({
            where: { id: before.id },
            data: {
              url: before.url,
              dims: before.dims,
              sexual: before.sexual,
              violence: before.violence,
            },
            select: {
              id: true,
              url: true,
              dims: true,
              sexual: true,
              violence: true,
            },
          })
        }
        const undoRecord = await tx.editRecord.create({
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
              before: [after],
              after: [before],
            },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }
    }

    if (relation === EditRelationType.DEVELOPER) {
      if (action === EditActionType.ADD_RELATION) {
        const added = (changes as RelationChanges)?.added ?? []
        for (const a of added) {
          await tx.gameDeveloperRelation.deleteMany({
            where: { game_id: id, developer_id: a.developer_id },
          })
        }
        const undoRecord = await tx.editRecord.create({
          data: {
            entity: PermissionEntity.GAME,
            target_id: id,
            action: EditActionType.REMOVE_RELATION,
            actor_id: req.user.sub,
            actor_role: req.user.role,
            relation_type: EditRelationType.DEVELOPER,
            field_changes: ['developers'],
            changes: { relation: 'developers', removed: added },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }

      if (action === EditActionType.REMOVE_RELATION) {
        const removed = (changes as RelationChanges)?.removed ?? []
        if (removed.length > 0) {
          await tx.gameDeveloperRelation.createMany({
            data: removed.map((r: any) => ({
              game_id: id,
              developer_id: r.developer_id,
              role: r.role ?? null,
            })),
            skipDuplicates: true,
          })
        }
        const undoRecord = await tx.editRecord.create({
          data: {
            entity: PermissionEntity.GAME,
            target_id: id,
            action: EditActionType.ADD_RELATION,
            actor_id: req.user.sub,
            actor_role: req.user.role,
            relation_type: EditRelationType.DEVELOPER,
            field_changes: ['developers'],
            changes: { relation: 'developers', added: removed },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }

      if (action === EditActionType.UPDATE_RELATION) {
        const before = (changes as RelationChanges)?.before?.[0]
        const after = (changes as RelationChanges)?.after?.[0]
        if (before?.id) {
          await tx.gameDeveloperRelation.update({
            where: { game_id_developer_id: { game_id: id, developer_id: before.developer_id } },
            data: { role: before.role ?? null },
          })
        }
        const undoRecord = await tx.editRecord.create({
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
              before: [after],
              after: [before],
            },
            note: `undo of #${rec.id}`,
            undo: true,
            undo_of_id: rec.id,
          },
          select: { id: true },
        })
        await this.activityService.create(
          {
            type: ActivityType.GAME_EDIT,
            user_id: req.user.sub,
            game_id: id,
            edit_record_id: undoRecord.id,
          },
          tx,
        )
        return
      }
    }

    // TODO: later extend character
    throw new ShionBizException(ShionBizCode.COMMON_NOT_IMPLEMENTED)
  }

  private async inverseDeveloper(tx: Prisma.TransactionClient, rec: any, req: RequestWithUser) {
    const id = rec.target_id as number
    const action: EditActionType = rec.action
    const changes = rec.changes as ScalarChanges | null

    if (action === EditActionType.UPDATE_SCALAR) {
      const before = changes?.before ?? {}
      const data = before as Record<string, unknown>

      if (Object.keys(data).length > 0) {
        await tx.gameDeveloper.update({ where: { id }, data })
      }

      const afterNow = Object.keys(data).length > 0 ? data : {}
      const undoRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.DEVELOPER,
          target_id: id,
          action: EditActionType.UPDATE_SCALAR,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          field_changes: Object.keys(data),
          changes: { before: changes?.after ?? {}, after: afterNow } as any,
          note: `undo of #${rec.id}`,
          undo: true,
          undo_of_id: rec.id,
        },
        select: { id: true },
      })

      await this.activityService.create(
        {
          type: ActivityType.DEVELOPER_EDIT,
          user_id: req.user.sub,
          developer_id: id,
          edit_record_id: undoRecord.id,
        },
        tx,
      )
      return
    }

    throw new ShionBizException(ShionBizCode.COMMON_NOT_IMPLEMENTED)
  }

  private async inverseCharacter(tx: Prisma.TransactionClient, rec: any, req: RequestWithUser) {
    const id = rec.target_id as number
    const action: EditActionType = rec.action
    const changes = rec.changes as ScalarChanges | null

    if (action === EditActionType.UPDATE_SCALAR) {
      const before = changes?.before ?? {}
      const data = before as Record<string, unknown>

      if (Object.keys(data).length > 0) {
        await tx.gameCharacter.update({ where: { id }, data })
      }

      const afterNow = Object.keys(data).length > 0 ? data : {}
      const undoRecord = await tx.editRecord.create({
        data: {
          entity: PermissionEntity.CHARACTER,
          target_id: id,
          action: EditActionType.UPDATE_SCALAR,
          actor_id: req.user.sub,
          actor_role: req.user.role,
          field_changes: Object.keys(data),
          changes: { before: changes?.after ?? {}, after: afterNow } as any,
          note: `undo of #${rec.id}`,
          undo: true,
          undo_of_id: rec.id,
        },
        select: { id: true },
      })

      await this.activityService.create(
        {
          type: ActivityType.CHARACTER_EDIT,
          user_id: req.user.sub,
          character_id: id,
          edit_record_id: undoRecord.id,
        },
        tx,
      )
      return
    }

    throw new ShionBizException(ShionBizCode.COMMON_NOT_IMPLEMENTED)
  }

  private async refreshIndex(entity: PermissionEntity, targetId: number) {
    if (entity !== PermissionEntity.GAME) return
    const updated = await this.prisma.game.findUnique({
      where: { id: targetId },
      select: rawDataQuery,
    })
    if (updated) {
      await this.searchEngine.upsertGame(formatDoc(updated as unknown as GameData))
    }
  }
}
