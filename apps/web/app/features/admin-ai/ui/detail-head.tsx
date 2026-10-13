import { Flex, Heading, Inline, Link, Stack, Text } from '@hina-ui/react'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link as RouterLink } from 'react-router'

type DetailHeadProps = {
  back: { to: string; label: string }
  heading: string
  mark?: ReactNode
  facts: ReactNode
  actions: ReactNode
}

export function DetailHead({ back, heading, mark, facts, actions }: DetailHeadProps) {
  return (
    <Stack as="header" gap="md">
      <Link asChild className="inline-flex items-center gap-1.5 self-start">
        <RouterLink to={back.to} prefetch="intent">
          <ArrowLeft aria-hidden className="size-4" />
          {back.label}
        </RouterLink>
      </Link>
      <Flex className="flex-col items-start gap-3 md:flex-row">
        <Stack gap="sm" className="min-w-0 flex-1">
          <Inline gap="sm" align="center">
            <Heading level={1} className="break-all">
              {heading}
            </Heading>
            {mark}
          </Inline>
          <Text as="span" tone="muted" className="break-all">
            {facts}
          </Text>
        </Stack>
        <Inline gap="md" align="center" wrap={false} className="md:shrink-0">
          {actions}
        </Inline>
      </Flex>
    </Stack>
  )
}
