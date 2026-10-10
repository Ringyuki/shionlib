import { useAimed } from '~/shared/route/use-aimed'
import { aimsAt } from './comment'

export function useCommentFocus(commentId: number) {
  return useAimed(hash => aimsAt(hash, commentId))
}
