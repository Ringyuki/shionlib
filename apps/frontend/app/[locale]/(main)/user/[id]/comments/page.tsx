import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Comment } from '@/interfaces/comment/comment.interface'
import { CommentContent } from '@/components/user/home/comments/CommentContent'
import { Pagination } from '@/components/common/content/Pagination'
import { Empty } from '@/components/common/content/Empty'

interface UserCommentsPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page: string }>
}

const getData = async (id: string, page: string) => {
  const data = await shionlibRequest().get<
    PaginatedResponse<Comment, { is_current_user: boolean }>
  >(`/user/datas/${id}/comments`, {
    params: {
      page: page ?? '1',
    },
  })
  return data
}

export default async function UserCommentsPage({ params, searchParams }: UserCommentsPageProps) {
  const { id } = await params
  const { page } = await searchParams
  const data = await getData(id, page)
  return (data.data?.items?.length ?? 0 > 0) ? (
    <div>
      <CommentContent
        comments={data.data?.items ?? []}
        is_current_user={data.data?.meta.is_current_user ?? false}
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
