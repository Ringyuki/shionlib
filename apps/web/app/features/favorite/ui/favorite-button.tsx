import { Checkbox, Divider, Popover, Spinner, Stack, Text, toast } from '@hina-ui/react'
import { Heart } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { Button } from '~/shared/ui/button'
import { shownGameCount } from '../favorite'
import { useFavoriteLists } from '../use-favorite-lists'
import { useMembershipToggle } from '../use-membership-toggle'
import { NewListForm } from './new-list-form'

type FavoriteButtonProps = {
  gameId: number
  favorited: boolean
}

export function FavoriteButton({ gameId, favorited }: FavoriteButtonProps) {
  const t = useTranslations('favorite')
  const { lists, load } = useFavoriteLists(gameId)
  return (
    <Popover
      align="end"
      onOpenChange={open => {
        if (open) {
          load()
        }
      }}
      content={
        <Stack gap="sm" className="w-72">
          <Text size="sm" weight="semibold">
            {t('chooseLists')}
          </Text>
          {lists === undefined && <Spinner size="sm" className="mx-auto my-3" />}
          {lists?.length === 0 && (
            <Text size="sm" tone="muted">
              {t('noLists')}
            </Text>
          )}
          {lists !== undefined && lists.length > 0 && (
            <Stack gap="sm" className="max-h-72 overflow-y-auto py-1">
              {lists.map(list => (
                <MembershipOption key={list.id} list={list} gameId={gameId} />
              ))}
            </Stack>
          )}
          <Divider />
          <NewListForm gameId={gameId} />
        </Stack>
      }
    >
      <Button
        loginRequired
        variant={favorited ? 'soft' : 'outline'}
        tone={favorited ? 'accent' : 'neutral'}
        icon={<Heart fill={favorited ? 'currentColor' : 'none'} />}
      >
        {favorited ? t('favorited') : t('favorite')}
      </Button>
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
  const t = useTranslations('favorite')
  const { included, toggle, pending } = useMembershipToggle(list, gameId, failure =>
    toast.danger(failure.message),
  )
  return (
    <Checkbox
      block
      checked={included}
      disabled={pending}
      onCheckedChange={next => toggle(next === true)}
      description={t('listMeta', {
        count: shownGameCount(list, included),
        visibility: list.is_private ? t('private') : t('public'),
      })}
    >
      {list.default ? t('defaultList') : list.name}
    </Checkbox>
  )
}
