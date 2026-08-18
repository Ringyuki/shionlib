export interface OpenMedia {
  url: string
  width: number | null
  height: number | null
  sexual: number
  violence: number
}

export interface OpenCover extends OpenMedia {
  votes: number
  language: string | null
  kind: 'DIG' | 'PKGFRONT' | null
}

export interface OpenEntityRef {
  id: number
  name: string
  trans_name: string | null
  image: OpenMedia | null
}

export interface OpenGalgamePrice {
  version: string | null
  amount: number | null
  currency: string | null
  tax_included: boolean | null
}

export interface OpenExternalLink {
  name: string
  label: string
  url: string
}

export interface OpenGalgameDetail {
  id: number
  origin_title: string
  trans_title: string | null
  en_title: string | null
  aliases: string[]
  covers: OpenCover[]
  images: OpenMedia[]
  release_date: string | null
  release_date_tbd: boolean
  release_date_tbd_note: string
  origin_intro: string | null
  trans_intro: string | null
  en_intro: string | null
  adv_type: string | null
  platforms: string[]
  homepage: string | null
  engine: string | null
  origin_lang: string | null
  dev_status: 'RELEASED' | 'IN_DEVELOPMENT' | 'CANCELLED' | null
  prices: OpenGalgamePrice[]
  external_links: OpenExternalLink[]
  nsfw: boolean
  tags: { name: string; likes: number }[]
  created_at: string
  updated_at: string
  revised_at: string | null
}

export interface OpenGalgameCharacter {
  role: 'MAIN' | 'PRIMARY' | 'SUPPORTING' | 'GUEST'
  actors: OpenEntityRef[]
  character: OpenEntityRef
}

export interface OpenGalgameStaff {
  role: string | null
  person: OpenEntityRef
}

export interface OpenGalgameProducer {
  role: 'DEVELOPER' | 'PUBLISHER' | 'LOCALIZER' | null
  note: string
  producer: OpenEntityRef
}

export interface OpenGalgameRelation {
  relation: string
  galgame: {
    id: number
    origin_title: string
    trans_title: string | null
    nsfw: boolean
    release_date: string | null
  }
}

export interface OpenCharacterDetail {
  id: number
  name: string
  trans_name: string | null
  en_name: string | null
  aliases: string[]
  intro: string
  trans_intro: string | null
  en_intro: string | null
  image: OpenMedia | null
  gender: string | null
  blood_type: string | null
  birthday_month: number | null
  birthday_day: number | null
  height: number | null
  weight: number | null
  bust: number | null
  waist: number | null
  hips: number | null
  cup: string | null
  age: number | null
  revised_at: string | null
}

export interface OpenProducerDetail {
  id: number
  name: string
  type: string
  aliases: string[]
  intro: string | null
  trans_intro: string | null
  en_intro: string | null
  country: string
  established: string | null
  website: string | null
  logo: OpenMedia | null
  revised_at: string | null
}
