import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useStore, type CellAlign, type TableMenu } from '../session'
import type { EditorHandle } from '../use-rich-editor'

const alignments = ['left', 'center', 'right'] as const satisfies readonly CellAlign[]

function useLastMenu(menu: TableMenu | null): TableMenu | null {
  const [kept, setKept] = useState(menu)
  if (menu !== null && menu !== kept) {
    setKept(menu)
  }
  return menu ?? kept
}

export function EditorTableMenu({ handle }: { handle: EditorHandle }) {
  const t = useTranslations('editor')
  const { editor, session } = handle
  const open = useStore(session.tableMenu)
  const menu = useLastMenu(open)
  const column = menu?.axis === 'column'
  const run = (act: (commands: NonNullable<typeof editor>['commands']) => void) => () => {
    if (editor !== null) {
      act(editor.commands)
      editor.view.focus()
    }
  }
  return (
    <DropdownMenu
      label={t(column ? 'table.columnMenu' : 'table.rowMenu')}
      open={open !== null}
      onOpenChange={next => {
        if (!next) {
          session.tableMenu.set(null)
        }
      }}
      anchor={menu?.anchor ?? null}
      side={column ? 'bottom' : 'right'}
      align="start"
      content={
        <>
          <DropdownMenuItem
            onSelect={run(commands =>
              column ? commands.addColumnBefore() : commands.addRowBefore(),
            )}
          >
            {t(column ? 'table.columnLeft' : 'table.rowAbove')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={run(commands =>
              column ? commands.addColumnAfter() : commands.addRowAfter(),
            )}
          >
            {t(column ? 'table.columnRight' : 'table.rowBelow')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {column ? (
            <>
              <DropdownMenuLabel>{t('table.align')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={menu?.align ?? 'left'}
                onValueChange={value => {
                  const align = alignments.find(candidate => candidate === value)
                  run(commands =>
                    commands.setCellAttribute('align', align === 'left' ? null : (align ?? null)),
                  )()
                }}
              >
                {alignments.map(align => (
                  <DropdownMenuRadioItem key={align} value={align}>
                    {t(`table.aligned.${align}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          ) : (
            menu?.index === 0 && (
              <>
                <DropdownMenuCheckboxItem
                  checked={menu.header}
                  onSelect={run(commands => commands.toggleHeaderRow())}
                >
                  {t('table.headerRow')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
              </>
            )
          )}
          <DropdownMenuItem
            tone="danger"
            onSelect={run(commands => (column ? commands.deleteColumn() : commands.deleteRow()))}
          >
            {t(column ? 'table.deleteColumn' : 'table.deleteRow')}
          </DropdownMenuItem>
        </>
      }
    />
  )
}
