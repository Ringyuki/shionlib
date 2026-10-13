import { Tag, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { bannedStatus, superAdmin } from '../admin-user'
import { roleFrom } from '../admin-user.schema'

export function RoleLabel({ role }: { role: number }) {
  const t = useTranslations('adminUser.role')
  const known = roleFrom(role)
  if (known === undefined || known === 1) {
    return (
      <Text as="span" size="sm" tone="muted">
        {t('1')}
      </Text>
    )
  }
  return <Tag tone={known === superAdmin ? 'accent' : 'info'}>{t(`${known}`)}</Tag>
}

export function StatusTag({ status }: { status: number }) {
  const t = useTranslations('adminUser.status')
  return status === bannedStatus ? (
    <Tag tone="danger">{t('2')}</Tag>
  ) : (
    <Tag tone="success">{t('1')}</Tag>
  )
}
