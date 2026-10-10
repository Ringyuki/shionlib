import { DataList } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { listStart } from '~/shared/http/paging'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { worksPageSize, type GameSummary, type Works } from '../game'
import { searchInOrder, workOrders } from '../game-order'
import { GameTile } from './game-tile'
import { OrderSelect } from './order-select'

type GameGridProps = {
  label: string
  works: Works
  empty: ReactNode
  sortable?: boolean
  renderNote?: (game: GameSummary) => ReactNode
}

export function GameGrid({ label, works, empty, sortable, renderNote }: GameGridProps) {
  const pages = usePageTurn()
  const stay = useInPageNavigate()
  const location = useLocation()
  return (
    <DataList
      label={label}
      id={listStart}
      className="scroll-mt-4"
      items={works.games}
      itemKey="id"
      layout="grid"
      gridMin="9rem"
      gridGap="md"
      manual
      pagination
      total={works.total}
      page={works.page}
      pageSize={worksPageSize}
      onPageChange={pages.turnTo}
      loading={pages.turning}
      renderHeader={
        sortable === true && works.total > 1
          ? () => (
              <OrderSelect
                order={works.order}
                options={workOrders}
                onChange={chosen => stay({ search: searchInOrder(location.search, chosen) })}
                className="w-44"
              />
            )
          : undefined
      }
      renderEmpty={() => empty}
    >
      {({ item }) => <GameTile game={item} dated="year" note={renderNote?.(item)} />}
    </DataList>
  )
}
