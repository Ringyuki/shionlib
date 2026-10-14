import { Alert, Link, Panel, Tooltip } from '@hina-ui/react'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { docPath } from '~/features/docs'
import { Button } from '~/shared/ui/button'
import { canCreate, openApiDoc, type Keys } from '../api-key'
import { CreateDialog } from './create-dialog'
import { KeyList } from './key-list'

export function ApiKeysSection({ keys }: { keys: Keys }) {
  const t = useTranslations('apiKey')
  const locale = useLocale()
  const [creating, setCreating] = useState(false)
  const allowed = canCreate(keys)
  const listed = keys.keys ?? []
  const create = (
    <Button
      size="sm"
      variant="outline"
      tone="neutral"
      icon={<Plus />}
      disabled={!allowed}
      onClick={() => setCreating(true)}
    >
      {t('create')}
    </Button>
  )
  return (
    <Panel
      title={t('title')}
      description={t.rich('hint', {
        docs: chunks => (
          <Link asChild>
            <RouterLink to={docPath(locale, openApiDoc)}>{chunks}</RouterLink>
          </Link>
        ),
      })}
      actions={
        keys.enabled && listed.length >= keys.limit ? (
          <Tooltip content={t('limitReached', { limit: keys.limit })}>{create}</Tooltip>
        ) : (
          create
        )
      }
    >
      <Alert tone="warning" open={!keys.enabled}>
        {t('paused')}
      </Alert>
      <KeyList keys={listed} />
      <CreateDialog open={creating} onOpenChange={setCreating} />
    </Panel>
  )
}
