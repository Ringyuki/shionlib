import { CommentContent } from '@/components/common/comment/CommentContent'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Comment } from '@/interfaces/comment/comment.interface'

interface CommentsPageProps {
  params: Promise<{ id: string }>
}

export default async function CommentsPage({ params }: CommentsPageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<PaginatedResponse<Comment>>(`/comment/game/${id}`, {
    params: {
      page: 1,
      pageSize: 50,
    },
  })
  return <CommentContent game_id={id} comments={data.data?.items ?? []} />
}
