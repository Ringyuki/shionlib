import { AdminSponsorsClient } from '@/components/admin/sponsors/AdminSponsorsClient'

interface AdminSponsorsPageProps {
  searchParams: Promise<{
    page?: string | string[]
  }>
}

export default async function AdminSponsorsPage({ searchParams }: AdminSponsorsPageProps) {
  const { page } = await searchParams

  return <AdminSponsorsClient initialPage={Number.isInteger(Number(page)) ? Number(page) : 1} />
}
