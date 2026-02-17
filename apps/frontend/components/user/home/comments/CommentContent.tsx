'use client'

import { Comment } from '@/interfaces/comment/comment.interface'
import { CommentItem } from '@/components/common/comment/CommentItem'
import { useRouter, Link } from '@/i18n/navigation.client'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { GameData } from '@/interfaces/game/game.interface'
import { useLocale } from 'next-intl'

interface CommentContentProps {
  comments: Comment[]
  is_current_user: boolean
}

export const CommentContent = ({ comments, is_current_user }: CommentContentProps) => {
  const router = useRouter()
  const locale = useLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  return (
    <div className="flex flex-col gap-6">
      {comments.map(comment => {
        const { title } = getPreferredContent(comment.game as unknown as GameData, 'title', lang)
        return (
          <Link
            href={`/game/${comment.game?.id}/comments#data-comment-id-${comment.id}`}
            key={comment.id}
            className="hover:opacity-85 transition-all duration-200"
          >
            <CommentItem
              comment={comment}
              likeable={false}
              showReplyBtn={false}
              showDeleteBtn={false}
              showEditBtn={is_current_user}
              canScrollToParent={false}
              onEdited={() => router.refresh()}
              showSource={true}
              sourceTitle={title}
            />
          </Link>
        )
      })}
    </div>
  )
}
