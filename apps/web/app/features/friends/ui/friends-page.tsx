import {
  Avatar,
  Card,
  Empty,
  Grid,
  Inline,
  PageHeader,
  Stack,
  Text,
  useImageResolver,
} from '@hina-ui/react'
import { Link } from 'react-router'
import { useTranslations } from 'use-intl'
import { hostOf, type Friend } from '../friends'

export function FriendsPage({ friends }: { friends: Friend[] }) {
  const t = useTranslations('friends')
  const resolveImage = useImageResolver()
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      {friends.length === 0 && <Empty title={t('empty')} />}
      <Grid as="ul" className="gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {friends.map(friend => (
          <Card key={friend.id} as="li" padded={false} className="hn-interactive overflow-hidden">
            <Link to={friend.url} target="_blank" rel="noreferrer" className="block h-full p-4">
              <Stack gap="sm">
                <Inline gap="sm" align="center" wrap={false}>
                  <Avatar
                    name={friend.name}
                    src={friend.logo === null ? undefined : resolveImage(friend.logo, 'image')}
                    className="shrink-0"
                  />
                  <Stack gap="none" className="min-w-0">
                    <Text weight="medium" truncate>
                      {friend.name}
                    </Text>
                    <Text size="sm" tone="muted" truncate>
                      {hostOf(friend.url)}
                    </Text>
                  </Stack>
                </Inline>
                <Text size="sm">{friend.description}</Text>
              </Stack>
            </Link>
          </Card>
        ))}
      </Grid>
    </Stack>
  )
}
