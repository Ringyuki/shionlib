import { Alert } from '@hina-ui/react'
import { useState } from 'react'

export function FailureAlert({ message }: { message: string | undefined }) {
  const [shown, setShown] = useState(message)
  if (message !== undefined && message !== shown) {
    setShown(message)
  }
  return (
    <Alert tone="danger" open={message !== undefined}>
      {shown}
    </Alert>
  )
}
