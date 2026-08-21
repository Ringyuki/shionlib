import { UserContentLimit } from '../interfaces/user.interface'

export const includesRated = (content_limit?: number): boolean => {
  return (
    content_limit === UserContentLimit.SHOW_WITH_SPOILER ||
    content_limit === UserContentLimit.JUST_SHOW
  )
}
