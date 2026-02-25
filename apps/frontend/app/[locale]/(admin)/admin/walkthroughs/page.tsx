import { AdminWalkthroughsClient } from '@/components/admin/walkthroughs/AdminWalkthroughsClient'

interface AdminWalkthroughsPageProps {
  searchParams: Promise<{
    page?: string | string[]
  }>
}

export default async function AdminWalkthroughsPage({ searchParams }: AdminWalkthroughsPageProps) {
  const { page } = await searchParams

  return <AdminWalkthroughsClient initialPage={Number.isInteger(Number(page)) ? Number(page) : 1} />
}
