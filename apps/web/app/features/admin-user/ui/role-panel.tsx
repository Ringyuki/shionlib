import { AlertDialog, FormField, Panel, Select, Stack, Text, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useLast } from '~/shared/ui/use-last'
import { roles, type Role, type UserDetail } from '../admin-user'
import { roleFrom } from '../admin-user.schema'
import { useUserChange } from '../use-user-change'

type RolePanelProps = {
  detail: UserDetail
  changeable: boolean
}

export function RolePanel({ detail, changeable }: RolePanelProps) {
  const t = useTranslations('adminUser')
  const shared = useTranslations('admin')
  const [wanted, setWanted] = useState<Role>()
  const shown = useLast(wanted)
  const change = useUserChange()
  return (
    <Panel title={t('roles.title')}>
      <Stack gap="sm">
        <FormField label={t('roles.title')} orientation="horizontal">
          <Select
            aria-label={t('roles.title')}
            className="w-40"
            disabled={!changeable}
            value={roleFrom(detail.role) ?? 1}
            options={roles.map(role => ({ value: role, label: t(`role.${role}`) }))}
            onValueChange={value => {
              const role = roles.find(known => known === value)
              if (role !== undefined && role !== detail.role) {
                setWanted(role)
              }
            }}
          />
        </FormField>
        <Text as="span" size="sm" tone="muted">
          {t('roles.hint')}
        </Text>
      </Stack>
      <AlertDialog
        title={t('roles.confirm', { name: detail.name, role: t(`role.${shown ?? 1}`) })}
        description={t('roles.confirmHint', { role: String(shown ?? 1) })}
        confirmText={t('roles.change')}
        cancelText={shared('cancel')}
        open={wanted !== undefined}
        onOpenChange={open => {
          if (!open) {
            setWanted(undefined)
          }
        }}
        onConfirm={async () => {
          if (wanted === undefined) {
            return
          }
          await change.confirm({ action: 'role', id: detail.id, role: wanted })
          toast.success(t('roles.changed'))
        }}
      />
    </Panel>
  )
}
