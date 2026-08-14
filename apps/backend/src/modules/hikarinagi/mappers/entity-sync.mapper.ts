import { GameCharacterBloodType, GameCharacterGender, Prisma } from '@prisma/client'
import { OpenCharacterDetail, OpenProducerDetail } from '../interfaces/open-api.interface'

const INTRO_PLACEHOLDER = '暂无'

const BLOOD_TYPE_MAP: Record<string, GameCharacterBloodType> = {
  A: GameCharacterBloodType.a,
  B: GameCharacterBloodType.b,
  AB: GameCharacterBloodType.ab,
  O: GameCharacterBloodType.o,
}

const GENDER_MALE = new Set(['男', '♂', 'm', 'M', 'male'])
const GENDER_FEMALE = new Set(['女', '♀', 'f', 'F', 'female'])

function cleanIntro(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  return trimmed === INTRO_PLACEHOLDER ? '' : trimmed
}

export function mapBloodType(value: string | null): GameCharacterBloodType | null {
  if (!value) return null
  return BLOOD_TYPE_MAP[value.trim().toUpperCase()] ?? null
}

export function mapGender(value: string | null): GameCharacterGender[] {
  const trimmed = (value ?? '').trim()
  if (GENDER_MALE.has(trimmed)) return [GameCharacterGender.m]
  if (GENDER_FEMALE.has(trimmed)) return [GameCharacterGender.f]
  return []
}

export function mapCharacterFields(
  detail: OpenCharacterDetail,
): Omit<Prisma.GameCharacterUpdateInput, 'image'> {
  return {
    name_jp: detail.name,
    name_zh: detail.trans_name,
    name_en: detail.en_name,
    aliases: detail.aliases,
    intro_jp: cleanIntro(detail.intro),
    intro_zh: cleanIntro(detail.trans_intro),
    intro_en: cleanIntro(detail.en_intro),
    blood_type: mapBloodType(detail.blood_type),
    gender: mapGender(detail.gender),
    birthday:
      detail.birthday_month !== null && detail.birthday_day !== null
        ? [detail.birthday_month, detail.birthday_day]
        : [],
    height: detail.height,
    weight: detail.weight,
    bust: detail.bust,
    waist: detail.waist,
    hips: detail.hips,
    cup: detail.cup ? detail.cup.trim().toUpperCase() : null,
    age: detail.age,
  }
}

export function mapDeveloperFields(
  detail: OpenProducerDetail,
): Omit<Prisma.GameDeveloperUpdateInput, 'logo'> {
  return {
    name: detail.name,
    aliases: detail.aliases,
    intro_jp: cleanIntro(detail.intro),
    intro_zh: cleanIntro(detail.trans_intro),
    intro_en: cleanIntro(detail.en_intro),
    website: detail.website,
  }
}
