import { Card, Inline, Text, Textarea } from '@hina-ui/react'
import { Play } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'

type MessageBoxProps = {
  value: string
  disabled: boolean
  busy: boolean
  started: boolean
  onChange: (value: string) => void
  onSend: () => void
  onRestart: () => void
}

export function MessageBox(props: MessageBoxProps) {
  const { value, disabled, busy, started, onChange, onSend, onRestart } = props
  const t = useTranslations('adminAiPlayground.message')
  return (
    <Card className="p-3">
      <Textarea
        variant="bare"
        rows={3}
        className="resize-none"
        aria-label={t('label')}
        placeholder={t('placeholder')}
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            onSend()
          }
        }}
      />
      <Inline gap="sm" align="center" className="mt-1">
        <Text as="span" size="sm" tone="muted">
          {t('shortcut')}
        </Text>
        <Inline gap="sm" align="center" className="ms-auto">
          <Button variant="outline" tone="neutral" disabled={busy || !started} onClick={onRestart}>
            {t('restart')}
          </Button>
          <Button
            type="submit"
            icon={<Play />}
            loading={busy}
            disabled={disabled || value.trim() === ''}
          >
            {t('send')}
          </Button>
        </Inline>
      </Inline>
    </Card>
  )
}
