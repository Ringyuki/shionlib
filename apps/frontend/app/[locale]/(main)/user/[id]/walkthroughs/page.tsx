import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Pagination } from '@/components/common/content/Pagination'
import { UserWalkthroughItem } from '@/interfaces/user/walkthroughs.interface'
import { WalkthroughContent } from '@/components/user/home/walkthroughs/WalkthroughContent'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface UserWalkthroughsPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; status?: string }>
}

const normalizeStatus = (status?: string): 'PUBLISHED' | 'DRAFT' | 'HIDDEN' | undefined => {
  if (status === 'PUBLISHED' || status === 'DRAFT' || status === 'HIDDEN') return status
  return undefined
}

const getData = async (id: string, searchParams: { page?: string; status?: string }) => {
  const status = normalizeStatus(searchParams.status)
  const data = await shionlibRequest().get<
    PaginatedResponse<
      UserWalkthroughItem,
      { is_current_user: boolean; content_limit: ContentLimit }
    >
  >(`/user/datas/${id}/walkthroughs`, {
    params: {
      page: searchParams.page ?? '1',
      ...(status ? { status } : {}),
    },
  })
  return data
}

export default async function UserWalkthroughsPage({
  params,
  searchParams,
}: UserWalkthroughsPageProps) {
  const { id } = await params
  const { page, status } = await searchParams
  const normalizedStatus = normalizeStatus(status)
  const { data } = await getData(id, { page, status })
  const activeStatus = data?.meta.is_current_user ? (normalizedStatus ?? 'all') : 'PUBLISHED'

  return (
    <div>
      <WalkthroughContent
        userId={id}
        walkthroughs={data?.items ?? []}
        is_current_user={data?.meta.is_current_user ?? false}
        activeStatus={activeStatus}
        content_limit={data?.meta.content_limit as ContentLimit}
      />
      <Pagination
        className="mt-4"
        currentPage={data?.meta.currentPage!}
        totalPages={data?.meta.totalPages!}
        extraQuery={normalizedStatus ? { status: normalizedStatus } : undefined}
      />
    </div>
  )
}
