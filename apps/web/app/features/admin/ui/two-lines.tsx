import { Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'

type TwoLinesProps = {
  first: ReactNode
  second?: ReactNode
  narrow?: ReactNode
}

export function TwoLines({ first, second, narrow }: TwoLinesProps) {
  return (
    <Stack gap="none" className="min-w-0">
      <Text
        as="span"
        size="sm"
        weight="medium"
        className="line-clamp-1 break-all max-md:line-clamp-2"
      >
        {first}
      </Text>
      {second !== undefined && second !== '' && (
        <Text as="span" size="sm" tone="muted" className="line-clamp-1 break-all">
          {second}
        </Text>
      )}
      {narrow !== undefined && (
        <Text as="span" size="sm" tone="muted" className="line-clamp-1 break-all md:hidden">
          {narrow}
        </Text>
      )}
    </Stack>
  )
}
