import { cn } from '@hina-ui/react'

const firstLine = [
  '[--lead:calc((2.75rem-2px-1lh)/2)] ps-3.5 pe-3 pt-(--lead)',
  'transition-[padding-bottom,min-height] duration-(--hn-duration-fast) ease-(--hn-ease-move)',
].join(' ')

export function textArea(collapsible: boolean, open: boolean): string {
  if (!collapsible) {
    return 'min-h-[calc(2lh+0.5rem)] ps-3 pe-2.5 pt-2'
  }
  return cn(
    firstLine,
    open ? 'min-h-[calc(3lh+var(--lead))] pb-0' : 'min-h-[calc(2.75rem-2px)] pb-(--lead)',
  )
}

export const toolsClip = 'pointer-events-none -mt-1 min-h-0 overflow-hidden pt-1'

export function toolsInset(collapsible: boolean): string {
  return cn('pointer-events-auto', collapsible ? 'ps-2 pe-3 pb-2.5' : 'ps-1.5 pe-2.5 pb-2')
}

const toolsShown = [
  'visible grid-rows-[1fr] opacity-100',
  'duration-[var(--hn-duration-fast),calc(var(--hn-duration-fast)/2),0s]',
  'delay-[0s,calc(var(--hn-duration-fast)/2),0s]',
].join(' ')

const toolsHidden = [
  'invisible grid-rows-[0fr] opacity-0',
  'duration-[var(--hn-duration-fast),calc(var(--hn-duration-fast)/3),0s]',
  'delay-[0s,0s,var(--hn-duration-fast)]',
].join(' ')

export function toolsReveal(shown: boolean): string {
  return cn(
    'transition-[grid-template-rows,opacity,visibility] ease-(--hn-ease-move)',
    shown ? toolsShown : toolsHidden,
  )
}
