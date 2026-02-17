import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { EditRecordItem } from '@/interfaces/user/edits.interface'
import { EditsContent } from '@/components/user/home/edits/EditsContent'
import { Pagination } from '@/components/common/content/Pagination'
import { Empty } from '@/components/common/content/Empty'

interface UserEditsPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page: string }>
}

const getData = async (id: string, searchParams: { page: string }) => {
  const data = await shionlibRequest().get<PaginatedResponse<EditRecordItem>>(
    `/user/datas/${id}/edit-records`,
    {
      params: {
        page: searchParams.page ?? '1',
      },
    },
  )
  return data
}

export default async function UserEditsPage({ params, searchParams }: UserEditsPageProps) {
  const { id } = await params
  const { page } = await searchParams
  const data = await getData(id, { page })
  return (data.data?.items?.length ?? 0 > 0) ? (
    <div>
      <EditsContent edits={data.data?.items ?? []} />
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
