import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { EditRecordItem } from '../../user/dto/res/edit-records.res.dto'

@Injectable()
export class DataService {
  constructor(private readonly prismaService: PrismaService) {}

  async getGameScalar(game_id: number) {
    const game = await this.prismaService.game.findUnique({
      where: { id: game_id },
      select: {
        b_id: true,
        v_id: true,
        title_jp: true,
        title_zh: true,
        title_en: true,
        aliases: true,
        intro_jp: true,
        intro_zh: true,
        intro_en: true,
        platform: true,
        release_date: true,
        release_date_tba: true,
        extra_info: true,
        tags: true,
        staffs: true,
        nsfw: true,
        type: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    return game
  }

  async getGameCover(game_id: number) {
    const game = await this.prismaService.game.findUnique({
      where: { id: game_id },
      select: {
        id: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    const covers = await this.prismaService.gameCover.findMany({
      where: { game_id },
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

    return covers
  }

  async getGameImage(game_id: number) {
    const game = await this.prismaService.game.findUnique({
      where: { id: game_id },
      select: {
        id: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    const images = await this.prismaService.gameImage.findMany({
      where: { game_id },
      select: {
        id: true,
        url: true,
        dims: true,
        sexual: true,
        violence: true,
      },
    })

    return images
  }

  async getGameDevelopers(game_id: number) {
    const game = await this.prismaService.game.findUnique({
      where: { id: game_id },
      select: {
        id: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    const developers = await this.prismaService.gameDeveloperRelation.findMany({
      where: {
        game_id,
      },
      select: {
        id: true,
        developer_id: true,
        role: true,
        developer: {
          select: {
            id: true,
            name: true,
            aliases: true,
            logo: true,
          },
        },
      },
    })

    return developers
  }

  async getGameCharacters(game_id: number) {
    const game = await this.prismaService.game.findUnique({
      where: { id: game_id },
      select: {
        id: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }
    const characters = await this.prismaService.gameCharacterRelation.findMany({
      where: {
        game_id,
      },
      select: {
        id: true,
        character_id: true,
        role: true,
        image: true,
        actor: true,
        character: {
          select: {
            id: true,
            name_jp: true,
            name_zh: true,
            name_en: true,
            image: true,
            aliases: true,
          },
        },
      },
    })

    return characters
  }

  async getGameEditHistory(
    game_id: number,
    dto: PaginationReqDto,
  ): Promise<PaginatedResult<EditRecordItem>> {
    const game = await this.prismaService.game.findUnique({
      where: { id: game_id },
      select: {
        id: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    const { page, pageSize } = dto
    const total = await this.prismaService.editRecord.count({
      where: {
        target_id: game_id,
        entity: 'game',
      },
    })
    const history = await this.prismaService.editRecord.findMany({
      where: {
        target_id: game_id,
        entity: 'game',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        created: 'desc',
      },
      select: {
        id: true,
        entity: true,
        target_id: true,
        action: true,
        field_changes: true,
        changes: true,
        undo: true,
        undo_of: {
          select: {
            id: true,
          },
        },
        undone_by: {
          select: {
            id: true,
          },
        },
        actor: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        note: true,
        created: true,
        updated: true,
      },
    })
    return {
      items: history as unknown as EditRecordItem[],
      meta: {
        totalItems: total,
        itemCount: history.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getDeveloperScalar(developer_id: number) {
    const developer = await this.prismaService.gameDeveloper.findUnique({
      where: { id: developer_id },
      select: {
        b_id: true,
        v_id: true,
        name: true,
        aliases: true,
        intro_jp: true,
        intro_zh: true,
        intro_en: true,
        extra_info: true,
        logo: true,
        website: true,
      },
    })
    if (!developer) {
      throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_NOT_FOUND)
    }
    return developer
  }

  async getDeveloperEditHistory(
    developer_id: number,
    dto: PaginationReqDto,
  ): Promise<PaginatedResult<EditRecordItem>> {
    const developer = await this.prismaService.gameDeveloper.findUnique({
      where: { id: developer_id },
      select: { id: true },
    })
    if (!developer) {
      throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_NOT_FOUND)
    }

    const { page, pageSize } = dto
    const total = await this.prismaService.editRecord.count({
      where: {
        target_id: developer_id,
        entity: 'developer',
      },
    })
    const history = await this.prismaService.editRecord.findMany({
      where: {
        target_id: developer_id,
        entity: 'developer',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created: 'desc' },
      select: {
        id: true,
        entity: true,
        target_id: true,
        action: true,
        field_changes: true,
        changes: true,
        undo: true,
        undo_of: { select: { id: true } },
        undone_by: { select: { id: true } },
        actor: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        note: true,
        created: true,
        updated: true,
      },
    })
    return {
      items: history as unknown as EditRecordItem[],
      meta: {
        totalItems: total,
        itemCount: history.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async getCharacterScalar(character_id: number) {
    const character = await this.prismaService.gameCharacter.findUnique({
      where: { id: character_id },
      select: {
        b_id: true,
        v_id: true,
        name_jp: true,
        name_zh: true,
        name_en: true,
        aliases: true,
        intro_jp: true,
        intro_zh: true,
        intro_en: true,
        image: true,
        blood_type: true,
        height: true,
        weight: true,
        bust: true,
        waist: true,
        hips: true,
        cup: true,
        age: true,
        birthday: true,
        gender: true,
      },
    })
    if (!character) {
      throw new ShionBizException(ShionBizCode.GAME_CHARACTER_NOT_FOUND)
    }
    return character
  }

  async getCharacterEditHistory(
    character_id: number,
    dto: PaginationReqDto,
  ): Promise<PaginatedResult<EditRecordItem>> {
    const character = await this.prismaService.gameCharacter.findUnique({
      where: { id: character_id },
      select: { id: true },
    })
    if (!character) {
      throw new ShionBizException(ShionBizCode.GAME_CHARACTER_NOT_FOUND)
    }

    const { page, pageSize } = dto
    const total = await this.prismaService.editRecord.count({
      where: {
        target_id: character_id,
        entity: 'character',
      },
    })
    const history = await this.prismaService.editRecord.findMany({
      where: {
        target_id: character_id,
        entity: 'character',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created: 'desc' },
      select: {
        id: true,
        entity: true,
        target_id: true,
        action: true,
        field_changes: true,
        changes: true,
        undo: true,
        undo_of: { select: { id: true } },
        undone_by: { select: { id: true } },
        actor: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        note: true,
        created: true,
        updated: true,
      },
    })
    return {
      items: history as unknown as EditRecordItem[],
      meta: {
        totalItems: total,
        itemCount: history.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }
}
