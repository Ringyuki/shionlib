import { Button } from '@/components/shionui/Button'
import { Heart } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { useCommentListStore } from '@/store/commentListStore'

interface LikeProps {
  is_liked: boolean
  like_count: number
  comment_id: number
  likeable?: boolean
}

export const Like = ({ is_liked, like_count, comment_id, likeable = true }: LikeProps) => {
  const [isLiked_, setIsLiked_] = useState(is_liked)
  const [isLikedLoading, setIsLikedLoading] = useState(false)
  const { updateComment, getComment } = useCommentListStore()

  const handleLike = async () => {
    if (!likeable) return
    setIsLikedLoading(true)
    try {
      await shionlibRequest().post(`/comment/${comment_id}/like`)
      setIsLiked_(!isLiked_)
      const comment = getComment(comment_id)
      const liked = !isLiked_
      if (comment) {
        updateComment({
          ...comment,
          like_count: comment.like_count + (liked ? 1 : -1),
          is_liked: liked,
        })
      }
    } catch {
    } finally {
      setIsLikedLoading(false)
    }
  }
  return (
    <Button
      intent={isLiked_ ? 'destructive' : 'neutral'}
      size="sm"
      appearance="soft"
      renderIcon={<Heart className={cn(isLiked_ && 'fill-destructive')} />}
      onClick={handleLike}
      loading={isLikedLoading}
      disabled={!likeable}
      loginRequired
    >
      <span className="font-light">{like_count || 0}</span>
    </Button>
  )
}
