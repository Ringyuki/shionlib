import { JSX } from 'react'
import { ContentEditable as LexicalContentEditable } from '@lexical/react/LexicalContentEditable'
import { cn } from '@/utils/cn'

type Props = {
  placeholder: string | React.ReactNode
  className?: string
  placeholderClassName?: string
}

export function ContentEditable({
  placeholder,
  className,
  placeholderClassName,
}: Props): JSX.Element {
  return (
    <LexicalContentEditable
      className={cn(
        className,
        'ContentEditable__root relative block overflow-auto px-8 py-4 focus:outline-none',
      )}
      aria-placeholder={typeof placeholder === 'string' ? placeholder : ''}
      placeholder={
        <div
          className={cn(
            placeholderClassName,
            'text-muted-foreground pointer-events-none absolute top-0 left-0 overflow-hidden px-8 py-4 text-base text-ellipsis select-none',
          )}
        >
          {placeholder}
        </div>
      }
    />
  )
}
