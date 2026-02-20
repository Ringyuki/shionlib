import { PrismaClient, UserLang } from '@prisma/client'
import { e2e_users } from './users'

export interface SeededUser {
  id: number
  name: string
  email: string
  favorites: { id: number; default: boolean }[]
}

export interface SeededMutableUser {
  id: number
}

export interface SeededUsers {
  admin: SeededUser
  member: SeededUser
  mutableMember: SeededMutableUser
}

const buildUserCreateData = (
  user: { name: string; email: string; role: number },
  passwordHash: string,
  contentLimit: number,
  quotaSize: bigint,
) => ({
  name: user.name,
  email: user.email,
  password: passwordHash,
  role: user.role,
  lang: UserLang.en,
  content_limit: contentLimit,
  upload_quota: {
    create: {
      size: quotaSize,
      used: 0n,
      is_first_grant: true,
    },
  },
  favorites: {
    create: {
      name: 'default',
      default: true,
    },
  },
})

export const seedUsers = async (
  prisma: PrismaClient,
  passwordHash: string,
): Promise<SeededUsers> => {
  const admin = await prisma.user.create({
    data: buildUserCreateData(e2e_users.admin, passwordHash, 3, 20_000_000_000n),
    select: {
      id: true,
      name: true,
      email: true,
      favorites: {
        select: {
          id: true,
          default: true,
        },
      },
    },
  })

  const member = await prisma.user.create({
    data: buildUserCreateData(e2e_users.user, passwordHash, 2, 10_000_000_000n),
    select: {
      id: true,
      name: true,
      email: true,
      favorites: {
        select: {
          id: true,
          default: true,
        },
      },
    },
  })

  const mutableMember = await prisma.user.create({
    data: buildUserCreateData(e2e_users.mutableUser, passwordHash, 2, 10_000_000_000n),
    select: {
      id: true,
    },
  })

  await prisma.user.create({
    data: buildUserCreateData(e2e_users.permissionUser, passwordHash, 2, 10_000_000_000n),
    select: {
      id: true,
    },
  })

  await prisma.user.create({
    data: buildUserCreateData(e2e_users.relationUser, passwordHash, 2, 10_000_000_000n),
    select: {
      id: true,
    },
  })

  await prisma.user.create({
    data: buildUserCreateData(e2e_users.adminOpsUser, passwordHash, 2, 10_000_000_000n),
    select: {
      id: true,
    },
  })

  return {
    admin,
    member,
    mutableMember,
  }
}
