export const docColumns = {
  head: 'items-start gap-x-10 gap-y-4 @xl:grid-cols-[minmax(0,1fr)_15rem] @4xl:grid-cols-[minmax(0,47.5rem)_17.5rem]',
  body: 'items-start gap-x-10 @4xl:grid-cols-[minmax(0,47.5rem)_17.5rem]',
  rail: '@max-4xl:hidden',
  fold: '@4xl:hidden',
} as const
