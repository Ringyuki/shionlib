import { FormField, Inline, Popover, Stack, Switch, Text } from '@hina-ui/react'
import { CircleHelp } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import type { NameQuery } from '../resource-name'
import { useNamePreview } from '../use-name-preview'

type NameFieldProps = {
  query: NameQuery | undefined
  uploaded: string
  canonical: boolean
  onCanonicalChange: (canonical: boolean) => void
}

export function NameField({ query, uploaded, canonical, onCanonicalChange }: NameFieldProps) {
  const t = useTranslations('resource.name')
  const preview = useNamePreview(canonical ? query : undefined)
  const pending = canonical && preview?.pending === true
  return (
    <Stack gap="sm">
      <FormField name="fileName" label={t('label')}>
        {(canonical ? preview !== undefined : uploaded !== '') && (
          <Stack className="rounded-lg bg-inset px-4 py-3.5">
            <Text weight="medium" className="break-all">
              {canonical ? preview?.before : uploaded}
              {pending && (
                <Text as="span" tone="faint" weight="normal">
                  {t('pending')}
                </Text>
              )}
              {canonical && preview?.after}
            </Text>
          </Stack>
        )}
      </FormField>
      {pending && (
        <Text size="sm" tone="muted">
          {t('pendingHint')}
        </Text>
      )}
      <Inline gap="md" align="center" justify="between" wrap={false}>
        <Switch checked={canonical} onCheckedChange={onCanonicalChange}>
          {t('canonical')}
        </Switch>
        <Popover
          align="end"
          content={
            <Stack gap="sm" className="w-80 max-w-[calc(100vw-3rem)]">
              <Text size="sm" className="font-mono break-all">
                {t('format')}
              </Text>
              <Text size="sm" tone="muted">
                {t('rule')}
              </Text>
            </Stack>
          }
        >
          <IconButton variant="ghost" tone="neutral" size="sm" label={t('help')}>
            <CircleHelp />
          </IconButton>
        </Popover>
      </Inline>
    </Stack>
  )
}
