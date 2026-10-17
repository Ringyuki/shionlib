import { Inline, Tag, Text, Time } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type Paging, type RecordColumn } from '~/features/admin'
import { GamePicture } from '~/features/game'
import { coverOf, shown, titlesOf, type Game } from '../admin-game'
import { GameMenu } from './game-menu'

type GameTableProps = {
  games: Game[]
  paging: Paging
  filtered: boolean
  onRemove: (game: Game) => void
  onPatchPages: (game: Game) => void
}

const missing = '—'

export function GameTable({ games, paging, filtered, onRemove, onPatchPages }: GameTableProps) {
  const t = useTranslations('adminGame')
  const shared = useTranslations('admin')
  const format = useFormatter()
  const columns: RecordColumn[] = [
    { key: 'game', label: t('column.game'), fill: true },
    { key: 'rating', label: t('column.rating'), wide: true, className: 'min-w-20' },
    { key: 'views', label: t('column.views'), align: 'end', wide: true, className: 'min-w-24' },
    {
      key: 'downloads',
      label: t('column.downloads'),
      align: 'end',
      wide: true,
      className: 'min-w-20',
    },
    {
      key: 'resources',
      label: t('column.resources'),
      align: 'end',
      wide: true,
      className: 'min-w-18',
    },
    {
      key: 'updated',
      label: t('column.updated'),
      wide: true,
      className: 'min-w-30 whitespace-nowrap',
    },
    { key: 'status', label: t('column.status'), className: 'min-w-20' },
    { key: 'menu', label: '' },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={games}
      rowKey={game => game.id}
      columns={columns}
      paging={paging}
      empty={t('empty', { filtered: String(filtered) })}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      renderCell={(game, column) => {
        switch (column) {
          case 'game': {
            const titles = titlesOf(game)
            return (
              <Inline gap="md" align="center" wrap={false} className="min-w-0">
                <GamePicture
                  picture={coverOf(game)}
                  ratio={3 / 4}
                  fit="cover"
                  className="w-8 shrink-0 rounded"
                />
                <TwoLines
                  first={titles.main}
                  second={titles.other}
                  narrow={t('narrow', { id: game.id, views: game.views })}
                />
              </Inline>
            )
          }
          case 'rating':
            return game.nsfw ? <Tag tone="danger">{t('adult')}</Tag> : missing
          case 'views':
            return format.number(game.views)
          case 'downloads':
            return format.number(game.downloads)
          case 'resources':
            return format.number(game.resources)
          case 'updated':
            return <Time value={game.updated} format="relative" className="text-muted text-sm" />
          case 'status':
            return (
              <Tag tone={shown(game) ? 'success' : 'neutral'}>
                {t(shown(game) ? 'status.1' : 'status.2')}
              </Tag>
            )
          default:
            return <GameMenu game={game} onRemove={onRemove} onPatchPages={onPatchPages} />
        }
      }}
    />
  )
}
