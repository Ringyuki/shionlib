import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  Inline,
  Spinner,
  toast,
} from '@hina-ui/react'
import { Heart, Lock } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { Button } from '~/shared/ui/button'
import { useFavoriteLists } from '../use-favorite-lists'
import { useMembershipToggle } from '../use-membership-toggle'

type FavoriteButtonProps = {
  gameId: number
  favorited: boolean
}

export function FavoriteButton({ gameId, favorited }: FavoriteButtonProps) {
  const t = useTranslations('favorite')
  const { lists, load } = useFavoriteLists(gameId)
  return (
    <DropdownMenu
      label={t('chooseLists')}
      align="end"
      onOpenChange={open => {
        if (open) {
          load()
        }
      }}
      content={
        <>
          <DropdownMenuLabel>{t('chooseLists')}</DropdownMenuLabel>
          {lists === undefined && (
            <DropdownMenuItem disabled icon={<Spinner size="sm" />}>
              {t('loading')}
            </DropdownMenuItem>
          )}
          {lists?.length === 0 && <DropdownMenuItem disabled>{t('noLists')}</DropdownMenuItem>}
          {lists?.map(list => (
            <MembershipItem key={list.id} list={list} gameId={gameId} />
          ))}
        </>
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
    </DropdownMenu>
  )
}

function MembershipItem({ list, gameId }: { list: Schema<'FavoriteSummaryDTO'>; gameId: number }) {
  const t = useTranslations('favorite')
  const { included, toggle, pending } = useMembershipToggle(list, gameId, failure =>
    toast.danger(failure.message),
  )
  return (
    <DropdownMenuCheckboxItem
      checked={included}
      disabled={pending}
      onCheckedChange={toggle}
      onSelect={event => event.preventDefault()}
    >
      <Inline gap="xs" align="center" wrap={false} as="span">
        {list.default ? t('defaultList') : list.name}
        {list.is_private && <Lock aria-label={t('private')} className="size-3.5 text-faint" />}
      </Inline>
    </DropdownMenuCheckboxItem>
  )
}
