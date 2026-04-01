import { AdminAdsClient } from '@/components/admin/ads/AdminAdsClient'

interface AdminAdsPageProps {
  searchParams: Promise<{
    page?: string | string[]
  }>
}

export default async function AdminAdsPage({ searchParams }: AdminAdsPageProps) {
  const { page } = await searchParams

  return <AdminAdsClient initialPage={Number.isInteger(Number(page)) ? Number(page) : 1} />
}
