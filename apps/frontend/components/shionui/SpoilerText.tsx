'use client'

import { Spoiler } from 'spoiled'

interface SpoilerTextProps {
  children: React.ReactNode
  revealOn?: 'hover' | 'click'
}

export const SpoilerText = ({ children, revealOn = 'click' }: SpoilerTextProps) => {
  return (
    <Spoiler revealOn={revealOn} density={0.2}>
      {children}
    </Spoiler>
  )
}
