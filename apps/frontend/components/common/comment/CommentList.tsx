import { Comment } from '@/interfaces/comment/comment.interface'
import { CommentListClient } from './CommentListClient'

interface CommentListProps {
  comments: Comment[]
}

export const CommentList = ({ comments }: CommentListProps) => {
  return <CommentListClient initial={comments} />
}
