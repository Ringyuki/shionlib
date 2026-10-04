import { Callout } from '@hina-ui/react'

export function FailureCallout({ message }: { message: string | undefined }) {
  if (message === undefined) {
    return null
  }
  return (
    <Callout tone="danger" role="alert">
      {message}
    </Callout>
  )
}
