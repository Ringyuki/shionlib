import { ScrollArea } from '@/components/shionui/ScrollArea'
import { cn } from '@/utils/cn'
import { StringDiffTone, STRING_DIFF_SEGMENT_CLASSNAME } from '../constants/edit-changes'
import { createStringDiff, StringDiffSegment } from '../helpers/edit-changes'

interface StringDiffPanelProps {
  before: string
  after: string
  beforeLabel: string
  afterLabel: string
  emptyLabel: string
}

interface DiffTextLineProps {
  segments: StringDiffSegment[]
  tone: StringDiffTone
  emptyLabel: string
}

const DiffTextLine = ({ segments, tone, emptyLabel }: DiffTextLineProps) => {
  const hasText = segments.some(segment => segment.text.length > 0)
  if (!hasText) {
    return <span className="text-muted-foreground">{emptyLabel}</span>
  }

  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${tone}-${index}-${segment.text.length}`}
          className={cn(segment.changed && STRING_DIFF_SEGMENT_CLASSNAME[tone])}
        >
          {segment.text}
        </span>
      ))}
    </>
  )
}

export const StringDiffPanel = ({
  before,
  after,
  beforeLabel,
  afterLabel,
  emptyLabel,
}: StringDiffPanelProps) => {
  const segments = createStringDiff(before, after)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{beforeLabel}</span>
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
          <ScrollArea className="max-h-40">
            <pre className="whitespace-pre-wrap break-all font-mono! text-xs p-2">
              <DiffTextLine segments={segments.before} tone="remove" emptyLabel={emptyLabel} />
            </pre>
          </ScrollArea>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{afterLabel}</span>
        <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20">
          <ScrollArea className="max-h-40">
            <pre className="whitespace-pre-wrap break-all font-mono! text-xs p-2">
              <DiffTextLine segments={segments.after} tone="add" emptyLabel={emptyLabel} />
            </pre>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
