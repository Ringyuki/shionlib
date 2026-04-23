import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { BangumiAuthService } from '../../bangumi/services/bangumi-auth.service'
import { VNDBService } from '../../vndb/services/vndb.service'
import { BangumiProducerItemRes } from '../../game/interfaces/bangumi/producer-item.res.interface'
import { InfoboxValueArray } from '../../game/interfaces/bangumi/game-item.res.interface'
import { GameDeveloper } from '../../game/interfaces/game.interface'
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
  DeveloperScalarSyncFieldEnum,
  EditDeveloperReqDto,
} from '../dto/req/edit-developer.req.dto'
import { DeveloperEditService } from './developer-edit.service'

interface VNDBProducerItemRes {
  id: string
  name?: string
  original?: string
  aliases?: string[]
  description?: string
  extlinks?: Array<{ url: string; label?: string; name?: string }>
}

interface DeveloperSyncRecord {
  id: number
  b_id: string | null
  v_id: string | null
  name: string | null
  aliases: string[] | null
  intro_jp: string | null
  intro_zh: string | null
  intro_en: string | null
  extra_info: unknown
  logo: string | null
  website: string | null
}

interface DeveloperExternalSyncSnapshot {
  data: Partial<GameDeveloper>
  sources: Record<'name' | 'aliases' | 'intros', FieldSyncCandidateSource>
}

@Injectable()
export class DeveloperFieldSyncService {
  private readonly logger = new Logger(DeveloperFieldSyncService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly bangumiAuthService: BangumiAuthService,
    private readonly vndbService: VNDBService,
    private readonly developerEditService: DeveloperEditService,
  ) {}

  async previewBatch(developerId: number, fields: DeveloperScalarSyncFieldEnum[]) {
    const uniqueFields = [...new Set(fields)]
    const developer = await this.loadDeveloper(developerId)
    let snapshot: DeveloperExternalSyncSnapshot | undefined
    let snapshotError: unknown
    try {
      snapshot = await this.loadExternalSnapshot(developer)
    } catch (err) {
      snapshotError = err
    }
    const previews: ReturnType<typeof createFieldSyncPreview>[] = []
    const failedFields: DeveloperScalarSyncFieldEnum[] = []

    for (const field of uniqueFields) {
      try {
        if (snapshotError) throw snapshotError
        previews.push(
          createFieldSyncPreview(
            field,
            await this.buildCandidates(developerId, field, developer, snapshot),
          ),
        )
      } catch (err) {
        this.logger.warn(`Developer field sync preview failed for ${field}: ${err.message}`)
        failedFields.push(field)
      }
    }

    return { previews, failedFields }
  }

  async apply(
    developerId: number,
    field: DeveloperScalarSyncFieldEnum,
    candidateIds: string[],
    req: RequestWithUser,
    note?: string,
  ) {
    const selectedIds = new Set(candidateIds)
    const candidates = (await this.buildCandidates(developerId, field)).filter(
      candidate => candidate.applicable && selectedIds.has(candidate.id),
    )
    if (candidates.length === 0) return { applied: 0 }

    const scalar = candidates.reduce<EditDeveloperReqDto>((acc, candidate) => {
      return { ...acc, ...(candidate.apply?.scalar as EditDeveloperReqDto) }
    }, {})
    if (Object.keys(scalar).length === 0) return { applied: 0 }

    await this.developerEditService.editDeveloperScalar(developerId, { ...scalar, note }, req)
    return { applied: candidates.length }
  }

  private async buildCandidates(
    developerId: number,
    field: DeveloperScalarSyncFieldEnum,
    developer?: DeveloperSyncRecord,
    snapshot?: DeveloperExternalSyncSnapshot,
  ): Promise<InternalFieldSyncCandidate[]> {
    const localDeveloper = developer ?? (await this.loadDeveloper(developerId))
    const externalSnapshot = snapshot ?? (await this.loadExternalSnapshot(localDeveloper))

    switch (field) {
      case DeveloperScalarSyncFieldEnum.NAME:
        return createScalarGroupCandidate(developerId, field, externalSnapshot.sources.name, {
          local: { name: localDeveloper.name },
          remote: pickNonEmpty({ name: externalSnapshot.data.name }),
          title: 'Name',
        })
      case DeveloperScalarSyncFieldEnum.ALIASES:
        return createScalarGroupCandidate(developerId, field, externalSnapshot.sources.aliases, {
          local: { aliases: localDeveloper.aliases ?? [] },
          remote: { aliases: externalSnapshot.data.aliases ?? [] },
          title: 'Aliases',
          skipEmptyRemote: true,
        })
      case DeveloperScalarSyncFieldEnum.INTROS:
        return createScalarGroupCandidate(developerId, field, externalSnapshot.sources.intros, {
          local: {
            intro_jp: localDeveloper.intro_jp,
            intro_zh: localDeveloper.intro_zh,
            intro_en: localDeveloper.intro_en,
          },
          remote: pickNonEmpty({
            intro_jp: externalSnapshot.data.intro_jp,
            intro_zh: externalSnapshot.data.intro_zh,
            intro_en: externalSnapshot.data.intro_en,
          }),
          title: 'Introductions',
        })
      case DeveloperScalarSyncFieldEnum.EXTRA:
        return createScalarGroupCandidate(developerId, field, 'bangumi', {
          local: { extra_info: localDeveloper.extra_info ?? [] },
          remote: { extra_info: externalSnapshot.data.extra_info ?? [] },
          title: 'Extra info',
          skipEmptyRemote: true,
        })
      case DeveloperScalarSyncFieldEnum.LOGO:
        return createScalarGroupCandidate(developerId, field, 'bangumi', {
          local: { logo: localDeveloper.logo },
          remote: pickNonEmpty({ logo: externalSnapshot.data.logo }),
          title: 'Logo',
        })
      case DeveloperScalarSyncFieldEnum.WEBSITE:
        return createScalarGroupCandidate(developerId, field, 'vndb', {
          local: { website: localDeveloper.website },
          remote: pickNonEmpty({ website: externalSnapshot.data.website }),
          title: 'Website',
        })
    }
  }

  private async loadDeveloper(developerId: number) {
    const developer = await this.prisma.gameDeveloper.findUnique({
      where: { id: developerId },
      select: {
        id: true,
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
    if (!developer) throw new ShionBizException(ShionBizCode.GAME_DEVELOPER_NOT_FOUND)
    return developer
  }

  private async loadExternalSnapshot(developer: { b_id: string | null; v_id: string | null }) {
    const [bangumi, vndb] = await Promise.all([
      developer.b_id
        ? this.fetchBangumiDeveloper(developer.b_id)
        : Promise.resolve<Partial<GameDeveloper>>({}),
      developer.v_id
        ? this.fetchVNDBDeveloper(developer.v_id)
        : Promise.resolve<Partial<GameDeveloper>>({}),
    ])

    return {
      data: {
        name: vndb.name || bangumi.name,
        aliases: uniqueStrings([...(bangumi.aliases ?? []), ...(vndb.aliases ?? [])]),
        intro_jp: bangumi.intro_jp,
        intro_zh: bangumi.intro_zh,
        intro_en: vndb.intro_en,
        extra_info: bangumi.extra_info,
        logo: bangumi.logo,
        website: vndb.website,
      } satisfies Partial<GameDeveloper>,
      sources: {
        name: this.mergedSource(!!bangumi.name, !!vndb.name),
        aliases: this.mergedSource(!!bangumi.aliases?.length, !!vndb.aliases?.length),
        intros: this.mergedSource(!!(bangumi.intro_jp || bangumi.intro_zh), !!vndb.intro_en),
      },
    }
  }

  private async fetchBangumiDeveloper(bId: string): Promise<Partial<GameDeveloper>> {
    try {
      const raw = await this.bangumiAuthService.bangumiRequest<BangumiProducerItemRes>(
        `https://api.bgm.tv/v0/persons/${bId}`,
      )
      const data: Partial<GameDeveloper> = {
        b_id: String(raw.id),
        name: raw.name,
        logo: raw.images?.large,
      }

      if ((await detectLanguage(raw.summary)) === 'zh') data.intro_zh = raw.summary
      else data.intro_jp = raw.summary

      const rawAliases = raw.infobox.find(item => item.key === '别名')?.value
      if (rawAliases) data.aliases = this.toInfoboxValues(rawAliases)

      data.extra_info = raw.infobox
        .filter(item => !['简体中文名', '别名'].includes(item.key))
        .map(item => ({
          key: item.key,
          value:
            typeof item.value === 'string'
              ? item.value
              : item.value.map(value => value.v).join(', '),
        }))

      return data
    } catch (err) {
      this.logger.warn(`Bangumi developer sync failed: ${err.message}`)
      return {}
    }
  }

  private async fetchVNDBDeveloper(vId: string): Promise<Partial<GameDeveloper>> {
    try {
      const raw = await this.vndbService.vndbRequest<VNDBProducerItemRes>(
        'single',
        ['id', '=', this.ensureProducerId(vId)],
        ['id', 'name', 'original', 'aliases', 'description', 'extlinks{url,label,name}'],
        'producer',
      )
      if (!raw) return {}

      return {
        v_id: raw.id,
        name: raw.original || raw.name || raw.aliases?.[0],
        aliases: raw.aliases,
        intro_en: raw.description,
        website: raw.extlinks?.find(link => link.label === 'Official website')?.url,
      }
    } catch (err) {
      this.logger.warn(`VNDB developer sync failed: ${err.message}`)
      return {}
    }
  }

  private toInfoboxValues(value: string | InfoboxValueArray[]) {
    if (typeof value === 'string') return [value]
    return value.map(item => item.v)
  }

  private ensureProducerId(vId: string) {
    return vId.startsWith('p') ? vId : `p${vId}`
  }

  private mergedSource(hasBangumi: boolean, hasVNDB: boolean): FieldSyncCandidateSource {
    if (hasBangumi && hasVNDB) return 'merged'
    if (hasVNDB) return 'vndb'
    return 'bangumi'
  }
}
