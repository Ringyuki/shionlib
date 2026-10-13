import { cn } from '@hina-ui/react'

export const fieldEdge = 'border-line-strong shadow-none'

const frame = [
  fieldEdge,
  'transition-[border-color,box-shadow] duration-(--hn-duration-fast) ease-(--hn-ease-enter)',
].join(' ')

const calm = [
  'focus-within:border-accent focus-within:ring-accent/20 focus-within:ring-3',
  'data-linking:border-accent data-linking:ring-accent/20 data-linking:ring-3',
].join(' ')

export function fieldFrame(refused: boolean): string {
  return cn(frame, refused ? 'border-danger' : calm)
}
