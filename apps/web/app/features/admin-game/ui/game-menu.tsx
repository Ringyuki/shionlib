import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, toast } from '@hina-ui/react'
import { Ellipsis, ExternalLink, Eye, EyeOff, Pin, PinOff, RefreshCw, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { useSourceName } from '~/features/admin'
import { gamePath } from '~/features/game'
import { IconButton } from '~/shared/ui/button'
import { hidden, shown, titlesOf, visible, type Game } from '../admin-game'
import { useGameChange } from '../use-game-change'

type GameMenuProps = {
  game: Game
  onRemove: (game: Game) => void
}

export function GameMenu({ game, onRemove }: GameMenuProps) {
  const t = useTranslations('adminGame')
  const sourceName = useSourceName()
  const navigate = useNavigate()
  const change = useGameChange()
  const name = titlesOf(game).main
  const { source } = game
  const done = async (settled: ReturnType<typeof change.run>, message: string) => {
    if ((await settled).ok) {
      toast.success(message)
    }
  }
  const label = t('menu.label', { name })
  return (
    <DropdownMenu
      label={label}
      align="end"
      content={
        <>
          <DropdownMenuItem
            icon={<ExternalLink />}
            onSelect={() => void navigate(gamePath('zh', game.id))}
          >
            {t('menu.view')}
          </DropdownMenuItem>
          {source !== null && (
            <DropdownMenuItem
              icon={<RefreshCw />}
              onSelect={() =>
                void done(
                  change.run({
                    action: 'refresh',
                    id: game.id,
                    source: source.name,
                    externalId: source.external_id,
                  }),
                  t('refreshed', { name }),
                )
              }
            >
              {t('menu.refresh', {
                source: sourceName(source.name),
              })}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            icon={game.recently_updated ? <PinOff /> : <Pin />}
            onSelect={() =>
              void done(
                change.run({ action: 'recent', id: game.id, marked: !game.recently_updated }),
                t(game.recently_updated ? 'unmarked' : 'marked', { name }),
              )
            }
          >
            {t(game.recently_updated ? 'menu.unmark' : 'menu.mark')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            icon={shown(game) ? <EyeOff /> : <Eye />}
            onSelect={() =>
              void done(
                change.run({
                  action: 'status',
                  id: game.id,
                  status: shown(game) ? hidden : visible,
                }),
                t(shown(game) ? 'hiddenNow' : 'shownNow', { name }),
              )
            }
          >
            {t(shown(game) ? 'menu.hide' : 'menu.show')}
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Trash2 />} tone="danger" onSelect={() => onRemove(game)}>
            {t('menu.remove')}
          </DropdownMenuItem>
        </>
      }
    >
      <IconButton
        variant="ghost"
        tone="neutral"
        size="sm"
        label={label}
        tooltip={false}
        loading={change.pending}
      >
        <Ellipsis />
      </IconButton>
    </DropdownMenu>
  )
}
