import { AdminReportsClient } from '@/components/admin/reports/AdminReportsClient'

interface AdminReportsPageProps {
  searchParams: Promise<{
    page?: string | string[]
  }>
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const { page } = await searchParams

  return <AdminReportsClient initialPage={Number.isInteger(Number(page)) ? Number(page) : 1} />
}
