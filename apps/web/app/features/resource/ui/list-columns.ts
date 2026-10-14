export const listColumns = {
  list: 'grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]',
  span: 'col-span-full grid-cols-subgrid gap-x-6',
  name: 'col-start-1 min-w-0',
  size: 'justify-self-end whitespace-nowrap max-sm:hidden sm:col-start-2',
  hash: 'max-sm:hidden sm:col-start-3',
  action: 'col-start-2 justify-self-end sm:col-start-4',
} as const
