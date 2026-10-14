import { Panel, Select, Text, Time } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { RecordTable, UserRef, type Paging, type RecordColumn } from '~/features/admin'
import { outcomes, type Outcome, type ScanCase } from '../admin-check'
import { Detections, FileCell, fileWidth, OutcomeTag, userWidth } from './check-cells'

type RecordsPanelProps = {
  records: ScanCase[]
  paging: Paging
  outcome: Outcome | undefined
  onOutcomeChange: (outcome: Outcome | undefined) => void
  onOpen: (scanCase: ScanCase) => void
}

const everyOutcome = 'ALL'

export function RecordsPanel(props: RecordsPanelProps) {
  const { records, paging, outcome, onOutcomeChange, onOpen } = props
  const t = useTranslations('adminCheck')
  const columns: RecordColumn[] = [
    { key: 'file', label: t('column.file'), fill: true, minWidth: fileWidth },
    { key: 'found', label: t('column.found'), wide: true },
    { key: 'uploader', label: t('column.uploader'), wide: true, minWidth: userWidth },
    { key: 'outcome', label: t('column.outcome') },
    { key: 'reviewer', label: t('column.reviewer'), wide: true },
    { key: 'time', label: t('column.time'), wide: true },
  ]
  return (
    <Panel
      title={t('records.title')}
      padded={false}
      actions={
        <Select
          size="sm"
          aria-label={t('records.filter')}
          className="w-40"
          value={outcome ?? everyOutcome}
          options={[
            { value: everyOutcome, label: t('records.every') },
            ...outcomes.map(value => ({ value, label: t(`outcome.${value}`) })),
          ]}
          onValueChange={value => onOutcomeChange(outcomes.find(known => known === value))}
        />
      }
    >
      <RecordTable
        label={t('records.title')}
        rows={records}
        rowKey={scanCase => scanCase.id}
        columns={columns}
        paging={paging}
        empty={t('records.empty', { filtered: String(outcome !== undefined) })}
        onOpen={onOpen}
        renderCell={(scanCase, column) => {
          switch (column) {
            case 'file':
              return (
                <FileCell
                  name={scanCase.file_name}
                  size={scanCase.file_size}
                  game={scanCase.resource?.game}
                  narrow={(scanCase.detected_viruses ?? []).join(t('separator'))}
                />
              )
            case 'found':
              return <Detections names={scanCase.detected_viruses ?? []} wrap={false} />
            case 'uploader':
              return <UserRef user={scanCase.uploader} />
            case 'outcome':
              return <OutcomeTag scanCase={scanCase} />
            case 'reviewer':
              return (
                <Text as="span" size="sm">
                  {scanCase.reviewer?.name ?? t('system')}
                </Text>
              )
            default:
              return (
                <Time
                  value={scanCase.reviewed_at}
                  format="relative"
                  className="text-muted text-sm"
                />
              )
          }
        }}
      />
    </Panel>
  )
}
