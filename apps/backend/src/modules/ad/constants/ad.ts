import { Prisma } from '@prisma/client'

export const PUBLIC_SELECT = {
  id: true,
  image_zh: true,
  image_ja: true,
  image_en: true,
  aspect: true,
  link: true,
  exclude_locales: true,
} satisfies Prisma.AdSelect
