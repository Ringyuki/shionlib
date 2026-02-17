'use client'

import ErrorView from '@/components/common/error/ErrorView'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="w-full flex items-center justify-center">
      <ErrorView details={error?.message} showReset onReset={reset} />
    </div>
  )
}
