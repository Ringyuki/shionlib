import { Inline, Kbd, Text } from '@hina-ui/react'
import { useSyncExternalStore } from 'react'

const appleKeys: Readonly<Record<string, string>> = { Mod: '⌘', Shift: '⇧', Alt: '⌥' }

const otherKeys: Readonly<Record<string, string>> = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt' }

const never = () => () => undefined

function onApple(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform)
}

function useKeys(shortcut: string): { keys: string[]; joint: string } {
  const apple = useSyncExternalStore(never, onApple, () => false)
  const names = apple ? appleKeys : otherKeys
  return {
    keys: shortcut.split('-').map(key => names[key] ?? key.toUpperCase()),
    joint: apple ? '' : '+',
  }
}

export function Hint({ label, shortcut }: { label: string; shortcut: string | undefined }) {
  return shortcut === undefined ? label : <Keyed label={label} shortcut={shortcut} />
}

function Keyed({ label, shortcut }: { label: string; shortcut: string }) {
  const { keys } = useKeys(shortcut)
  return (
    <Inline as="span" gap="sm" align="center" wrap={false}>
      {label}
      <Inline as="span" gap="xs" wrap={false}>
        {keys.map(key => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </Inline>
    </Inline>
  )
}

export function ShortcutText({ shortcut }: { shortcut: string }) {
  const { keys, joint } = useKeys(shortcut)
  return (
    <Text as="span" size="xs" tone="faint" className="ms-4 tabular-nums">
      {keys.join(joint)}
    </Text>
  )
}
