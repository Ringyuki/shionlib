import { Avatar, Card, Grid, Inline, PageHeader, Stack, Text } from '@hina-ui/react'
import { Link } from 'react-router'
import { useTranslations } from 'use-intl'
import { friends, hostOf } from '../friends'

export function FriendsPage() {
  const t = useTranslations('friends')
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Grid as="ul" className="gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {friends.map(friend => (
          <Card key={friend.url} as="li" padded={false} className="hn-interactive overflow-hidden">
            <Link to={friend.url} target="_blank" rel="noreferrer" className="block h-full p-4">
              <Stack gap="sm">
                <Inline gap="sm" align="center" wrap={false}>
                  <Avatar name={friend.name} src={friend.logo} className="shrink-0" />
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
