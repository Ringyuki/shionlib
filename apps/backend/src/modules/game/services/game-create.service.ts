import { Injectable, Inject } from '@nestjs/common'
import { GameDataFetcherService } from './game-data-fetcher.service'
import { PrismaService } from '../../../prisma.service'
import {
  GameData,
  GameCharacter,
  GameCharacterGender,
  GameCover,
  GameDeveloper,
  GameImage,
  GameLink,
} from '../interfaces/game.interface'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { Prisma } from '@prisma/client'
import {
  CreateGameReqDto,
  CreateGameCharacterReqDto,
  CreateGameDeveloperReqDto,
  CreateGameCoverReqDto,
} from '../dto/req/create-game.req.dto'
import { SearchEngine, SEARCH_ENGINE } from '../../search/interfaces/search.interface'
import { formatDoc, rawDataQuery } from '../../search/helpers/format-doc'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { ActivityService } from '../../activity/services/activity.service'
import { ActivityType } from '../../activity/dto/create-activity.dto'

@Injectable()
export class GameCreateService {
  constructor(
    private readonly gameDataFetcherService: GameDataFetcherService,
    private readonly prisma: PrismaService,
    @Inject(SEARCH_ENGINE) private readonly searchEngine: SearchEngine,
    private readonly activityService: ActivityService,
  ) {}

  async createFromBangumiAndVNDB(
    b_id: string,
    v_id: string | undefined,
    skip_consistency_check: boolean,
    req: RequestWithUser,
  ): Promise<number> {
    if (req.user.role < ShionlibUserRoles.ADMIN && !(b_id && v_id)) {
      throw new ShionBizException(ShionBizCode.GAME_MISSING_BANGUMI_OR_VNDB_ID)
    }

    const existing = await this.prisma.game.findFirst({
      where: {
        OR: [{ b_id }, { v_id }],
      },
    })
    if (existing) {
      throw new ShionBizException(ShionBizCode.GAME_ALREADY_EXISTS)
    }

    const { finalGameData, finalCharactersData, finalProducersData, finalCoversData } =
      skip_consistency_check && req.user.role >= ShionlibUserRoles.ADMIN
        ? await this.gameDataFetcherService.fetchData(b_id, v_id, true)
        : await this.gameDataFetcherService.fetchData(b_id, v_id, false)

    let gameId = 0
    try {
      gameId = await this.prisma.$transaction(async tx => {
        const isValidReleaseDate = this.isValidDate(finalGameData.release_date)
        const gameCreateData: any = {
          b_id: finalGameData.b_id,
          v_id: finalGameData.v_id,
          title_jp: this.dataOrEmpty(finalGameData.title_jp, ''),
          title_zh: this.dataOrEmpty(finalGameData.title_zh, ''),
          title_en: this.dataOrEmpty(finalGameData.title_en, ''),
          aliases: this.dataOrEmpty(finalGameData.aliases, []),
          intro_jp: this.dataOrEmpty(finalGameData.intro_jp, ''),
          intro_zh: this.dataOrEmpty(finalGameData.intro_zh, ''),
          intro_en: this.dataOrEmpty(finalGameData.intro_en, ''),
          extra_info: this.dataOrEmpty(finalGameData.extra_info, []),
          tags: this.dataOrEmpty(finalGameData.tags, []),
          staffs: this.dataOrEmpty(finalGameData.staffs, []),
          nsfw: this.dataOrEmpty(finalGameData.nsfw, false),
          type: finalGameData.type,
          platform: this.dataOrEmpty(finalGameData.platform, []),
          release_date: isValidReleaseDate ? finalGameData.release_date : null,
          release_date_tba: !isValidReleaseDate,
          creator_id: req.user.sub,
        }
        const game = await tx.game.create({ data: gameCreateData })

        await this._createGameCover(tx, finalCoversData || [], game.id)
        await this._createGameImages(tx, finalGameData.images || [], game.id)
        await this._createGameLink(tx, finalGameData.links || [], game.id)

        for (const d of finalProducersData || []) {
          const dev = await this.findOrCreateDeveloper(tx, d)
          await tx.gameDeveloperRelation
            .create({
              data: { game_id: game.id, developer_id: dev.id, role: '开发' },
            })
            .catch(e => {
              throw e
            })
        }

        for (const c of finalCharactersData || []) {
          const ch = await this.findOrCreateCharacter(tx, c)
          await tx.gameCharacterRelation
            .create({
              data: {
                game_id: game.id,
                character_id: ch.id,
                actor: c.actor,
                role: c.role,
              },
            })
            .catch(e => {
              throw e
            })
        }
        const check = await tx.game.findUnique({ where: { id: game.id }, select: { id: true } })
        if (!check) throw new Error('Row not visible inside tx')
        await this.activityService.create(
          {
            type: ActivityType.GAME_CREATE,
            user_id: req.user.sub,
            game_id: game.id,
          },
          tx,
        )
        return game.id
      })

      const game = await this.prisma.game.findUnique({
        where: { id: gameId },
        select: rawDataQuery,
      })
      await this.searchEngine.upsertGame(formatDoc(game as unknown as GameData))
    } catch (e) {
      console.error(e)
      throw e
    }
    if (gameId === 0) {
      throw new Error('Game creation failed')
    }

    return gameId
  }

  private async findOrCreateDeveloper(tx: Prisma.TransactionClient, d: GameDeveloper) {
    const existing = await tx.gameDeveloper.findFirst({
      where: {
        OR: [
          d.v_id ? { v_id: d.v_id } : undefined,
          d.b_id ? { b_id: d.b_id } : undefined,
          d.name ? { name: d.name } : undefined,
        ].filter(Boolean) as any,
      },
    })
    if (existing) return existing
    const devCreateData: any = {
      v_id: d.v_id,
      b_id: d.b_id,
      name: d.name?.trim() || '',
      aliases: this.dataOrEmpty(d.aliases, []),
      logo: d.logo,
      intro_jp: this.dataOrEmpty(d.intro_jp, ''),
      intro_zh: this.dataOrEmpty(d.intro_zh, ''),
      intro_en: this.dataOrEmpty(d.intro_en, ''),
      extra_info: this.dataOrEmpty(d.extra_info, []),
    }
    return tx.gameDeveloper.create({ data: devCreateData })
  }

  private async findOrCreateCharacter(tx: Prisma.TransactionClient, c: GameCharacter) {
    const existing = await tx.gameCharacter.findFirst({
      where: {
        OR: [c.v_id ? { v_id: c.v_id } : undefined, c.b_id ? { b_id: c.b_id } : undefined].filter(
          Boolean,
        ) as any,
      },
    })
    if (existing) return existing
    const chCreateData: any = {
      v_id: c.v_id,
      b_id: c.b_id,
      image: c.image,
      name_jp: this.dataOrEmpty(c.name_jp, ''),
      name_zh: c.name_zh,
      name_en: c.name_en,
      aliases: this.dataOrEmpty(c.aliases, []),
      intro_jp: this.dataOrEmpty(c.intro_jp, ''),
      intro_zh: this.dataOrEmpty(c.intro_zh, ''),
      intro_en: this.dataOrEmpty(c.intro_en, ''),
      blood_type: c.blood_type,
      height: c.height,
      weight: c.weight,
      bust: c.bust,
      waist: c.waist,
      hips: c.hips,
      cup: c.cup,
      age: c.age,
      birthday: this.dataOrEmpty(c.birthday, []).filter(
        (v): v is number => v !== null && v !== undefined,
      ),
      gender: this.dataOrEmpty(c.gender, []).filter(
        (v): v is GameCharacterGender => v !== null && v !== undefined,
      ),
    }
    return tx.gameCharacter.create({ data: chCreateData })
  }

  private async _createGameLink(
    tx: Prisma.TransactionClient,
    linksData: GameLink[],
    game_id: number,
  ) {
    if (linksData && linksData.length) {
      await tx.gameLink.createMany({
        data: linksData.map(l => ({ game_id, url: l.url, label: l.label, name: l.name })),
      })
    }
  }

  private async _createGameCover(
    tx: Prisma.TransactionClient,
    coversData: GameCover[],
    game_id: number,
  ) {
    if (coversData && coversData.length) {
      const uniqueByUrl = new Map<string, GameCover>()
      for (const c of coversData) {
        if (!uniqueByUrl.has(c.url)) uniqueByUrl.set(c.url, c)
      }
      const covers = Array.from(uniqueByUrl.values())
      if (covers.length) {
        await tx.gameCover.createMany({
          data: covers.map(c => ({
            game_id,
            language: this.normalizeLang(c.language),
            type: c.type,
            url: c.url,
            dims: c.dims?.length ? c.dims : [0, 0],
            sexual: c.sexual,
            violence: c.violence,
          })),
          skipDuplicates: true,
        })
      }
    }
  }

  private async _createGameImages(
    tx: Prisma.TransactionClient,
    imagesData: GameImage[],
    game_id: number,
  ) {
    if (imagesData && imagesData.length) {
      await tx.gameImage.createMany({
        data: imagesData.map(i => ({
          game_id,
          url: i.url,
          dims: i.dims?.length ? i.dims : [0, 0],
          sexual: i.sexual,
          violence: i.violence,
        })),
      })
    }
  }

  private normalizeLang = (lang?: string) => {
    if (!lang) return 'unknown'
    if (lang.includes('zh')) return 'zh'
    if (lang.includes('ja') || lang.includes('jp')) return 'jp'
    if (lang.includes('en')) return 'en'
    return lang
  }

  private dataOrEmpty = <T>(value: T | undefined | null, fallback: T) =>
    value === undefined || value === null ? fallback : value

  private isValidDate = (date: Date | undefined | null): date is Date => {
    return date instanceof Date && !isNaN(date.getTime())
  }

  async createGame(createGameReqDto: CreateGameReqDto, creator_id: number) {
    const existing = await this.prisma.game.findFirst({
      where: {
        OR: [{ b_id: createGameReqDto.b_id }, { v_id: createGameReqDto.v_id }],
      },
    })
    if (existing) {
      throw new ShionBizException(ShionBizCode.GAME_ALREADY_EXISTS)
    }

    const game = await this.prisma.game.create({
      data: {
        b_id: createGameReqDto.b_id,
        v_id: createGameReqDto.v_id,
        title_jp: this.dataOrEmpty(createGameReqDto.title_jp, ''),
        title_zh: this.dataOrEmpty(createGameReqDto.title_zh, ''),
        title_en: this.dataOrEmpty(createGameReqDto.title_en, ''),
        aliases: this.dataOrEmpty(createGameReqDto.aliases, []),
        intro_jp: this.dataOrEmpty(createGameReqDto.intro_jp, ''),
        intro_zh: this.dataOrEmpty(createGameReqDto.intro_zh, ''),
        intro_en: this.dataOrEmpty(createGameReqDto.intro_en, ''),
        extra_info: this.dataOrEmpty(createGameReqDto.extra_info, []),
        tags: this.dataOrEmpty(createGameReqDto.tags, []),
        staffs: this.dataOrEmpty(createGameReqDto.staffs, []),
        nsfw: this.dataOrEmpty(createGameReqDto.nsfw, false),
        type: createGameReqDto.type,
        platform: this.dataOrEmpty(createGameReqDto.platform, []),
        creator_id,
      } as any,
      select: rawDataQuery,
    })

    await this.searchEngine.upsertGame(formatDoc(game as unknown as GameData))

    return game.id
  }

  async createCharacter(createCharactersData: CreateGameCharacterReqDto, game_id: number) {
    const game = await this.prisma.game.findUnique({
      where: {
        id: game_id,
      },
      select: {
        characters: {
          select: {
            character: {
              select: {
                v_id: true,
                b_id: true,
              },
            },
          },
        },
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    for (const c of createCharactersData.characters) {
      if (
        game.characters.find(gc => gc.character.v_id === c.v_id || gc.character.b_id === c.b_id)
      ) {
        throw new ShionBizException(ShionBizCode.GAME_CHARACTER_ALREADY_EXISTS)
      }
    }

    await this.prisma.$transaction(async tx => {
      for (const c of createCharactersData.characters) {
        const ch = await this.findOrCreateCharacter(tx, c as GameCharacter)
        await tx.gameCharacterRelation.create({
          data: {
            game_id,
            character_id: ch.id,
            image: c.image,
            actor: c.actor,
            role: c.role || null,
          },
        })
      }
    })
  }

  async createDeveloper(createDevelopersData: CreateGameDeveloperReqDto, game_id: number) {
    const game = await this.prisma.game.findUnique({
      where: {
        id: game_id,
      },
      select: {
        developers: {
          select: {
            developer: {
              select: {
                v_id: true,
                b_id: true,
              },
            },
          },
        },
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    for (const d of createDevelopersData.developers) {
      if (
        game.developers.find(gd => gd.developer.v_id === d.v_id || gd.developer.b_id === d.b_id)
      ) {
        throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_ALREADY_EXISTS)
      }
    }

    await this.prisma.$transaction(async tx => {
      for (const d of createDevelopersData.developers) {
        const dev = await this.findOrCreateDeveloper(tx, d as GameDeveloper)
        await tx.gameDeveloperRelation.create({
          data: {
            game_id,
            developer_id: dev.id,
            role: d.role || '开发',
          },
        })
      }
    })
  }

  async createCover(createCoversData: CreateGameCoverReqDto, game_id: number) {
    const game = await this.prisma.game.findUnique({
      where: {
        id: game_id,
      },
      select: {
        covers: true,
      },
    })
    if (!game) {
      throw new ShionBizException(ShionBizCode.GAME_NOT_FOUND)
    }

    for (const c of createCoversData.covers) {
      if (game.covers.find(gc => gc.url === c.url)) {
        throw new ShionBizException(ShionBizCode.GAME_COVER_ALREADY_EXISTS)
      }
    }

    await this.prisma.$transaction(async tx => {
      await this._createGameCover(tx, createCoversData.covers as GameCover[], game_id)
    })
  }

  // async createLink(createLinksData: CreateGameLinkReqDto, game_id: number) {
  //   await this.prisma.$transaction(async tx => {
  //     await this._createGameLink(tx, createLinksData.links as GameLink[], game_id)
  //   })
  // }

  // async createImage(createImagesData: CreateGameImageReqDto, game_id: number) {
  //   await this.prisma.$transaction(async tx => {
  //     await this._createGameImages(tx, createImagesData.images as GameImage[], game_id)
  //   })
  // }
}
