import { AdminGamesClient } from '@/components/admin/games/AdminGamesClient'

interface AdminGamesPageProps {
  searchParams: Promise<{
    page?: string | string[]
  }>
}

export default async function AdminGamesPage({ searchParams }: AdminGamesPageProps) {
  const { page } = await searchParams

  return <AdminGamesClient initialPage={Number.isInteger(Number(page)) ? Number(page) : 1} />
}
