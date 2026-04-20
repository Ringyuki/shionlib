import { useTranslations } from 'next-intl'
import { Badge } from '@/components/shionui/Badge'
import { Checkbox } from '@/components/shionui/Checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@/components/shionui/Field'
import { actionIntent, confidenceIntent } from './candidate-intents'
import { PayloadBlock } from './PayloadBlock'
import type { FieldSyncCandidate } from './types'

interface FieldSyncCandidateCardProps {
  candidate: FieldSyncCandidate
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export const FieldSyncCandidateCard = ({
  candidate,
  checked,
  onCheckedChange,
}: FieldSyncCandidateCardProps) => {
  const t = useTranslations('Components.Game.Edit.FieldSync')

  return (
    <FieldLabel className="cursor-pointer border-border/70 bg-background-soft/50 p-0">
      <Field orientation="horizontal" data-disabled={!candidate.applicable}>
        <Checkbox
          id={`field-sync-${candidate.id}`}
          checked={checked}
          disabled={!candidate.applicable}
          onCheckedChange={value => onCheckedChange(Boolean(value))}
        />
        <FieldContent className="min-w-0 flex-1 space-y-2">
          <CandidateBadges candidate={candidate} />
          <div>
            <FieldTitle className="truncate">{candidate.title}</FieldTitle>
            {candidate.subtitle && (
              <FieldDescription className="truncate text-xs">{candidate.subtitle}</FieldDescription>
            )}
          </div>
          {candidate.warnings?.map(warning => (
            <FieldDescription key={warning} className="text-xs text-warning">
              {warning}
            </FieldDescription>
          ))}
          <div className="grid gap-2 md:grid-cols-2">
            {candidate.local && <PayloadBlock title={t('local')} value={candidate.local} />}
            {candidate.remote && <PayloadBlock title={t('remote')} value={candidate.remote} />}
          </div>
        </FieldContent>
      </Field>
    </FieldLabel>
  )
}

const CandidateBadges = ({ candidate }: { candidate: FieldSyncCandidate }) => {
  const t = useTranslations('Components.Game.Edit.FieldSync')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge intent={actionIntent(candidate.action)} appearance="soft" size="sm">
        {t(`action.${candidate.action}`)}
      </Badge>
      <Badge intent="neutral" appearance="outline" size="sm">
        {t(`source.${candidate.source}`)}
      </Badge>
      <Badge intent={confidenceIntent(candidate.confidence)} appearance="outline" size="sm">
        {t(`confidence.${candidate.confidence}`)}
      </Badge>
      {!candidate.applicable && (
        <Badge intent="warning" appearance="soft" size="sm">
          {t('notApplicable')}
        </Badge>
      )}
    </div>
  )
}
