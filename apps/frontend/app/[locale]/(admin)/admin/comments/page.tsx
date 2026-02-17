import { AdminCommentsClient } from '@/components/admin/comments/AdminCommentsClient'

interface AdminCommentsPageProps {
  searchParams: Promise<{
    page?: string | string[]
  }>
}

export default async function AdminCommentsPage({ searchParams }: AdminCommentsPageProps) {
  const { page } = await searchParams

  return <AdminCommentsClient initialPage={Number.isInteger(Number(page)) ? Number(page) : 1} />
}
