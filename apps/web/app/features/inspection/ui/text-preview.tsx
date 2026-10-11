import { CodeBlock, Dialog, Inline, Select, Spinner, Stack, Text } from '@hina-ui/react'
import { useId, useState } from 'react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import {
  decodeText,
  encodingNames,
  lineCount,
  textEncodings,
  type Opened,
  type TextEncoding,
  type TextPreview as Preview,
} from '../inspection-preview'

type TextPreviewProps = {
  open: boolean
  onClose: () => void
  opened: Opened | undefined
  preview: Preview | undefined
  loading: boolean
}

export function TextPreview({ open, onClose, opened, preview, loading }: TextPreviewProps) {
  const t = useTranslations('inspection.preview')
  return (
    <Dialog
      title={opened?.entry.name ?? t('title')}
      size="2xl"
      open={open}
      onOpenChange={next => {
        if (!next) {
          onClose()
        }
      }}
      renderContent={() =>
        preview === undefined ? (
          <Inline justify="center" className="py-10">
            {loading && <Spinner label={t('loading')} />}
          </Inline>
        ) : (
          <TextBody path={opened?.path ?? preview.name} preview={preview} />
        )
      }
    />
  )
}

function TextBody({ path, preview }: { path: string; preview: Preview }) {
  const t = useTranslations('inspection.preview')
  const bytes = useBytes('short')
  const label = useId()
  const [chosen, setChosen] = useState<TextEncoding>()
  const encoding = chosen ?? preview.encoding
  const text = decodeText(preview.content, encoding)
  return (
    <Stack gap="md">
      <Inline gap="md" align="center" className="gap-y-2">
        <Text size="sm" tone="muted" className="min-w-0 flex-1 basis-64 break-all tabular-nums">
          {t('facts', { path, size: bytes(preview.size), lines: lineCount(text) })}
        </Text>
        <Inline gap="sm" align="center" wrap={false} className="shrink-0">
          <Text as="span" id={label} size="sm" tone="muted">
            {t('encoding')}
          </Text>
          <Select
            size="sm"
            aria-labelledby={label}
            value={encoding}
            onValueChange={value => setChosen(textEncodings.find(known => known === value))}
            options={textEncodings.map(known => ({ value: known, label: encodingNames[known] }))}
            className="w-36"
          />
        </Inline>
      </Inline>
      <CodeBlock code={text} />
    </Stack>
  )
}
