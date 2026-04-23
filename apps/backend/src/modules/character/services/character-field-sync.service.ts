import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { BangumiAuthService } from '../../bangumi/services/bangumi-auth.service'
import { VNDBService } from '../../vndb/services/vndb.service'
import { BangumiCharacterItemRes } from '../../game/interfaces/bangumi/character-item.res.interface'
import { InfoboxValueArray } from '../../game/interfaces/bangumi/game-item.res.interface'
import {
  GameCharacter,
  GameCharacterBloodType,
  GameCharacterGender,
} from '../../game/interfaces/game.interface'
import { detectLanguage } from '../../game/utils/language-detector.util'
import {
  createFieldSyncPreview,
  createScalarGroupCandidate,
  FieldSyncCandidateSource,
  InternalFieldSyncCandidate,
  pickNonEmpty,
  uniqueStrings,
} from '../../edit/helpers/field-sync'
import {
  CharacterScalarSyncFieldEnum,
  EditCharacterReqDto,
} from '../dto/req/edit-character.req.dto'
import { CharacterEditService } from './character-edit.service'

interface VNDBCharacterItemRes {
  id: string
  name?: string
  original?: string
  aliases?: string[]
  description?: string
  image?: { url?: string }
  blood_type?: GameCharacterBloodType
  height?: number
  weight?: number
  bust?: number
  waist?: number
  hips?: number
  cup?: string
  age?: number
  birthday?: number[]
  gender?: GameCharacterGender[]
}

interface CharacterSyncRecord {
  id: number
  b_id: string | null
  v_id: string | null
  name_jp: string | null
  name_zh: string | null
  name_en: string | null
  aliases: string[] | null
  intro_jp: string | null
  intro_zh: string | null
  intro_en: string | null
  image: string | null
  blood_type: GameCharacterBloodType | null
  height: number | null
  weight: number | null
  bust: number | null
  waist: number | null
  hips: number | null
  cup: string | null
  age: number | null
  birthday: number[] | null
  gender: GameCharacterGender[] | null
}

interface CharacterExternalSyncSnapshot {
  data: Partial<GameCharacter>
  sources: Record<'names' | 'aliases' | 'intros' | 'image', FieldSyncCandidateSource>
}

@Injectable()
export class CharacterFieldSyncService {
  private readonly logger = new Logger(CharacterFieldSyncService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly bangumiAuthService: BangumiAuthService,
    private readonly vndbService: VNDBService,
    private readonly characterEditService: CharacterEditService,
  ) {}

  async previewBatch(characterId: number, fields: CharacterScalarSyncFieldEnum[]) {
    const uniqueFields = [...new Set(fields)]
    const character = await this.loadCharacter(characterId)
    let snapshot: CharacterExternalSyncSnapshot | undefined
    let snapshotError: unknown
    try {
      snapshot = await this.loadExternalSnapshot(character)
    } catch (err) {
      snapshotError = err
    }
    const previews: ReturnType<typeof createFieldSyncPreview>[] = []
    const failedFields: CharacterScalarSyncFieldEnum[] = []

    for (const field of uniqueFields) {
      try {
        if (snapshotError) throw snapshotError
        previews.push(
          createFieldSyncPreview(
            field,
            await this.buildCandidates(characterId, field, character, snapshot),
          ),
        )
      } catch (err) {
        this.logger.warn(`Character field sync preview failed for ${field}: ${err.message}`)
        failedFields.push(field)
      }
    }

    return { previews, failedFields }
  }

  async apply(
    characterId: number,
    field: CharacterScalarSyncFieldEnum,
    candidateIds: string[],
    req: RequestWithUser,
    note?: string,
  ) {
    const selectedIds = new Set(candidateIds)
    const candidates = (await this.buildCandidates(characterId, field)).filter(
      candidate => candidate.applicable && selectedIds.has(candidate.id),
    )
    if (candidates.length === 0) return { applied: 0 }

    const scalar = candidates.reduce<EditCharacterReqDto>((acc, candidate) => {
      return { ...acc, ...(candidate.apply?.scalar as EditCharacterReqDto) }
    }, {})
    if (Object.keys(scalar).length === 0) return { applied: 0 }

    await this.characterEditService.editCharacterScalar(characterId, { ...scalar, note }, req)
    return { applied: candidates.length }
  }

  private async buildCandidates(
    characterId: number,
    field: CharacterScalarSyncFieldEnum,
    character?: CharacterSyncRecord,
    snapshot?: CharacterExternalSyncSnapshot,
  ): Promise<InternalFieldSyncCandidate[]> {
    const localCharacter = character ?? (await this.loadCharacter(characterId))
    const externalSnapshot = snapshot ?? (await this.loadExternalSnapshot(localCharacter))

    switch (field) {
      case CharacterScalarSyncFieldEnum.NAMES:
        return createScalarGroupCandidate(characterId, field, externalSnapshot.sources.names, {
          local: {
            name_jp: localCharacter.name_jp,
            name_zh: localCharacter.name_zh,
            name_en: localCharacter.name_en,
          },
          remote: pickNonEmpty({
            name_jp: externalSnapshot.data.name_jp,
            name_zh: externalSnapshot.data.name_zh,
            name_en: externalSnapshot.data.name_en,
          }),
          title: 'Names',
        })
      case CharacterScalarSyncFieldEnum.ALIASES:
        return createScalarGroupCandidate(characterId, field, externalSnapshot.sources.aliases, {
          local: { aliases: localCharacter.aliases ?? [] },
          remote: { aliases: externalSnapshot.data.aliases ?? [] },
          title: 'Aliases',
          skipEmptyRemote: true,
        })
      case CharacterScalarSyncFieldEnum.INTROS:
        return createScalarGroupCandidate(characterId, field, externalSnapshot.sources.intros, {
          local: {
            intro_jp: localCharacter.intro_jp,
            intro_zh: localCharacter.intro_zh,
            intro_en: localCharacter.intro_en,
          },
          remote: pickNonEmpty({
            intro_jp: externalSnapshot.data.intro_jp,
            intro_zh: externalSnapshot.data.intro_zh,
            intro_en: externalSnapshot.data.intro_en,
          }),
          title: 'Introductions',
        })
      case CharacterScalarSyncFieldEnum.IMAGE:
        return createScalarGroupCandidate(characterId, field, externalSnapshot.sources.image, {
          local: { image: localCharacter.image },
          remote: pickNonEmpty({ image: externalSnapshot.data.image }),
          title: 'Image',
        })
      case CharacterScalarSyncFieldEnum.BODY_METRICS:
        return createScalarGroupCandidate(characterId, field, 'vndb', {
          local: {
            height: localCharacter.height,
            weight: localCharacter.weight,
            bust: localCharacter.bust,
            waist: localCharacter.waist,
            hips: localCharacter.hips,
            cup: localCharacter.cup,
          },
          remote: pickNonEmpty({
            height: externalSnapshot.data.height,
            weight: externalSnapshot.data.weight,
            bust: externalSnapshot.data.bust,
            waist: externalSnapshot.data.waist,
            hips: externalSnapshot.data.hips,
            cup: externalSnapshot.data.cup,
          }),
          title: 'Body metrics',
        })
      case CharacterScalarSyncFieldEnum.AGE_BIRTHDAY:
        return createScalarGroupCandidate(characterId, field, 'vndb', {
          local: {
            age: localCharacter.age,
            birthday: localCharacter.birthday,
          },
          remote: pickNonEmpty({
            age: externalSnapshot.data.age,
            birthday: externalSnapshot.data.birthday,
          }),
          title: 'Age and birthday',
        })
      case CharacterScalarSyncFieldEnum.BLOOD_TYPE:
        return createScalarGroupCandidate(characterId, field, 'vndb', {
          local: { blood_type: localCharacter.blood_type },
          remote: pickNonEmpty({ blood_type: externalSnapshot.data.blood_type }),
          title: 'Blood type',
        })
      case CharacterScalarSyncFieldEnum.GENDER:
        return createScalarGroupCandidate(characterId, field, 'vndb', {
          local: { gender: localCharacter.gender ?? [] },
          remote: { gender: externalSnapshot.data.gender ?? [] },
          title: 'Gender',
          skipEmptyRemote: true,
        })
    }
  }

  private async loadCharacter(characterId: number) {
    const character = await this.prisma.gameCharacter.findUnique({
      where: { id: characterId },
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
    if (!character) throw new ShionBizException(ShionBizCode.GAME_CHARACTER_NOT_FOUND)
    return character
  }

  private async loadExternalSnapshot(character: { b_id: string | null; v_id: string | null }) {
    const [bangumi, vndb] = await Promise.all([
      character.b_id
        ? this.fetchBangumiCharacter(character.b_id)
        : Promise.resolve<Partial<GameCharacter>>({}),
      character.v_id
        ? this.fetchVNDBCharacter(character.v_id)
        : Promise.resolve<Partial<GameCharacter>>({}),
    ])

    return {
      data: {
        name_jp: vndb.name_jp || bangumi.name_jp,
        name_zh: bangumi.name_zh || vndb.name_zh,
        name_en: vndb.name_en,
        aliases: uniqueStrings([...(bangumi.aliases ?? []), ...(vndb.aliases ?? [])]),
        intro_jp: bangumi.intro_jp,
        intro_zh: bangumi.intro_zh,
        intro_en: vndb.intro_en,
        image: bangumi.image || vndb.image,
        blood_type: vndb.blood_type,
        height: vndb.height,
        weight: vndb.weight,
        bust: vndb.bust,
        waist: vndb.waist,
        hips: vndb.hips,
        cup: vndb.cup,
        age: vndb.age,
        birthday: vndb.birthday,
        gender: vndb.gender,
      } satisfies Partial<GameCharacter>,
      sources: {
        names: this.mergedSource(
          !!(bangumi.name_jp || bangumi.name_zh),
          !!(vndb.name_jp || vndb.name_zh || vndb.name_en),
        ),
        aliases: this.mergedSource(!!bangumi.aliases?.length, !!vndb.aliases?.length),
        intros: this.mergedSource(!!(bangumi.intro_jp || bangumi.intro_zh), !!vndb.intro_en),
        image: this.mergedSource(!!bangumi.image, !!vndb.image),
      },
    }
  }

  private async fetchBangumiCharacter(bId: string): Promise<Partial<GameCharacter>> {
    try {
      const raw = await this.bangumiAuthService.bangumiRequest<BangumiCharacterItemRes>(
        `https://api.bgm.tv/v0/characters/${bId}`,
      )
      const data: Partial<GameCharacter> = {
        b_id: String(raw.id),
        name_jp: raw.name,
        image: raw.images?.large,
      }

      const nameZh = raw.infobox.find(item => item.key === '简体中文名')?.value
      if (typeof nameZh === 'string') data.name_zh = nameZh

      if ((await detectLanguage(raw.summary)) === 'zh') data.intro_zh = raw.summary
      else data.intro_jp = raw.summary

      const rawAliases = raw.infobox.find(item => item.key === '别名')?.value
      if (rawAliases) data.aliases = this.toInfoboxValues(rawAliases)

      return data
    } catch (err) {
      this.logger.warn(`Bangumi character sync failed: ${err.message}`)
      return {}
    }
  }

  private async fetchVNDBCharacter(vId: string): Promise<Partial<GameCharacter>> {
    try {
      const raw = await this.vndbService.vndbRequest<VNDBCharacterItemRes>(
        'single',
        ['id', '=', this.ensureCharacterId(vId)],
        [
          'id',
          'aliases',
          'description',
          'name',
          'original',
          'blood_type',
          'height',
          'weight',
          'bust',
          'waist',
          'hips',
          'cup',
          'age',
          'birthday',
          'gender',
          'image{url}',
        ],
        'character',
      )
      if (!raw) return {}

      const data: Partial<GameCharacter> = {
        v_id: raw.id,
        name_en: raw.name,
        aliases: raw.aliases,
        intro_en: raw.description,
        blood_type: raw.blood_type,
        height: raw.height,
        weight: raw.weight,
        bust: raw.bust,
        waist: raw.waist,
        hips: raw.hips,
        cup: raw.cup,
        age: raw.age,
        birthday: raw.birthday,
        gender: raw.gender?.filter(Boolean),
        image: raw.image?.url,
      }

      const originalLanguage = raw.original ? await detectLanguage(raw.original) : 'unknown'
      if (originalLanguage === 'zh') data.name_zh = raw.original
      else if (raw.original) data.name_jp = raw.original

      return data
    } catch (err) {
      this.logger.warn(`VNDB character sync failed: ${err.message}`)
      return {}
    }
  }

  private toInfoboxValues(value: string | InfoboxValueArray[]) {
    if (typeof value === 'string') return [value]
    return value.map(item => item.v)
  }

  private ensureCharacterId(vId: string) {
    return vId.startsWith('c') ? vId : `c${vId}`
  }

  private mergedSource(hasBangumi: boolean, hasVNDB: boolean): FieldSyncCandidateSource {
    if (hasBangumi && hasVNDB) return 'merged'
    if (hasVNDB) return 'vndb'
    return 'bangumi'
  }
}
