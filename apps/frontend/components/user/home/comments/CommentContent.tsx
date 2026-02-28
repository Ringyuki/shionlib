'use client'

import { Comment } from '@/interfaces/comment/comment.interface'
import { Link } from '@/i18n/navigation.client'
import { GameEmbeddedCard, EmbeddedGame } from '@/components/game/GameEmbeddedCard'
import { Card, CardContent } from '@/components/shionui/Card'
import { Avatar } from '@/components/common/user/Avatar'
import { timeFromNow } from '@/utils/time-format'
import { useLocale } from 'next-intl'
import { getPreferredContent } from '@/components/game/description/helpers/getPreferredContent'
import { useTranslations } from 'next-intl'

interface CommentContentProps {
  comments: Comment[]
  is_current_user: boolean
}

export const CommentContent = ({ comments }: CommentContentProps) => {
  const locale = useLocale()
  const t = useTranslations('Components.User.Home.Comments.CommentContent')
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {comments.map(comment => {
        const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
        const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
        const { title } = getPreferredContent(comment.game!, 'title', lang)
        return (
          <Card key={comment.id} className="py-0">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Avatar user={comment.creator} className="size-8 text-xs" />
                <div className="flex flex-col">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.creator.name}</span>
                    <span className="text-xs font-light">
                      {t('comment_at')} {title}
                    </span>
                  </span>
                  <span className="text-xs font-light">{timeFromNow(comment.created, locale)}</span>
                </div>
              </div>

              <Link
                href={`/game/${comment.game?.id}/comments#data-comment-id-${comment.id}`}
                className="block hover:opacity-85 transition-opacity duration-200"
              >
                <div
                  className="text-sm prose prose-sm dark:prose-invert max-w-none line-clamp-4"
                  dangerouslySetInnerHTML={{ __html: comment.html }}
                />
              </Link>

              {comment.game && <GameEmbeddedCard game={comment.game as EmbeddedGame} />}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
