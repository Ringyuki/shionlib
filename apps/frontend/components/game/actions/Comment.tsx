import { Button } from '@/components/shionui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { MessageSquareMore } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation.client'
import { useScrollToElem } from '@/hooks/useScrollToElem'

interface CommentProps {
  className?: string
  gameId: number | string
}

export const Comment = ({ className, gameId }: CommentProps) => {
  const t = useTranslations('Components.Game.Actions')
  const router = useRouter()
  const scrollToElem = useScrollToElem()

  const handleComment = () => {
    router.push(`/game/${gameId}/comments`)

    const startedAt = Date.now()
    const scrollWhenReady = () => {
      const commentContent = document.getElementById('comment-content')
      if (commentContent) {
        scrollToElem(commentContent)
        return
      }
      if (Date.now() - startedAt >= 3000) return
      setTimeout(scrollWhenReady, 16)
    }
    scrollWhenReady()
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild className={className}>
        <Button
          size="icon"
          intent="success"
          appearance="ghost"
          loginRequired
          renderIcon={<MessageSquareMore />}
          onClick={handleComment}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span>{t('goToDiscussion')}</span>
      </TooltipContent>
    </Tooltip>
  )
}
