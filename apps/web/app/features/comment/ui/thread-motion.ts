const pace = [
  'overflow-clip! [overflow-anchor:none]',
  '[animation-duration:var(--hn-duration-fast)]!',
  'transition-opacity ease-(--hn-ease-enter)',
].join(' ')

export const shownOnceOpen = [
  pace,
  'data-[state=open]:starting:opacity-0',
  'data-[state=open]:duration-[calc(var(--hn-duration-fast)*0.4)]',
  'data-[state=open]:delay-[calc(var(--hn-duration-fast)*0.6)]',
  'data-[state=closed]:opacity-0',
  'data-[state=closed]:duration-[calc(var(--hn-duration-fast)/3)]',
].join(' ')

export const shownWhileOpening = [
  pace,
  'data-[state=open]:starting:opacity-0',
  'data-[state=open]:duration-(--hn-duration-fast)',
  'data-[state=closed]:opacity-0',
  'data-[state=closed]:duration-[calc(var(--hn-duration-fast)/2)]',
].join(' ')

export const openedAtOnce = 'animate-none!'
