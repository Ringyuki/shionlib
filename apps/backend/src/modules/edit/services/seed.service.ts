import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import {
  GameFieldMapping,
  GameCharacterFieldMapping,
  GameDeveloperFieldMapping,
} from '../interfaces/mapping.interface'
import {
  GameFieldGroupBit,
  GameCharacterFieldGroupBit,
  GameDeveloperFieldGroupBit,
} from '../enums/field-group.enum'
import { PermissionEntity } from '../enums/permission-entity.enum'
import {
  gameUserAllow,
  gameAdminAllow,
  gameRootAllow,
  charUserAllow,
  charAdminAllow,
  charRootAllow,
  devUserAllow,
  devAdminAllow,
  devRootAllow,
} from '../constants/allows'

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(private readonly prismaService: PrismaService) {}

  async onModuleInit() {
    const gameMappings: GameFieldMapping[] = [
      ['IDS', GameFieldGroupBit.IDS, false],
      ['TITLES', GameFieldGroupBit.TITLES, false],
      ['INTROS', GameFieldGroupBit.INTROS, false],
      ['ALIASES', GameFieldGroupBit.ALIASES, false],
      ['RELEASE', GameFieldGroupBit.RELEASE, false],
      ['TYPE', GameFieldGroupBit.TYPE, false],
      ['PLATFORMS', GameFieldGroupBit.PLATFORMS, false],
      ['EXTRA', GameFieldGroupBit.EXTRA, false],
      ['TAGS', GameFieldGroupBit.TAGS, false],
      ['STAFFS', GameFieldGroupBit.STAFFS, false],
      ['MANAGE_LINKS', GameFieldGroupBit.MANAGE_LINKS, true],
      ['MANAGE_COVERS', GameFieldGroupBit.MANAGE_COVERS, true],
      ['MANAGE_IMAGES', GameFieldGroupBit.MANAGE_IMAGES, true],
      ['MANAGE_DEVELOPERS', GameFieldGroupBit.MANAGE_DEVELOPERS, true],
      ['MANAGE_CHARACTERS', GameFieldGroupBit.MANAGE_CHARACTERS, true],
      ['STATUS', GameFieldGroupBit.STATUS, false],
      ['NSFW', GameFieldGroupBit.NSFW, false],
      ['VIEWS', GameFieldGroupBit.VIEWS, false],
    ] as const

    const gameCharacterMappings: GameCharacterFieldMapping[] = [
      ['IDS', GameCharacterFieldGroupBit.IDS, false],
      ['NAMES', GameCharacterFieldGroupBit.NAMES, false],
      ['INTROS', GameCharacterFieldGroupBit.INTROS, false],
      ['ALIASES', GameCharacterFieldGroupBit.ALIASES, false],
      ['IMAGE', GameCharacterFieldGroupBit.IMAGE, false],
      ['BODY_METRICS', GameCharacterFieldGroupBit.BODY_METRICS, false],
      ['AGE_BIRTHDAY', GameCharacterFieldGroupBit.AGE_BIRTHDAY, false],
      ['BLOOD_TYPE', GameCharacterFieldGroupBit.BLOOD_TYPE, false],
      ['GENDER', GameCharacterFieldGroupBit.GENDER, false],
    ] as const

    const gameDeveloperMappings: GameDeveloperFieldMapping[] = [
      ['IDS', GameDeveloperFieldGroupBit.IDS, false],
      ['NAME', GameDeveloperFieldGroupBit.NAME, false],
      ['ALIASES', GameDeveloperFieldGroupBit.ALIASES, false],
      ['INTROS', GameDeveloperFieldGroupBit.INTROS, false],
      ['EXTRA', GameDeveloperFieldGroupBit.EXTRA, false],
      ['LOGO', GameDeveloperFieldGroupBit.LOGO, false],
      ['WEBSITE', GameDeveloperFieldGroupBit.WEBSITE, false],
    ] as const

    try {
      await this.initSeed(gameMappings, gameCharacterMappings, gameDeveloperMappings)
    } catch (error) {
      try {
        await this.resetSeed()
        await this.initSeed(gameMappings, gameCharacterMappings, gameDeveloperMappings)
      } catch {
        throw error
      }
    }
  }

  private async initSeed(
    gameMappings: GameFieldMapping[],
    gameCharacterMappings: GameCharacterFieldMapping[],
    gameDeveloperMappings: GameDeveloperFieldMapping[],
  ) {
    await this.prismaService.$transaction(async tx => {
      for (const [field, bitIndex, isRelation] of gameMappings) {
        await tx.fieldPermissionMapping.upsert({
          where: {
            entity_field: {
              entity: PermissionEntity.GAME,
              field,
            },
          },
          update: { bitIndex, isRelation },
          create: { entity: PermissionEntity.GAME, field, bitIndex, isRelation },
        })
      }

      for (const [field, bitIndex, isRelation] of gameCharacterMappings) {
        await tx.fieldPermissionMapping.upsert({
          where: { entity_field: { entity: PermissionEntity.CHARACTER, field } },
          update: { bitIndex, isRelation },
          create: { entity: PermissionEntity.CHARACTER, field, bitIndex, isRelation },
        })
      }

      for (const [field, bitIndex, isRelation] of gameDeveloperMappings) {
        await tx.fieldPermissionMapping.upsert({
          where: { entity_field: { entity: PermissionEntity.DEVELOPER, field } },
          update: { bitIndex, isRelation },
          create: { entity: PermissionEntity.DEVELOPER, field, bitIndex, isRelation },
        })
      }

      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 1, entity: PermissionEntity.GAME } },
        update: { allowMask: gameUserAllow },
        create: { role: 1, entity: PermissionEntity.GAME, allowMask: gameUserAllow },
      })
      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 2, entity: PermissionEntity.GAME } },
        update: { allowMask: gameAdminAllow },
        create: { role: 2, entity: PermissionEntity.GAME, allowMask: gameAdminAllow },
      })
      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 3, entity: PermissionEntity.GAME } },
        update: { allowMask: gameRootAllow },
        create: { role: 3, entity: PermissionEntity.GAME, allowMask: gameRootAllow },
      })

      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 1, entity: PermissionEntity.CHARACTER } },
        update: { allowMask: charUserAllow },
        create: { role: 1, entity: PermissionEntity.CHARACTER, allowMask: charUserAllow },
      })
      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 2, entity: PermissionEntity.CHARACTER } },
        update: { allowMask: charAdminAllow },
        create: { role: 2, entity: PermissionEntity.CHARACTER, allowMask: charAdminAllow },
      })
      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 3, entity: PermissionEntity.CHARACTER } },
        update: { allowMask: charRootAllow },
        create: { role: 3, entity: PermissionEntity.CHARACTER, allowMask: charRootAllow },
      })

      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 1, entity: PermissionEntity.DEVELOPER } },
        update: { allowMask: devUserAllow },
        create: { role: 1, entity: PermissionEntity.DEVELOPER, allowMask: devUserAllow },
      })
      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 2, entity: PermissionEntity.DEVELOPER } },
        update: { allowMask: devAdminAllow },
        create: { role: 2, entity: PermissionEntity.DEVELOPER, allowMask: devAdminAllow },
      })
      await tx.roleFieldPermission.upsert({
        where: { role_entity: { role: 3, entity: PermissionEntity.DEVELOPER } },
        update: { allowMask: devRootAllow },
        create: { role: 3, entity: PermissionEntity.DEVELOPER, allowMask: devRootAllow },
      })
    })
  }

  private async resetSeed() {
    await this.prismaService.$transaction(async tx => {
      await tx.fieldPermissionMapping.deleteMany()
      await tx.roleFieldPermission.deleteMany()
    })
  }
}
