'use client'

import ErrorView from '@/components/common/error/ErrorView'
import { parsePublicErrorDigest } from '@/libs/errors'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const publicError = parsePublicErrorDigest(error?.digest)
  return (
    <div className="w-full flex items-center justify-center">
      <ErrorView details={publicError?.message || error?.message} showReset onReset={reset} />
    </div>
  )
}
