import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { CharacterResDto } from '../dto/res/character.res.dto'
import { GetListReqDto } from '../dto/req/get-list.req.dto'
import { Prisma } from '@prisma/client'

@Injectable()
export class CharacterService {
  constructor(private readonly prisma: PrismaService) {}

  async getCharacter(id: number) {
    const character = await this.prisma.gameCharacter.findUnique({
      where: { id },
      select: {
        id: true,
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

  async getList(dto: GetListReqDto): Promise<PaginatedResult<CharacterResDto>> {
    const { page, pageSize, q } = dto

    let aliasLikeIds: number[] = []
    if (q && q.length > 0) {
      const ids = await this.prisma.$queryRaw<Array<{ id: number }>>`
        select id
          from game_characters
          where exists (
            select 1 from unnest(aliases) as alias
            where alias ilike ${'%' + q + '%'}
          )
        `
      aliasLikeIds = ids.map(r => r.id)
    }

    const where: Prisma.GameCharacterWhereInput = {}
    if (q && q.length > 0) {
      const or: Prisma.GameCharacterWhereInput[] = [
        {
          name_jp: { contains: q, mode: 'insensitive' },
          name_zh: { contains: q, mode: 'insensitive' },
          name_en: { contains: q, mode: 'insensitive' },
          aliases: { hasSome: q.split(' ') },
        },
      ]
      if (aliasLikeIds.length > 0) {
        or.push({ id: { in: aliasLikeIds } })
      }
      where.OR = or
    }

    const [total, characters] = await this.prisma.$transaction([
      this.prisma.gameCharacter.count({ where }),
      this.prisma.gameCharacter.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
        select: {
          id: true,
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
      }),
    ])
    return {
      items: characters.map(character => ({
        b_id: character.b_id,
        v_id: character.v_id,
        id: character.id,
        name_jp: character.name_jp,
        name_zh: character.name_zh,
        name_en: character.name_en,
        aliases: character.aliases,
        intro_jp: character.intro_jp,
        intro_zh: character.intro_zh,
        intro_en: character.intro_en,
        image: character.image,
        blood_type: character.blood_type,
        height: character.height,
        weight: character.weight,
        bust: character.bust,
        waist: character.waist,
        hips: character.hips,
        cup: character.cup,
        age: character.age,
        birthday: character.birthday,
        gender: character.gender,
      })),
      meta: {
        totalItems: total,
        itemCount: characters.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      },
    }
  }

  async deleteById(id: number) {
    const character = await this.prisma.gameCharacter.findUnique({
      where: { id },
    })
    if (!character) {
      throw new ShionBizException(ShionBizCode.GAME_CHARACTER_NOT_FOUND)
    }
    const existRelations = await this.prisma.gameCharacterRelation.findMany({
      where: { character_id: id },
    })
    if (existRelations.length > 0) {
      throw new ShionBizException(ShionBizCode.GAME_CHARACTER_HAS_RELATIONS)
    }
    await this.prisma.gameCharacter.delete({ where: { id } })
    return character
  }
}
