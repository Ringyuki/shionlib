import { Button } from '@/components/shionui/Button'
import { MessageSquareReply } from 'lucide-react'

interface ReplyProps {
  onReplyClick: () => void
}

export const Reply = ({ onReplyClick }: ReplyProps) => {
  return (
    <Button
      intent="neutral"
      size="sm"
      appearance="soft"
      renderIcon={<MessageSquareReply />}
      onClick={onReplyClick}
    />
  )
}
