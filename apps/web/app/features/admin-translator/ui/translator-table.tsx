import { Text } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { RecordTable, TwoLines, type Paging, type RecordColumn } from '~/features/admin'
import type { Translator } from '../admin-translator'
import { TranslatorMenu } from './translator-menu'

type TranslatorTableProps = {
  translators: Translator[]
  paging: Paging
  filtered: boolean
  onEdit: (translator: Translator) => void
}

const missing = '—'

export function TranslatorTable({ translators, paging, filtered, onEdit }: TranslatorTableProps) {
  const t = useTranslations('adminTranslator')
  const shared = useTranslations('admin')
  const format = useFormatter()
  const columns: RecordColumn[] = [
    { key: 'translator', label: t('column.translator'), fill: true },
    { key: 'works', label: t('column.works'), align: 'end', wide: true, className: 'min-w-20' },
    {
      key: 'resources',
      label: t('column.resources'),
      align: 'end',
      wide: true,
      className: 'min-w-20',
    },
    {
      key: 'latest',
      label: t('column.latest'),
      wide: true,
      className: 'min-w-40 whitespace-nowrap',
    },
    { key: 'menu', label: '' },
  ]
  return (
    <RecordTable
      label={t('title')}
      rows={translators}
      rowKey={translator => translator.id}
      columns={columns}
      paging={paging}
      empty={t('empty', { filtered: String(filtered) })}
      footer={
        <Text as="span" size="sm" tone="muted">
          {shared('total', { count: paging.total })}
        </Text>
      }
      renderCell={(translator, column) => {
        switch (column) {
          case 'translator':
            return (
              <TwoLines
                first={translator.name}
                second={format.list(translator.aliases ?? [])}
                narrow={t('narrow', {
                  works: translator.works_count,
                  resources: translator.resources_count,
                })}
              />
            )
          case 'works':
            return format.number(translator.works_count)
          case 'resources':
            return format.number(translator.resources_count)
          case 'latest':
            return (
              <Text as="span" size="sm" tone="muted">
                {translator.latest_credit === null
                  ? missing
                  : format.dateTime(new Date(translator.latest_credit), { dateStyle: 'long' })}
              </Text>
            )
          default:
            return <TranslatorMenu translator={translator} onEdit={onEdit} />
        }
      }}
    />
  )
}
