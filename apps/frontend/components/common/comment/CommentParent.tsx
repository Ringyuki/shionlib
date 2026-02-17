import { Comment } from '@/interfaces/comment/comment.interface'
import { Avatar } from '@/components/common/user/Avatar'
import { useTranslations } from 'next-intl'
import { ScrollArea } from '@/components/shionui/ScrollArea'
import { cn } from '@/utils/cn'
import { useScrollToElem } from '@/hooks/useScrollToElem'

interface CommentParentProps {
  parent: Comment['parent']
  canScrollToParent?: boolean
}

export const CommentParent = ({ parent, canScrollToParent = true }: CommentParentProps) => {
  const t = useTranslations('Components.Common.Comment.CommentParent')
  const scrollToElem = useScrollToElem()
  const handleClick = () => {
    const commentContent = document.getElementById(`data-comment-id-${parent?.id}`)
    if (commentContent) {
      scrollToElem(commentContent)
      commentContent.classList.add('bg-primary/15')
      setTimeout(() => {
        commentContent.classList.remove('bg-primary/15')
      }, 1000)
    }
  }

  return (
    parent && (
      <div
        className={cn(
          'flex flex-col gap-2 rounded-md border p-4',
          canScrollToParent &&
            'cursor-pointer border hover:border-primary/40 hover:bg-primary/5 transition-colors duration-200',
        )}
        onClick={canScrollToParent ? handleClick : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t('parent')}</span>
          <Avatar user={parent.creator} className="size-6 text-xs" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">{parent.creator.name}</span>
          </div>
        </div>
        <ScrollArea className="h-12 max-h-24">
          <div dangerouslySetInnerHTML={{ __html: parent.html || '' }} />
        </ScrollArea>
      </div>
    )
  )
}
