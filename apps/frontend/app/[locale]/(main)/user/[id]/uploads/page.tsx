import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { GameResourcesItem } from '@/interfaces/user/uploads.interface'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { UploadsContent } from '@/components/user/home/uploads/UploadsContent'
import { Pagination } from '@/components/common/content/Pagination'
import { Empty } from '@/components/common/content/Empty'

interface UploadsPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page: string }>
}

const getData = async (id: string, searchParams: { page: string }) => {
  const data = await shionlibRequest().get<
    PaginatedResponse<
      GameResourcesItem,
      { content_limit: ContentLimit; is_current_user: boolean; has_on_going_session: boolean }
    >
  >(`/user/datas/${id}/game-resources`, {
    params: {
      page: searchParams.page ?? '1',
    },
  })
  return data
}

export default async function UserUploadsPage({ params, searchParams }: UploadsPageProps) {
  const { id } = await params
  const { page } = await searchParams
  const data = await getData(id, { page })
  return (data.data?.items?.length ?? 0 > 0) ? (
    <div>
      <UploadsContent
        resources={data.data?.items ?? []}
        content_limit={data.data?.meta.content_limit}
        is_current_user={data.data?.meta.is_current_user}
        has_on_going_session={data.data?.meta.has_on_going_session}
      />
      <Pagination
        className="mt-4"
        currentPage={data.data?.meta.currentPage!}
        totalPages={data.data?.meta.totalPages!}
      />
    </div>
  ) : (
    <Empty />
  )
}
