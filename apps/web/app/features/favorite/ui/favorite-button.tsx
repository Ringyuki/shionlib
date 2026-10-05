import {
  Button as HinaButton,
  Checkbox,
  Divider,
  Inline,
  Popover,
  Spinner,
  Stack,
  Text,
  toast,
} from '@hina-ui/react'
import { Heart, Lock, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { Button } from '~/shared/ui/button'
import { shownGameCount } from '../favorite'
import { useFavoriteLists } from '../use-favorite-lists'
import { useMembershipToggle } from '../use-membership-toggle'
import { NewListDialog } from './new-list-dialog'

type FavoriteButtonProps = {
  gameId: number
  favorited: boolean
}

export function FavoriteButton({ gameId, favorited }: FavoriteButtonProps) {
  const t = useTranslations('favorite')
  const { lists, load } = useFavoriteLists(gameId)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const changeOpen = (next: boolean) => {
    if (next) {
      load()
    }
    setOpen(next)
  }
  return (
    <>
      <Popover
        align="end"
        padded={false}
        open={open}
        onOpenChange={changeOpen}
        content={
          <Stack gap="none" className="w-64">
            <Text size="sm" weight="semibold" className="px-3 pt-3 pb-2">
              {t('chooseLists')}
            </Text>
            {lists === undefined && <Spinner size="sm" className="mx-auto my-3" />}
            {lists?.length === 0 && (
              <Text size="sm" tone="muted" className="px-3 pb-3">
                {t('noLists')}
              </Text>
            )}
            {lists !== undefined && lists.length > 0 && (
              <Stack gap="sm" className="max-h-72 overflow-y-auto px-3 pt-1 pb-3">
                {lists.map(list => (
                  <MembershipOption key={list.id} list={list} gameId={gameId} />
                ))}
              </Stack>
            )}
            <Divider />
            <HinaButton
              variant="ghost"
              tone="neutral"
              size="sm"
              block
              icon={<Plus />}
              onClick={() => {
                setOpen(false)
                setCreating(true)
              }}
              className="h-10 justify-start rounded-none px-3"
            >
              {t('newList')}
            </HinaButton>
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
      <NewListDialog gameId={gameId} open={creating} onOpenChange={setCreating} />
    </>
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
      description={t('gameCount', { count: shownGameCount(list, included) })}
    >
      <Inline gap="xs" align="center" wrap={false} as="span">
        {list.default ? t('defaultList') : list.name}
        {list.is_private && <Lock aria-label={t('private')} className="size-3.5 text-faint" />}
      </Inline>
    </Checkbox>
  )
}
