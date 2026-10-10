import type { ReactNode } from 'react'
import { alignOf, columnWidths, type RichNode } from '~/shared/richtext/rich-text'

type RichTableProps = {
  node: RichNode
  renderCell: (nodes: readonly RichNode[]) => ReactNode
}

function spanOf(span: number | undefined): number | undefined {
  return span !== undefined && span > 1 ? span : undefined
}

export function RichTable({ node, renderCell }: RichTableProps) {
  const rows = node.content ?? []
  const widths = columnWidths(node)
  const total = widths.reduce((sum, width) => sum + width, 0)
  return (
    <div className="overflow-x-auto">
      <table style={total > 0 ? { minWidth: total } : undefined}>
        {total > 0 && (
          <colgroup>
            {widths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {(row.content ?? []).map((cell, place) => {
                const Cell = cell.type === 'table_header' ? 'th' : 'td'
                return (
                  <Cell
                    key={place}
                    colSpan={spanOf(cell.attrs?.colspan)}
                    rowSpan={spanOf(cell.attrs?.rowspan)}
                    style={{ textAlign: alignOf(cell) }}
                  >
                    {renderCell(cell.content ?? [])}
                  </Cell>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
