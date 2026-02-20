import { Button } from '@/components/shionui/Button'
import { MessageSquareReply } from 'lucide-react'

interface ReplyProps {
  comment_id: number
  onReplyClick: () => void
}

export const Reply = ({ comment_id, onReplyClick }: ReplyProps) => {
  return (
    <Button
      intent="neutral"
      size="sm"
      appearance="soft"
      renderIcon={<MessageSquareReply />}
      onClick={onReplyClick}
      data-testid={`comment-reply-${comment_id}`}
    />
  )
}
