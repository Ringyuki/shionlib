import { useEffect, useState, type ReactNode } from 'react'
import { createUploadManager } from '../upload-browser'
import { UploadContext } from '../use-uploads'

function managerFor(viewer: number | undefined) {
  const browser = typeof window !== 'undefined'
  return {
    viewer,
    manager: viewer === undefined || !browser ? undefined : createUploadManager(viewer),
  }
}

export function UploadProvider({
  viewer,
  children,
}: {
  viewer: number | undefined
  children: ReactNode
}) {
  const [current, setCurrent] = useState(() => managerFor(viewer))
  if (current.viewer !== viewer) {
    setCurrent(managerFor(viewer))
  }
  useEffect(() => {
    const { manager } = current
    void manager?.start()
    return () => manager?.dispose()
  }, [current])
  return <UploadContext value={current.manager}>{children}</UploadContext>
}
