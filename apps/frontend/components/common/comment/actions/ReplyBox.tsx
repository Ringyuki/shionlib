import { CommentBox } from '../CommentBox'

interface ReplyBoxProps {
  isReply: boolean
  game_id: string
  parent_id: number
  onSubmitSuccess?: () => void
}

export const ReplyBox = ({ isReply, game_id, parent_id, onSubmitSuccess }: ReplyBoxProps) => {
  return (
    isReply && (
      <CommentBox
        game_id={game_id as string}
        parent_id={parent_id.toString()}
        onSubmitSuccess={onSubmitSuccess}
      />
    )
  )
}
