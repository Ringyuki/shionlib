import {
  Card,
  Stack,
  Text,
  Textarea,
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarToggleGroup,
  ToolbarToggleItem,
} from '@hina-ui/react'
import {
  Bold,
  Eye,
  EyeOff,
  Italic,
  Link,
  Quote,
  Strikethrough,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { BBCodeTool } from '~/shared/markup/bbcode-edit'
import { BBCodeText } from './bbcode-text'
import { useBBCodeEditor } from './use-bbcode-editor'

type Tool = { tool: BBCodeTool; icon: LucideIcon }

const fieldPadding =
  'px-[var(--hn-control-px-md)] py-[calc((var(--hn-control-h-md)_-_1lh)/2_-_1px)]'

const inlineTools: readonly Tool[] = [
  { tool: 'bold', icon: Bold },
  { tool: 'italic', icon: Italic },
  { tool: 'strike', icon: Strikethrough },
]

const blockTools: readonly Tool[] = [
  { tool: 'link', icon: Link },
  { tool: 'quote', icon: Quote },
  { tool: 'spoiler', icon: EyeOff },
]

type BBCodeEditorProps = {
  value: string
  onValueChange: (value: string) => void
}

export function BBCodeEditor({ value, onValueChange }: BBCodeEditorProps) {
  const t = useTranslations('bbcode')
  const { textarea, field, previewing, height, apply, preview } = useBBCodeEditor(
    value,
    onValueChange,
  )
  return (
    <Stack gap="xs">
      <Toolbar label={t('toolbar')} variant="bare" size="sm" className="w-full">
        <ToolButtons tools={inlineTools} disabled={previewing} onApply={apply} />
        <ToolbarSeparator />
        <ToolButtons tools={blockTools} disabled={previewing} onApply={apply} />
        <ToolbarToggleGroup
          type="single"
          value={previewing ? 'preview' : undefined}
          onValueChange={next => preview(next === 'preview')}
          className="ms-auto"
        >
          <ToolbarToggleItem value="preview" icon={<Eye />}>
            <Text as="span" size="inherit" className="text-inherit max-sm:sr-only">
              {t('preview')}
            </Text>
          </ToolbarToggleItem>
        </ToolbarToggleGroup>
      </Toolbar>
      <Stack ref={field} className={previewing ? 'hidden' : undefined}>
        <Textarea
          ref={textarea}
          value={value}
          onValueChange={onValueChange}
          autosize={{ minRows: 3, maxRows: 10 }}
        />
      </Stack>
      {previewing && (
        <Card padded={false} className="rounded-md" style={{ minHeight: height }}>
          {value.trim() === '' ? (
            <Text tone="muted" className={fieldPadding}>
              {t('empty')}
            </Text>
          ) : (
            <BBCodeText source={value} className={fieldPadding} />
          )}
        </Card>
      )}
    </Stack>
  )
}

type ToolButtonsProps = {
  tools: readonly Tool[]
  disabled: boolean
  onApply: (tool: BBCodeTool) => void
}

function ToolButtons({ tools, disabled, onApply }: ToolButtonsProps) {
  const t = useTranslations('bbcode')
  return tools.map(({ tool, icon: Icon }) => (
    <ToolbarButton key={tool} label={t(tool)} disabled={disabled} onClick={() => onApply(tool)}>
      <Icon />
    </ToolbarButton>
  ))
}
