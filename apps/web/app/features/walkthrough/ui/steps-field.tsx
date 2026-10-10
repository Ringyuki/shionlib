import { FormField, Inline, Text, Textarea, type TextareaHandle } from '@hina-ui/react'
import { FolderOpen, MessageSquare, Save } from 'lucide-react'
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { nextSlot, withLine, type StepWords } from '../walkthrough-steps'

type StepsFieldProps = {
  value: string
  words: StepWords
  saves: readonly string[]
  className?: string
  onValueChange: (value: string) => void
}

export function StepsField({ value, words, saves, className, onValueChange }: StepsFieldProps) {
  const t = useTranslations('walkthrough')
  const label = useId()
  const field = useRef<TextareaHandle>(null)
  const caret = useRef<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (caret.current !== undefined) {
      field.current?.input?.setSelectionRange(caret.current, caret.current)
      caret.current = undefined
    }
  }, [value])
  const insert = (line: string) => {
    const input = field.current?.input
    const typed = withLine({ text: value, caret: input?.selectionStart ?? value.length }, line)
    caret.current = typed.caret
    field.current?.focus()
    onValueChange(typed.text)
  }
  return (
    <FormField name="steps" description={t('stepsHint')} className={className}>
      <Inline gap="xs" align="center" wrap={false} className="mb-1.5 min-h-8">
        <Text as="span" id={label} size="sm" weight="medium" className="me-auto">
          {t('steps')}
        </Text>
        <Insert icon={<Save />} onClick={() => insert(`${words.save} ${nextSlot(saves)}`)}>
          {t('insert.save')}
        </Insert>
        <Insert icon={<FolderOpen />} onClick={() => insert(`${words.load} `)}>
          {t('insert.load')}
        </Insert>
        <Insert icon={<MessageSquare />} onClick={() => insert('# ')}>
          {t('insert.note')}
        </Insert>
      </Inline>
      <Textarea
        ref={field}
        aria-labelledby={label}
        value={value}
        rows={10}
        spellCheck={false}
        onValueChange={onValueChange}
      />
    </FormField>
  )
}

function Insert({
  icon,
  onClick,
  children,
}: {
  icon: ReactNode
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button size="sm" variant="ghost" tone="neutral" icon={icon} onClick={onClick}>
      {children}
    </Button>
  )
}
