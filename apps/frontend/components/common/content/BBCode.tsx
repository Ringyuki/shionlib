'use client'

import { bbcodeRender } from '@/utils/bbcode/render'

interface BBCodeContentProps {
  content: string
  onlyBr?: boolean
  className?: string
}

export function BBCodeContent({ content, onlyBr, className }: BBCodeContentProps) {
  if (onlyBr) {
    const lines = content.split(/\r?\n/)
    return (
      <div className={className}>
        {lines.map((line, index) => (
          <span key={index}>
            {line}
            {index < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    )
  }
  const reactContent = bbcodeRender(content)

  return <div className={className}>{reactContent}</div>
}
