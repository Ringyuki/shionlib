'use client'

import { Editor } from '@/components/editor/Editor'
import { Plugins } from './editor/plugins'

export const WalkthroughEditor = () => {
  return (
    <div className="w-full min-w-0">
      <Editor CustomPlugins={Plugins} />
    </div>
  )
}
