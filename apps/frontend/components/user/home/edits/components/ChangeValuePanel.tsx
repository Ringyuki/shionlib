import { ScrollArea } from '@/components/shionui/ScrollArea'
import { cn } from '@/utils/cn'
import { ChangeTone, CHANGE_PANEL_TONE_CLASSNAME } from '../constants/edit-changes'
import { formatValue } from '../helpers/edit-changes'

interface ChangeValuePanelProps {
  value: unknown
  tone: ChangeTone
  emptyLabel: string
}

export const ChangeValuePanel = ({ value, tone, emptyLabel }: ChangeValuePanelProps) => {
  return (
    <div
      className={cn(
        'text-sm rounded-md border',
        CHANGE_PANEL_TONE_CLASSNAME[tone] ?? CHANGE_PANEL_TONE_CLASSNAME.neutral,
      )}
    >
      <ScrollArea className="max-h-40">
        <pre className="whitespace-pre-wrap break-all font-mono! text-xs p-2">
          {formatValue(value, emptyLabel)}
        </pre>
      </ScrollArea>
    </div>
  )
}
