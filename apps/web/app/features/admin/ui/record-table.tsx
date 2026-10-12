import { cn, DataTable, Empty, Flex, Pagination, type DataTableColumn } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { usePageTurn } from '~/shared/route/use-page-turn'
import type { Paging } from '../admin'

export type RecordColumn = {
  key: string
  label: string
  wide?: boolean
  fill?: boolean
  className?: string
  align?: 'start' | 'end'
}

type RecordTableProps<Row extends object> = {
  label: string
  rows: Row[]
  rowKey: (row: Row) => string | number
  columns: RecordColumn[]
  renderCell: (row: Row, column: string) => ReactNode
  onOpen?: (row: Row) => void
  paging?: Paging
  empty: string
  emptyIcon?: ReactNode
  footer?: ReactNode
  selected?: (string | number)[]
  onSelectedChange?: (selected: (string | number)[]) => void
}

function classesOf(columns: RecordColumn[]) {
  const lastNarrow = columns.findLast(column => column.wide !== true)
  return columns.map((column, index) => {
    const first = index === 0
    const last = index === columns.length - 1
    const hidden = column.wide === true && 'max-md:hidden'
    return {
      header: cn(
        hidden,
        column.className,
        'whitespace-nowrap',
        first && 'ps-[calc(var(--hn-panel-p)-0.75em)]',
        last && 'pe-[calc(var(--hn-panel-p)-0.75em)]',
      ),
      cell: cn(
        hidden,
        column.className,
        'py-3',
        column.fill === true && 'w-full',
        column.fill !== true && column.className === undefined && 'whitespace-nowrap',
        first && 'ps-(--hn-panel-p)',
        last && 'pe-(--hn-panel-p)',
        column === lastNarrow && 'max-md:pe-(--hn-panel-p)',
      ),
    }
  })
}

export function RecordTable<Row extends object>({
  label,
  rows,
  rowKey,
  columns,
  renderCell,
  onOpen,
  paging,
  empty,
  emptyIcon,
  footer,
  selected,
  onSelectedChange,
}: RecordTableProps<Row>) {
  const pages = usePageTurn()
  const classes = classesOf(columns)
  const shaped: DataTableColumn<Row>[] = columns.map((column, index) => ({
    key: column.key,
    label: column.label,
    align: column.align,
    headerClass: classes[index]?.header,
    cellClass: classes[index]?.cell,
  }))
  const paged = paging !== undefined && paging.total > paging.pageSize
  return (
    <>
      {rows.length === 0 ? (
        <Empty size="sm" title={empty} icon={emptyIcon} />
      ) : (
        <DataTable
          rows={rows}
          columns={shaped}
          rowKey={rowKey}
          label={label}
          variant="secondary"
          tableClass="max-md:[&_thead]:hidden"
          selectable={onSelectedChange !== undefined}
          selected={selected}
          onSelectedChange={onSelectedChange}
          rowClickable={onOpen !== undefined}
          onRowClick={onOpen}
          renderCell={({ row, column }) => renderCell(row, column.key)}
        />
      )}
      {(footer !== undefined || paged) && (
        <Flex
          align="center"
          justify="between"
          gap="md"
          wrap
          className="border-line border-t px-(--hn-panel-p) py-3"
        >
          {footer}
          {paging !== undefined && (
            <Pagination
              total={paging.total}
              pageSize={paging.pageSize}
              value={paging.page}
              onValueChange={pages.turnTo}
              pending={pages.turning}
              hideSinglePage
              className="ms-auto"
            />
          )}
        </Flex>
      )}
    </>
  )
}
