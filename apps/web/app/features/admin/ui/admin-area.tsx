import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import type { ShellArea } from '~/features/shell'
import { AdminMessages } from './admin-messages'
import { AdminNavigation } from './admin-navigation'

function AdminTitle() {
  return useTranslations('admin')('title')
}

export const adminArea: ShellArea<ReactNode> = {
  title: (
    <AdminMessages>
      <AdminTitle />
    </AdminMessages>
  ),
  navigation: rail => (
    <AdminMessages>
      <AdminNavigation rail={rail} />
    </AdminMessages>
  ),
}
