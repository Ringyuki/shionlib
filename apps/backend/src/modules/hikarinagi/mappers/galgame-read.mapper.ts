import {
  InternalCover,
  InternalGalgameBundle,
  InternalGalgameCard,
  InternalGalgameCharacter,
  InternalMedia,
} from '../interfaces/galgame-mapping.interface'
import {
  mapCharacterRole,
  mapCoverKind,
  mapCoverLanguage,
  mapDeveloperRole,
  mapStaffs,
} from './galgame-sync.mapper'

const GENDER_MAP: Record<string, string> = {
  男: 'm',
  '♂': 'm',
  雄: 'm',
  女: 'f',
  '♀': 'f',
  雌: 'f',
  两性: 'a',
  其他: 'o',
  不明: 'o',
}

function mapGender(value: unknown): string[] {
  if (typeof value !== 'string') return []
  const mapped = GENDER_MAP[value.trim()]
  return mapped ? [mapped] : []
}

function mapBloodType(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .trim()
    .replace(/型$/, '')
    .replace(/[Ａ-Ｚ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  const key = normalized.toLowerCase()
  return ['a', 'b', 'ab', 'o'].includes(key) ? key : null
}

function dims(media: InternalMedia | null): number[] {
  if (!media || media.width === null || media.height === null) return []
  return [media.width, media.height]
}

function cover(row: InternalCover) {
  return {
    language: mapCoverLanguage(row.language),
    type: mapCoverKind(row.kind as never),
    url: row.media.src,
    dims: dims(row.media),
    sexual: row.media.sexual ?? 0,
    violence: row.media.violence ?? 0,
  }
}

export function hasRatedMedia(bundle: InternalGalgameBundle): boolean {
  return bundle.galgame.nsfw || bundle.galgame.covers.some(row => (row.media.sexual ?? 0) > 0)
}

function covers(rows: InternalCover[], includeRated: boolean) {
  return rows.filter(row => includeRated || (row.media.sexual ?? 0) === 0).map(cover)
}

function developers(bundle: InternalGalgameBundle) {
  return bundle.producers
    .filter(row => row.role === 'DEVELOPER')
    .map(row => ({
      role: mapDeveloperRole(row.role),
      developer: {
        id: row.producer.id,
        name: row.producer.name,
        aliases: row.producer.aliases ?? [],
      },
    }))
}

function character(row: InternalGalgameCharacter) {
  const c = row.character
  return {
    role: mapCharacterRole(row.role as never),
    image: c.image?.src ?? null,
    actor: row.actors.length
      ? row.actors.map(actor => actor.trans_name || actor.name).join(', ')
      : null,
    character: {
      id: c.id,
      image: c.image?.src ?? null,
      name_jp: c.name,
      name_zh: c.trans_name ?? '',
      name_en: c.en_name ?? '',
      aliases: c.aliases,
      intro_jp: c.intro ?? '',
      intro_zh: c.trans_intro ?? '',
      intro_en: c.en_intro ?? '',
      gender: mapGender(c.gender),
      blood_type: mapBloodType(c.blood_type),
      height: c.height,
      weight: c.weight,
      bust: c.bust,
      waist: c.waist,
      hips: c.hips,
      cup: c.cup,
      age: c.age,
      birthday: c.birthday_month && c.birthday_day ? [c.birthday_month, c.birthday_day] : [],
    },
  }
}

function titles(g: {
  origin_lang?: string | null
  origin_title: string
  trans_title: string | null
  en_title?: string | null
  origin_intro?: string | null
  trans_intro?: string | null
  en_intro?: string | null
}) {
  const zhOrigin = g.origin_lang === 'zh-Hans' || g.origin_lang === 'zh-Hant'
  const enOrigin = g.origin_lang === 'en'
  const jaOrigin = !zhOrigin && !enOrigin

  return {
    title_jp: jaOrigin ? g.origin_title : '',
    title_zh: g.trans_title ?? (zhOrigin ? g.origin_title : ''),
    title_en: g.en_title ?? (enOrigin ? g.origin_title : ''),
    intro_jp: jaOrigin ? (g.origin_intro ?? '') : '',
    intro_zh: g.trans_intro ?? (zhOrigin ? (g.origin_intro ?? '') : ''),
    intro_en: g.en_intro ?? (enOrigin ? (g.origin_intro ?? '') : ''),
  }
}

export function mapBundleToTags(bundle: InternalGalgameBundle) {
  return [...bundle.tags]
    .sort((left, right) => right.tag.count - left.tag.count || left.tag.id - right.tag.id)
    .map(row => ({ tag_alias: null, tag: row.tag }))
}

export function mapBundleToHeader(bundle: InternalGalgameBundle, includeRated: boolean) {
  const g = bundle.galgame
  const { title_jp, title_zh, title_en } = titles(g)

  return {
    title_jp,
    title_zh,
    title_en,
    aliases: g.aliases,
    covers: covers(g.covers, includeRated),
    developers: developers(bundle),
    release_date: g.release_date,
    release_date_tba: g.release_date_tbd,
    type: g.adv_type,
    platform: g.platforms,
  }
}

export function mapBundleToCharacters(bundle: InternalGalgameBundle) {
  return bundle.characters.map(character)
}

export function mapBundleToDetails(bundle: InternalGalgameBundle, includeRated: boolean) {
  const g = bundle.galgame
  const { intro_jp, intro_zh, intro_en } = titles(g)
  const images = g.images
    .map(media => ({
      url: media.src,
      dims: dims(media),
      sexual: media.sexual ?? 0,
      violence: media.violence ?? 0,
    }))
    .filter(image => includeRated || image.sexual === 0)

  return {
    intro_jp,
    intro_zh,
    intro_en,
    images,
    staffs: mapStaffs(bundle.staff as never),
    nsfw: g.nsfw,
  }
}

export function mapBundleToGameDetail(bundle: InternalGalgameBundle, includeRated: boolean) {
  const g = bundle.galgame
  const zhOrigin = g.origin_lang === 'zh-Hans' || g.origin_lang === 'zh-Hant'
  const enOrigin = g.origin_lang === 'en'
  const jaOrigin = !zhOrigin && !enOrigin

  return {
    title_jp: jaOrigin ? g.origin_title : '',
    title_zh: g.trans_title ?? (zhOrigin ? g.origin_title : ''),
    title_en: g.en_title ?? (enOrigin ? g.origin_title : ''),
    intro_jp: jaOrigin ? (g.origin_intro ?? '') : '',
    intro_zh: g.trans_intro ?? (zhOrigin ? (g.origin_intro ?? '') : ''),
    intro_en: g.en_intro ?? (enOrigin ? (g.origin_intro ?? '') : ''),
    covers: covers(g.covers, includeRated),
    ...(includeRated
      ? {
          images: g.images.map(media => ({
            url: media.src,
            dims: dims(media),
            sexual: media.sexual ?? 0,
            violence: media.violence ?? 0,
          })),
        }
      : {}),
    developers: developers(bundle),
    characters: bundle.characters.map(character),
    staffs: mapStaffs(bundle.staff as never),
  }
}

export function mapCardToListItem(card: InternalGalgameCard, includeRated: boolean) {
  const { title_jp, title_zh, title_en } = titles(card)

  return {
    title_jp,
    title_zh,
    title_en,
    aliases: card.aliases ?? [],
    type: card.adv_type ?? null,
    covers: covers(card.covers, includeRated),
  }
}

export function emptyNestedGame() {
  return {
    title_jp: '',
    title_zh: '',
    title_en: '',
    aliases: [] as string[],
    type: null as string | null,
    covers: [] as ReturnType<typeof cover>[],
    intro_jp: '',
    intro_zh: '',
    intro_en: '',
    release_date: null as string | null,
    developers: [] as ReturnType<typeof cardDevelopers>,
  }
}

function cardDevelopers(card: InternalGalgameCard) {
  if (!card.developer) return []

  return [
    {
      role: mapDeveloperRole('DEVELOPER'),
      developer: { id: card.developer.id, name: card.developer.name, aliases: [] as string[] },
    },
  ]
}

export function mapCardToNestedGame(card: InternalGalgameCard, includeRated: boolean) {
  const { intro_jp, intro_zh, intro_en } = titles(card)

  return {
    ...mapCardToListItem(card, includeRated),
    intro_jp,
    intro_zh,
    intro_en,
    release_date: card.release_date,
    developers: cardDevelopers(card),
  }
}

type InternalEntity = Record<string, any>

export function mapBundleToLinks(bundle: InternalGalgameBundle) {
  const links = bundle.galgame.external_links ?? []

  return links.map((link, index) => ({
    id: index + 1,
    name: link.name,
    label: link.label,
    url: link.url,
  }))
}

export function mapBundleToRelations(
  bundle: InternalGalgameBundle,
  localIdByRemoteId: Map<number, number>,
  includeRated: boolean,
) {
  return (bundle.relations ?? []).flatMap(row => {
    const target = row.target_galgame
    if (!includeRated && (target.nsfw || target.covers.some(c => (c.media.sexual ?? 0) > 0)))
      return []
    const localId = localIdByRemoteId.get(target.id)
    if (localId === undefined) return []

    return [
      {
        id: target.id,
        relation: row.relation,
        to_game_id: localId,
        to_game: { ...mapCardToNestedGame(target, includeRated), id: localId },
      },
    ]
  })
}

export function mapCharacterDetail(row: InternalEntity) {
  const birthday =
    row.birthday_month && row.birthday_day ? [row.birthday_month, row.birthday_day] : []

  return {
    name_jp: row.name ?? '',
    name_zh: row.trans_name ?? '',
    name_en: row.en_name ?? '',
    aliases: row.aliases ?? [],
    intro_jp: row.intro ?? '',
    intro_zh: row.trans_intro ?? '',
    intro_en: row.en_intro ?? '',
    image: row.image?.src ?? null,
    blood_type: mapBloodType(row.blood_type),
    height: row.height ?? null,
    weight: row.weight ?? null,
    bust: row.bust ?? null,
    waist: row.waist ?? null,
    hips: row.hips ?? null,
    cup: row.cup ?? null,
    age: row.age ?? null,
    birthday,
    gender: mapGender(row.gender),
  }
}

export function mapProducerDetail(row: InternalEntity) {
  const labels = Array.isArray(row.labels) ? (row.labels as InternalEntity[]) : []
  const extra = [...labels]
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map(label => ({ key: String(label.key), value: String(label.value) }))
  const hasCountry = extra.some(item => item.key === '国家/地区' || item.key === '国家')
  if (!hasCountry && typeof row.country === 'string' && row.country.trim())
    extra.push({ key: '国家/地区', value: row.country })

  return {
    name: row.name ?? '',
    aliases: row.aliases ?? [],
    logo: row.logo?.src ?? null,
    intro_jp: row.intro ?? '',
    intro_zh: row.trans_intro ?? '',
    intro_en: row.en_intro ?? '',
    website: row.website ?? null,
    extra_info: extra,
  }
}
