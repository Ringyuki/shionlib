import { shionlibRequest } from '@/utils/request'
import { Message as MessageInterface, MessageType } from '@/interfaces/message/message.interface'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import { Messages } from '@/components/message/message/Messages'

interface MessagePageProps {
  searchParams: Promise<{
    page: string
    type?: MessageType
    unread?: boolean
  }>
}

const getData = async (page: string, type?: MessageType, unread?: boolean) => {
  const params: Record<string, any> = {
    page: page ?? '1',
    pageSize: 15,
  }
  if (type) params.type = type
  if (unread) params.unread = unread
  const { data } = await shionlibRequest().get<PaginatedResponse<MessageInterface>>(
    '/message/list',
    {
      params,
    },
  )
  return data
}

export default async function MessagePage({ searchParams }: MessagePageProps) {
  const { page, type, unread } = await searchParams
  const data = await getData(page, type, unread)
  return <Messages messages={data?.items ?? []} meta={data?.meta!} />
}
