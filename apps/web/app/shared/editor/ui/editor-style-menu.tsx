import {
  DropdownMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  Inline,
  ToolbarButton,
} from '@hina-ui/react'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { ToolChoice } from '../plugin'
import { useEditorValue, type EditorHandle } from '../use-rich-editor'
import { ShortcutText } from './shortcut'

type EditorStyleMenuProps = {
  label: string
  choices: readonly ToolChoice[]
  handle: EditorHandle
  disabled: boolean
}

export function EditorStyleMenu({ label, choices, handle, disabled }: EditorStyleMenuProps) {
  const t = useTranslations('editor')
  const { editor, session } = handle
  const fallback = choices[0]?.id ?? 'paragraph'
  const chosen = useEditorValue(
    editor,
    current => choices.find(choice => choice.isActive(current))?.id ?? fallback,
    fallback,
  )
  return (
    <DropdownMenu
      label={label}
      align="start"
      content={
        <DropdownMenuRadioGroup
          value={chosen}
          onValueChange={value => {
            const picked = choices.find(choice => choice.id === value)
            if (editor !== null && picked !== undefined) {
              picked.run(editor, session)
            }
          }}
        >
          {choices.map(choice => (
            <DropdownMenuRadioItem key={choice.id} value={choice.id}>
              <Inline as="span" justify="between" align="center" gap="lg" wrap={false}>
                {t(`choice.${choice.id}`)}
                {choice.shortcut !== undefined && <ShortcutText shortcut={choice.shortcut} />}
              </Inline>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      }
    >
      <ToolbarButton
        disabled={disabled}
        trailing={<ChevronDown />}
        className="h-8 justify-between gap-1.5 ps-2.5 pe-2 text-sm"
      >
        {t(`choice.${chosen}`)}
      </ToolbarButton>
    </DropdownMenu>
  )
}
