import { GameScalar } from '@/interfaces/edit/scalar.interface'

export const normalizeScalar = (data: Partial<GameScalar>): Record<string, any> => ({
  b_id: data.b_id ?? null,
  v_id: data.v_id ?? null,
  title_jp: data.title_jp ?? '',
  title_zh: data.title_zh ?? '',
  title_en: data.title_en ?? '',
  platform: data.platform ?? [],
  aliases: data.aliases ?? [],
  intro_jp: data.intro_jp ?? '',
  intro_zh: data.intro_zh ?? '',
  intro_en: data.intro_en ?? '',
  release_date: data.release_date ?? null,
  release_date_tba: data.release_date_tba ?? false,
  extra_info: data.extra_info ?? [],
  tags: data.tags ?? [],
  staffs: data.staffs ?? [],
  nsfw: data.nsfw ?? false,
  type: data.type ?? null,
  ...(typeof data.status === 'number' ? { status: data.status } : {}),
})

export const GAME_SCALAR_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  properties: {
    b_id: { type: ['string', 'null'], description: 'Bangumi ID' },
    v_id: { type: ['string', 'null'], description: 'VNDB ID' },
    title_jp: { type: 'string' },
    title_zh: { type: 'string' },
    title_en: { type: 'string' },
    aliases: {
      type: 'array',
      items: { type: 'string' },
    },
    intro_jp: { type: 'string' },
    intro_zh: { type: 'string' },
    intro_en: { type: 'string' },
    release_date: {
      type: ['string', 'null'],
      format: 'date-time',
      description: 'ISO-8601 datetime, e.g. 2026-02-10T00:00:00.000Z',
    },
    release_date_tba: { type: 'boolean' },
    extra_info: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['key', 'value'],
      },
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    staffs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
        },
        required: ['name', 'role'],
      },
    },
    nsfw: { type: 'boolean' },
    type: { type: ['string', 'null'] },
    platform: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    status: {
      type: 'integer',
      enum: [1, 2],
      description: '1 = visible, 2 = hidden',
    },
  },
} as const
