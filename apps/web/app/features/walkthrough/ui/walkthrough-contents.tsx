import { Anchor, Card, Collapsible, CollapsibleContent, CollapsibleTrigger } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { Contents } from '../walkthrough'

type WalkthroughContentsProps = { contents: Contents[]; className?: string }

export function WalkthroughContents({ contents, className }: WalkthroughContentsProps) {
  const t = useTranslations('walkthrough')
  if (contents.length === 0) {
    return null
  }
  return (
    <Card padded={false} className={className}>
      <Collapsible>
        <CollapsibleTrigger className="w-full justify-between px-4 py-3">
          {t('contents')}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Anchor label={t('contents')} items={contents} autoScroll={false} className="px-4 pb-3" />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
