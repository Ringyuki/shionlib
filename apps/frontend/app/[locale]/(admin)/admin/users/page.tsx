import { shionlibRequest } from '@/utils/request'
import { User } from '@/interfaces/user/user.interface'
import { AdminUsersClient } from '@/components/admin/users/AdminUsersClient'

interface AdminUsersPageProps {
  searchParams: Promise<{
    page?: string | string[]
  }>
}

async function getMe() {
  const res = await shionlibRequest({ forceNotThrowError: true }).get<User>('/user/me')
  return res.data
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const me = await getMe()
  const { page } = await searchParams

  return (
    <AdminUsersClient
      initialPage={Number.isInteger(Number(page)) ? Number(page) : 1}
      currentRole={me?.role ?? 1}
      currentUserId={me?.id ?? 0}
    />
  )
}
