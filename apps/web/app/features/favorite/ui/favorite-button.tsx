import { Button, Checkbox, Popover, Spinner, Stack, Text } from '@hina-ui/react'
import { Heart } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { useFavoriteLists } from '../use-favorite-lists'
import { useMembershipToggle } from '../use-membership-toggle'

type FavoriteButtonProps = {
  gameId: number
  favorited: boolean
  signedIn: boolean
}

export function FavoriteButton({ gameId, favorited, signedIn }: FavoriteButtonProps) {
  const t = useTranslations('favorite')
  const { lists, loading, load } = useFavoriteLists(gameId)
  const trigger = (
    <Button
      variant={favorited ? 'solid' : 'outline'}
      icon={<Heart fill={favorited ? 'currentColor' : 'none'} />}
      disabled={!signedIn}
      title={signedIn ? undefined : t('signInRequired')}
    >
      {favorited ? t('favorited') : t('favorite')}
    </Button>
  )
  if (!signedIn) {
    return trigger
  }
  return (
    <Popover
      onOpenChange={open => open && load()}
      content={
        <Stack gap="sm" className="min-w-56">
          <Text size="sm" weight="medium">
            {t('chooseLists')}
          </Text>
          {loading && <Spinner size="sm" />}
          {lists?.map(list => (
            <MembershipOption key={list.id} list={list} gameId={gameId} />
          ))}
          {lists?.length === 0 && (
            <Text size="sm" tone="muted">
              {t('noLists')}
            </Text>
          )}
        </Stack>
      }
    >
      {trigger}
    </Popover>
  )
}

function MembershipOption({
  list,
  gameId,
}: {
  list: Schema<'FavoriteSummaryDTO'>
  gameId: number
}) {
  const { included, toggle, pending, failure } = useMembershipToggle(list, gameId)
  return (
    <Stack gap="xs">
      <Checkbox
        checked={included}
        disabled={pending}
        onCheckedChange={next => toggle(next === true)}
      >
        {list.name}
      </Checkbox>
      {failure && (
        <Text size="xs" tone="danger">
          {failure.message}
        </Text>
      )}
    </Stack>
  )
}
