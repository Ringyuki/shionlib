import { Avatar, Inline, Text, useImageResolver } from '@hina-ui/react'

type UserRefProps = {
  user: { name: string; avatar: string | null }
}

export function UserRef({ user }: UserRefProps) {
  const resolveImage = useImageResolver()
  return (
    <Inline gap="sm" align="center" wrap={false} className="min-w-0">
      <Avatar
        size="sm"
        name={user.name}
        src={user.avatar === null ? undefined : resolveImage(user.avatar, 'image')}
        className="shrink-0"
      />
      <Text as="span" size="sm" weight="medium" truncate>
        {user.name}
      </Text>
    </Inline>
  )
}
