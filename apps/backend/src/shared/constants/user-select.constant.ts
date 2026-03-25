/**
 * Standard Prisma select for user avatar display.
 * Use this everywhere a user summary (avatar + name + sponsor status) is needed.
 */
export const USER_AVATAR_SELECT = {
  id: true,
  name: true,
  avatar: true,
  sponsor_expires_at: true,
} as const

/**
 * Maps a user record with sponsor_expires_at to a frontend-friendly object with is_sponsor.
 *
 * Overloads:
 * - When called with a non-null user, returns the mapped user object.
 * - When called with null/undefined, returns the input as-is (for optional relations).
 */
export function mapUserAvatar<
  T extends { id: number; name: string; avatar: string | null; sponsor_expires_at?: Date | null },
>(user: T): { id: number; name: string; avatar: string | null; is_sponsor: boolean }
export function mapUserAvatar(user: null | undefined): null | undefined
export function mapUserAvatar(
  user:
    | { id: number; name: string; avatar: string | null; sponsor_expires_at?: Date | null }
    | null
    | undefined,
) {
  if (!user) return user
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    is_sponsor: !!user.sponsor_expires_at && user.sponsor_expires_at > new Date(),
  }
}
