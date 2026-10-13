import { Prose } from '@hina-ui/react'
import type { ReactNode } from 'react'
import type { RichDocument } from '~/shared/richtext/rich-text'
import { RichInline } from './rich-text-inline'

type RichTextProps = {
  document: RichDocument
  lead?: ReactNode
  className?: string
}

export function RichText({ document, lead, className }: RichTextProps) {
  return (
    <Prose className={className}>
      {document.content.map((node, index) => {
        const said = node.content ?? []
        const led = index === 0 ? lead : undefined
        return (
          <p key={index}>
            {led}
            {said.length === 0 && led === undefined ? <br /> : <RichInline nodes={said} />}
          </p>
        )
      })}
    </Prose>
  )
}
