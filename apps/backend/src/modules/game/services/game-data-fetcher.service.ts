import { Injectable } from '@nestjs/common'
import { BangumiAuthService } from '../../bangumi/services/bangumi-auth.service'
import { detectLanguage } from '../utils/language-detector.util'
import {
  BangumiGameItemRes,
  BangumiGameCharacterRelationItemRes,
  BangumiGamePersonRelationItemRes,
  InfoboxValueArray,
} from '../interfaces/bangumi/game-item.res.interface'
import { BangumiCharacterItemRes } from '../interfaces/bangumi/character-item.res.interface'
import { BangumiProducerItemRes } from '../interfaces/bangumi/producer-item.res.interface'
import {
  GameCharacter,
  GameCover,
  GameData,
  GameDeveloper,
  GamePlatform,
} from '../interfaces/game.interface'
import { VNDBService } from '../../vndb/services/vndb.service'
import { VNDBGameItemRes } from '../interfaces/vndb/game-item.res'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { VNDBReleaseItemRes } from '../interfaces/vndb/release-item.res'
import { createCharacterMatcher } from '../utils/character-match.util'
import { dedupeCharactersInPlace, dedupeDevelopersInPlace } from '../helpers/dedupe'

@Injectable()
export class GameDataFetcherService {
  constructor(
    private readonly bangumiService: BangumiAuthService,
    private readonly vndbService: VNDBService,
  ) {}

  async fetchData(
    b_id: string,
    v_id?: string,
    skip_consistency_check?: boolean,
  ): Promise<{
    finalGameData: GameData
    finalCharactersData: GameCharacter[]
    finalProducersData: GameDeveloper[]
    finalCoversData?: GameCover[]
  }> {
    if (v_id && v_id.startsWith('v')) {
      throw new ShionBizException(ShionBizCode.GAME_INVALID_VNDB_ID)
    }
    return this.fetchDatafromBangumi(b_id, `v${v_id}`, skip_consistency_check)
  }

  private async fetchDatafromBangumi(
    b_id: string,
    v_id?: string,
    skip_consistency_check?: boolean,
  ) {
    const [rawGameData, rawCharacterData, rawPersonData] = await Promise.all([
      this.bangumiService.bangumiRequest<BangumiGameItemRes>(
        `https://api.bgm.tv/v0/subjects/${b_id}`,
      ),
      this.bangumiService.bangumiRequest<BangumiGameCharacterRelationItemRes[]>(
        `https://api.bgm.tv/v0/subjects/${b_id}/characters`,
      ),
      this.bangumiService.bangumiRequest<BangumiGamePersonRelationItemRes[]>(
        `https://api.bgm.tv/v0/subjects/${b_id}/persons`,
      ),
    ])

    if (rawGameData.type !== 4) {
      throw new ShionBizException(
        ShionBizCode.GAME_BANGUMI_REQUEST_FAILED,
        'shion-biz.GAME_BANGUMI_REQUEST_FAILED',
        { message: 'invalid subject type' },
      )
    }

    const finalGameData: GameData = {} as GameData
    const finalProducersData: GameDeveloper[] = []
    const finalCharactersData: GameCharacter[] = []
    try {
      const characterIds = rawCharacterData.map(c => c.id)
      const producerids = rawPersonData.filter(p => p.relation === '开发').map(p => p.id)

      const [rawFullCharactersData, rawFullProducersData] = await Promise.all([
        this.fetchRawFullCharactersDataFromBangumi(characterIds),
        this.fetchRawFullProducersDataFromBangumi(producerids),
      ])

      finalGameData.b_id = rawGameData.id.toString()
      if ((await detectLanguage(rawGameData.name)) === 'en')
        finalGameData.title_en = rawGameData.name
      else if (
        (await detectLanguage(rawGameData.name)) === 'jp' ||
        (await detectLanguage(rawGameData.name)) === 'unknown'
      )
        finalGameData.title_jp = rawGameData.name
      else if ((await detectLanguage(rawGameData.name)) === 'zh')
        finalGameData.title_zh = rawGameData.name
      if (rawGameData.name_cn) finalGameData.title_zh = rawGameData.name_cn

      if ((await detectLanguage(rawGameData.summary)) === 'zh')
        finalGameData.intro_zh = rawGameData.summary
      else if ((await detectLanguage(rawGameData.summary)) === 'jp')
        finalGameData.intro_jp = rawGameData.summary

      finalGameData.tags = rawGameData.tags.map(tag => tag.name)

      const exludedKeys = new Set([
        '中文名',
        '别名',
        '平台',
        '游戏类型',
        '游戏引擎',
        '游玩人数',
        '发行日期',
        '售价',
        '开发',
        'website',
        '链接',
      ])
      finalGameData.staffs = rawGameData.infobox
        .filter(i => !exludedKeys.has(i.key))
        .map(i => ({
          name: typeof i.value === 'string' ? i.value : i.value.map(v => v.v).join(', '),
          role: i.key,
        }))
      const gameType = rawGameData.infobox.find(i => i.key === '游戏类型')?.value
      finalGameData.type =
        typeof gameType === 'string' ? gameType : gameType?.map(v => v.v).join(', ')

      for (const character of rawCharacterData) {
        finalCharactersData.push({
          b_id: character.id.toString(),
          name_jp: character.name,
          name_zh: character.name,
          actor: character.actors.map(a => a.name).join(', '),
          image: character.images.large,
        })
      }
      for (const character of finalCharactersData) {
        const rawFullCharacterData = rawFullCharactersData.find(
          c => String(c.id) === character.b_id,
        )
        if (rawFullCharacterData) {
          character.name_zh = rawFullCharacterData.infobox.find(i => i.key === '简体中文名')
            ?.value as string
          if ((await detectLanguage(rawFullCharacterData.summary)) === 'zh')
            character.intro_zh = rawFullCharacterData.summary
          else character.intro_jp = rawFullCharacterData.summary

          const rawAliases = rawFullCharacterData.infobox.find(i => i.key === '别名')
          if (rawAliases && rawAliases.value.length) {
            character.aliases = []
            if (typeof rawAliases.value === 'string') character.aliases.push(rawAliases.value)
            else
              for (const a of rawAliases.value as InfoboxValueArray[]) character.aliases.push(a.v)
          }
        }
      }

      dedupeCharactersInPlace(finalCharactersData)

      for (const producer of rawPersonData.filter(p => p.relation === '开发')) {
        finalProducersData.push({
          b_id: producer.id.toString(),
          name: producer.name,
          logo: producer.images.large,
        })
      }
      for (const producer of finalProducersData) {
        const rawFullProducerData = rawFullProducersData.find(p => String(p.id) === producer.b_id)
        if (rawFullProducerData) {
          if ((await detectLanguage(rawFullProducerData.summary)) === 'zh')
            producer.intro_zh = rawFullProducerData.summary
          else producer.intro_jp = rawFullProducerData.summary

          const rawAliases = rawFullProducerData.infobox.find(i => i.key === '别名')
          if (rawAliases && rawAliases.value.length) {
            producer.aliases = []
            if (typeof rawAliases.value === 'string') producer.aliases.push(rawAliases.value)
            else for (const a of rawAliases.value as InfoboxValueArray[]) producer.aliases.push(a.v)
          }
          producer.extra_info = rawFullProducerData.infobox
            .filter(i => !['简体中文名', '别名'].includes(i.key))
            .map(i => ({
              key: i.key,
              value: typeof i.value === 'string' ? i.value : i.value.map(v => v.v).join(', '),
            }))
        }
      }

      dedupeDevelopersInPlace(finalProducersData)
    } catch (error) {
      console.error(error)
      throw error
    }

    if (v_id && v_id !== 'vundefined') {
      return this.fetchDataFromVNDB(
        v_id,
        finalGameData,
        finalCharactersData,
        finalProducersData,
        rawGameData,
        skip_consistency_check,
      )
    }
    dedupeCharactersInPlace(finalCharactersData)
    dedupeDevelopersInPlace(finalProducersData)
    return { finalGameData, finalCharactersData, finalProducersData }
  }

  private async fetchRawFullCharactersDataFromBangumi(ids: number[]) {
    const charactersData: BangumiCharacterItemRes[] = []
    if (!ids?.length) return charactersData

    const batchSize = 8
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(id =>
          this.bangumiService.bangumiRequest<BangumiCharacterItemRes>(
            `https://api.bgm.tv/v0/characters/${id}`,
          ),
        ),
      )
      charactersData.push(...results)
    }
    return charactersData
  }

  private async fetchRawFullProducersDataFromBangumi(ids: number[]) {
    const producersData: BangumiProducerItemRes[] = []
    const promises = ids.map(id =>
      this.bangumiService.bangumiRequest<BangumiProducerItemRes>(
        `https://api.bgm.tv/v0/persons/${id}`,
      ),
    )
    const results = await Promise.all(promises)
    producersData.push(...results)
    return producersData
  }

  private async fetchDataFromVNDB(
    v_id: string,
    finalGameData: GameData,
    finalCharactersData: GameCharacter[],
    finalProducersData: GameDeveloper[],
    bangumiRawGameData?: BangumiGameItemRes,
    skip_consistency_check?: boolean,
  ) {
    const [rawGameData, rawReleasesData] = await Promise.all([
      await this.vndbService.vndbRequest<VNDBGameItemRes>(
        'single',
        ['id', '=', v_id],
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
      await this.vndbService.vndbRequest<VNDBReleaseItemRes>(
        'multiple',
        ['vn', '=', ['id', '=', v_id]],
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
    if (bangumiRawGameData && !skip_consistency_check) {
      this.consistencyCheck(bangumiRawGameData, rawGameData)
    }

    const finalCoversData: GameCover[] = []
    try {
      finalGameData.v_id = rawGameData.id
      for (const title of rawGameData.titles) {
        if (title.lang === 'jp') finalGameData.title_jp = title.title
        if (title.lang === 'zh-Hans') finalGameData.title_zh = title.title
        if (title.lang === 'en') finalGameData.title_en = title.title
      }
      finalGameData.aliases = rawGameData.aliases
      finalGameData.release_date = new Date(rawGameData.released)
      if ((await detectLanguage(rawGameData.description)) === 'en')
        finalGameData.intro_en = rawGameData.description
      finalGameData.images = rawGameData.screenshots.map(s => ({
        url: s.url,
        dims: s.dims,
        sexual: s.sexual,
        violence: s.violence,
      }))
      finalGameData.platform = rawGameData.platforms as GamePlatform[]
      finalGameData.links = rawGameData.extlinks
      for (const release of rawReleasesData) {
        finalGameData.links.push(...release.extlinks)
      }
      finalGameData.links = finalGameData.links.slice(0, 5)

      const match = createCharacterMatcher(finalCharactersData)
      for (const character of rawGameData.va) {
        const characterNameOri = character.character.original
        const characterName = character.character.name
        const existingCharacter = match(character.character)

        if (existingCharacter) {
          existingCharacter.v_id = character.character.id
          existingCharacter.name_en = characterName
          existingCharacter.intro_en = character.character.description
          if (existingCharacter.aliases)
            existingCharacter.aliases.push(...character.character.aliases)
          else existingCharacter.aliases = character.character.aliases
          existingCharacter.aliases = existingCharacter.aliases.filter(
            (alias, index, self) => self.indexOf(alias) === index,
          )
          existingCharacter.role = character.character.vns.find(
            v => v.id === finalGameData.v_id,
          )?.role
          existingCharacter.blood_type = character.character.blood_type
          existingCharacter.height = character.character.height
          existingCharacter.weight = character.character.weight
          existingCharacter.bust = character.character.bust
          existingCharacter.waist = character.character.waist
          existingCharacter.hips = character.character.hips
          existingCharacter.cup = character.character.cup
          existingCharacter.age = character.character.age
          existingCharacter.birthday = character.character.birthday
          if (!character.character.gender) {
            character.character.gender = []
          } else if (!character.character.gender[0] || !character.character.gender[1]) {
            character.character.gender = Array(2).fill(
              character.character.gender[0] ?? character.character.gender[1],
            )
          }
          existingCharacter.gender = character.character.gender
          if (!existingCharacter.image && character.character.image)
            existingCharacter.image = character.character.image.url
        } else {
          const name_jp =
            (await detectLanguage(characterNameOri)) === 'jp' ? characterNameOri : undefined
          const name_zh =
            (await detectLanguage(characterNameOri)) === 'zh' ? characterNameOri : undefined
          finalCharactersData.push({
            v_id: character.character.id,
            name_en: characterName,
            name_jp,
            name_zh,
            aliases: character.character.aliases,
            intro_en: character.character.description,
            role: character.character.vns.find(v => v.id === finalGameData.v_id)?.role,
            blood_type: character.character.blood_type,
            height: character.character.height,
            weight: character.character.weight,
            bust: character.character.bust,
            waist: character.character.waist,
            hips: character.character.hips,
            cup: character.character.cup,
            age: character.character.age,
            birthday: character.character.birthday,
            gender: character.character.gender,
            image: character.character.image?.url,
          })
        }
      }

      for (const producer of rawGameData.developers) {
        const producerName = producer.name
        const producerNameOri = producer.original
        const existingProducer = finalProducersData.find(
          p =>
            this.formatString(p.name) === this.formatString(producerNameOri) ||
            this.formatString(p.name) === this.formatString(producerName) ||
            (p.aliases &&
              p.aliases.some(
                a => producer.aliases.includes(a) || a === producerNameOri || a === producerName,
              )),
        )
        if (existingProducer) {
          existingProducer.v_id = producer.id
          existingProducer.name = producerNameOri || producerName || producer.aliases[0]
          existingProducer.intro_en = producer.description
          if (existingProducer.aliases) existingProducer.aliases.push(...producer.aliases)
          else existingProducer.aliases = producer.aliases
          existingProducer.aliases = existingProducer.aliases.filter(
            (alias, index, self) => self.indexOf(alias) === index,
          )
          existingProducer.website = producer.extlinks?.find(
            e => e.label === 'Official website',
          )?.url
        } else {
          finalProducersData.push({
            v_id: producer.id,
            name: producerNameOri || producerName || producer.aliases[0],
            intro_en: producer.description,
            aliases: producer.aliases,
            website: producer.extlinks?.find(e => e.label === 'Official website')?.url,
          })
        }
      }

      const allowedImageTypes = new Set(['pkgfront', 'dig'])
      const filteredRawReleasesData = rawReleasesData.filter(r =>
        r.images?.some(i => allowedImageTypes.has(i.type)),
      )

      const pkgfronts: GameCover[] = []
      const digs: GameCover[] = []
      for (const release of filteredRawReleasesData) {
        for (const image of release.images) {
          if (!allowedImageTypes.has(image.type)) continue
          if (image.type === 'pkgfront')
            pkgfronts.push({
              language: image.languages?.[0] || release.languages[0].lang,
              type: image.type,
              url: image.url,
              dims: image.dims,
              sexual: image.sexual,
              violence: image.violence,
            })
          else
            digs.push({
              language: image.languages?.[0] || release.languages[0].lang,
              type: image.type,
              url: image.url,
              dims: image.dims,
              sexual: image.sexual,
              violence: image.violence,
            })
        }
      }

      const zh_digs = digs.filter(d => d.language?.includes('zh'))
      const en_digs = digs.filter(d => d.language?.includes('en'))
      const jp_digs = digs.filter(d => d.language?.includes('ja'))
      const zh_pkgfronts = pkgfronts.filter(p => p.language?.includes('zh'))
      const en_pkgfronts = pkgfronts.filter(p => p.language?.includes('en'))
      const jp_pkgfronts = pkgfronts.filter(p => p.language?.includes('ja'))
      const isHasCover = {
        zh: false,
        en: false,
        jp: false,
      }

      let index = 1
      for (const zh_d of zh_digs) {
        if (zh_digs.length === 1) {
          isHasCover.zh = true
          finalCoversData.push(zh_d)
          index = 1
          break
        }
        if (index === zh_digs.length && zh_digs.length > 1) {
          isHasCover.zh = true
          finalCoversData.push(zh_d)
          index = 1
        }
        if (zh_d.dims[0] / zh_d.dims[1] <= 0.8) {
          isHasCover.zh = true
          finalCoversData.push(zh_d)
          index = 1
          break
        }
        index++
      }
      for (const en_d of en_digs) {
        if (en_digs.length === 1) {
          isHasCover.en = true
          finalCoversData.push(en_d)
          index = 1
          break
        }
        if (index === en_digs.length && en_digs.length > 1) {
          isHasCover.en = true
          finalCoversData.push(en_d)
          index = 1
        }
        if (en_d.dims[0] / en_d.dims[1] <= 0.8) {
          isHasCover.en = true
          finalCoversData.push(en_d)
          index = 1
          break
        }
        index++
      }
      for (const jp_d of jp_digs) {
        if (jp_digs.length === 1) {
          isHasCover.jp = true
          finalCoversData.push(jp_d)
          index = 1
          break
        }
        if (index === jp_digs.length && jp_digs.length > 1) {
          isHasCover.jp = true
          finalCoversData.push(jp_d)
          index = 1
        }
        if (jp_d.dims[0] / jp_d.dims[1] <= 0.8) {
          isHasCover.jp = true
          finalCoversData.push(jp_d)
          index = 1
          break
        }
        index++
      }

      for (const zh_p of zh_pkgfronts) {
        if (index === zh_pkgfronts.length && zh_pkgfronts.length > 1 && !isHasCover.zh) {
          finalCoversData.push(zh_p)
          index = 1
        }
        if (zh_p.dims[0] / zh_p.dims[1] <= 0.8 && !isHasCover.zh) {
          finalCoversData.push(zh_p)
          index = 1
          break
        }
        index++
      }
      for (const en_p of en_pkgfronts) {
        if (index === en_pkgfronts.length && en_pkgfronts.length > 1 && !isHasCover.en) {
          finalCoversData.push(en_p)
          index = 1
        }
        if (en_p.dims[0] / en_p.dims[1] <= 0.8 && !isHasCover.en) {
          finalCoversData.push(en_p)
          index = 1
          break
        }
        index++
      }
      for (const jp_p of jp_pkgfronts) {
        if (index === jp_pkgfronts.length && jp_pkgfronts.length > 1 && !isHasCover.jp) {
          finalCoversData.push(jp_p)
        }
        if (jp_p.dims[0] / jp_p.dims[1] <= 0.8 && !isHasCover.jp) {
          finalCoversData.push(jp_p)
          break
        }
        index++
      }
    } catch (error) {
      console.error(error)
      throw error
    }
    if (!finalCoversData.length && rawGameData.image) {
      const langMap = {
        zh: 'zh',
        en: 'en',
        ja: 'ja',
      }
      const language = langMap[rawGameData.olang as keyof typeof langMap] ?? 'ja'
      finalCoversData.push({
        language,
        type: 'dig',
        url: rawGameData.image.url,
        dims: rawGameData.image.dims,
        sexual: rawGameData.image.sexual,
        violence: rawGameData.image.violence,
      })
    }

    if (finalCoversData.every(c => c.sexual > 1)) {
      finalGameData.nsfw = true
    }
    dedupeCharactersInPlace(finalCharactersData)
    dedupeDevelopersInPlace(finalProducersData)
    return { finalGameData, finalCharactersData, finalProducersData, finalCoversData }
  }

  private formatString(str: string | undefined) {
    if (!str) return ''
    return str
      .replace(/[\n\r\t]/g, '')
      .replace(/\s*/g, '')
      .trim()
      .toLowerCase()
  }

  private consistencyCheck(b_data: BangumiGameItemRes, v_data: VNDBGameItemRes) {
    if (!b_data)
      throw new ShionBizException(
        ShionBizCode.GAME_BANGUMI_REQUEST_FAILED,
        'shion-biz.GAME_BANGUMI_REQUEST_FAILED',
      )
    if (!v_data)
      throw new ShionBizException(
        ShionBizCode.GAME_VNDB_REQUEST_FAILED,
        'shion-biz.GAME_VNDB_REQUEST_FAILED',
      )
    const bTitles = this.collectBangumiTitles(b_data)
    const vTitles = this.collectVNDBTitles(v_data)

    const yearClose = this.isReleaseYearClose(b_data.date, v_data.released, 1)
    if (yearClose) return

    const titleSimilar = this.isTitleSimilar(bTitles, vTitles)
    if (titleSimilar) return

    throw new ShionBizException(
      ShionBizCode.GAME_DATA_CONSISTENCY_CHECK_FAILED,
      undefined,
      undefined,
      undefined,
      {
        bangumiTitles: bTitles.slice(0, 10),
        vndbTitles: vTitles.slice(0, 10),
        yearClose,
      },
    )
  }

  private collectBangumiTitles(b_data: BangumiGameItemRes) {
    const titles: string[] = []
    if (b_data.name) titles.push(b_data.name)
    if (b_data.name_cn) titles.push(b_data.name_cn)
    const zhName = b_data.infobox.find(i => i.key === '中文名')?.value
    if (zhName) {
      if (typeof zhName === 'string') titles.push(zhName)
      else for (const v of zhName) titles.push(v.v)
    }
    const aliases = b_data.infobox.find(i => i.key === '别名')?.value
    if (aliases) {
      if (typeof aliases === 'string') titles.push(aliases)
      else for (const v of aliases) titles.push(v.v)
    }
    return titles.filter(Boolean)
  }

  private collectVNDBTitles(v_data: VNDBGameItemRes) {
    const titles: string[] = []
    for (const t of v_data.titles || []) {
      if (t.title) titles.push(t.title)
      if (t.latin) titles.push(t.latin)
    }
    if (Array.isArray(v_data.aliases)) titles.push(...v_data.aliases)
    return titles.filter(Boolean)
  }

  private isReleaseYearClose(
    bangumiDate: string | undefined,
    vndbReleased: string | undefined,
    diff = 1,
  ) {
    const by = this.safeParseYear(bangumiDate)
    const vy = this.safeParseYear(vndbReleased)
    if (!by || !vy) return false
    return Math.abs(by - vy) <= diff
  }

  private safeParseYear(str?: string) {
    if (!str) return undefined
    const match = String(str).match(/(19|20)\d{2}/)
    if (!match) return undefined
    const year = parseInt(match[0], 10)
    return isNaN(year) ? undefined : year
  }

  private isTitleSimilar(b_titles: string[], v_titles: string[]) {
    for (const b_title of b_titles) {
      for (const v_title of v_titles) {
        if (b_title.toLowerCase() === v_title.toLowerCase()) return true
      }
    }
    return false
  }
}
