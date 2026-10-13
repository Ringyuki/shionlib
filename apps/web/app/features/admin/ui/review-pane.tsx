import { Drawer, Sheet } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useNarrow } from '~/shared/ui/use-media'

type PaneState = { close: () => void; submitting: boolean }

type ReviewPaneProps = {
  heading: string
  note?: string
  open: boolean
  onClose: () => void
  renderContent: (state: PaneState) => ReactNode
  renderFooter?: (state: PaneState) => ReactNode
}

export function ReviewPane({ heading, note, onClose, ...pane }: ReviewPaneProps) {
  const narrow = useNarrow()
  const onOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
    }
  }
  return narrow ? (
    <Sheet {...pane} title={heading} description={note} onOpenChange={onOpenChange} />
  ) : (
    <Drawer
      {...pane}
      title={heading}
      description={note}
      onOpenChange={onOpenChange}
      size="lg"
      className="w-144"
    />
  )
}
