import { useTranslations } from 'next-intl'
import { Badge } from '@/components/shionui/Badge'
import { Field, FieldContent, FieldDescription, FieldTitle } from '@/components/shionui/Field'
import { ToggleGroupItem } from '@/components/shionui/ToggleGroup'
import { actionIntent, confidenceIntent } from './candidate-intents'
import { FieldSyncCandidateDiff } from './FieldSyncCandidateDiff'
import type { FieldSyncCandidate } from '../types/field-sync'

interface FieldSyncCandidateCardProps {
  candidate: FieldSyncCandidate
}

export const FieldSyncCandidateCard = ({ candidate }: FieldSyncCandidateCardProps) => {
  return (
    <ToggleGroupItem
      value={candidate.id}
      disabled={!candidate.applicable}
      aria-label={candidate.title}
      className="group/toggle-group-item h-auto w-full justify-start whitespace-normal rounded-lg border border-border/70 text-left data-[state=on]:border-primary/40 [&>div]:w-full transition-all hover:bg-card hover:text-foreground hover:border-primary/40 focus:z-0 focus-visible:z-0"
    >
      <Field orientation="horizontal" data-disabled={!candidate.applicable} className="p-3">
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
          <FieldSyncCandidateDiff candidate={candidate} />
        </FieldContent>
      </Field>
    </ToggleGroupItem>
  )
}

const CandidateBadges = ({ candidate }: { candidate: FieldSyncCandidate }) => {
  const t = useTranslations('Components.Common.Edit.FieldSync')

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
