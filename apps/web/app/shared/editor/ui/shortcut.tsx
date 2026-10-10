import { Inline, Kbd } from '@hina-ui/react'
import { useSyncExternalStore } from 'react'

const appleKeys: Readonly<Record<string, string>> = { Mod: '⌘', Shift: '⇧', Alt: '⌥' }

const otherKeys: Readonly<Record<string, string>> = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' }

const never = () => () => undefined

function onApple(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform)
}

export function Hint({ label, shortcut }: { label: string; shortcut: string }) {
  const apple = useSyncExternalStore(never, onApple, () => false)
  const names = apple ? appleKeys : otherKeys
  return (
    <Inline as="span" gap="sm" align="center" wrap={false}>
      {label}
      <Inline as="span" gap="xs" wrap={false}>
        {shortcut.split('-').map(key => (
          <Kbd key={key}>{names[key] ?? key.toUpperCase()}</Kbd>
        ))}
      </Inline>
    </Inline>
  )
}
