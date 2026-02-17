import { shionlibRequest } from '@/utils/request'
import { Message as MessageInterface, MessageType } from '@/interfaces/message/message.interface'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Messages } from '@/components/message/message/Messages'

interface CommentLikeMessagePageProps {
  searchParams: Promise<{
    page: string
    unread?: boolean
  }>
}

const getData = async (page: string, unread?: boolean) => {
  const params: Record<string, any> = {
    page: page ?? '1',
    pageSize: 15,
  }
  if (unread) params.unread = unread
  const { data } = await shionlibRequest().get<PaginatedResponse<MessageInterface>>(
    '/message/list',
    {
      params: {
        ...params,
        type: MessageType.COMMENT_LIKE,
      },
    },
  )
  return data
}

export default async function CommentLikeMessagePage({
  searchParams,
}: CommentLikeMessagePageProps) {
  const { page, unread } = await searchParams
  const data = await getData(page, unread)
  return <Messages messages={data?.items ?? []} meta={data?.meta!} />
}
