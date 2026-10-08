import { useEffect, useEffectEvent, useRef } from 'react'
import { useFetcher } from 'react-router'
import type { ApiFailure } from '~/shared/api/types'
import type {
  FileRemoval,
  FileRename,
  ResourceDeletion,
  ResourceEdit,
  ResourceReport,
} from './resource.schema'
import type { editResourceAction } from './resource.server'

type CommandAction = typeof editResourceAction

type CommandOptions = {
  onDone: () => void
  revalidate?: boolean
}

type Confirmation = { resolve: () => void; reject: (failure: ApiFailure) => void }

export function useResourceCommand<
  Command extends ResourceReport | ResourceEdit | ResourceDeletion | FileRename | FileRemoval,
>(action: string, { onDone, revalidate = true }: CommandOptions) {
  const fetcher = useFetcher<CommandAction>()
  const confirming = useRef<Confirmation | undefined>(undefined)
  const settle = useEffectEvent((result: NonNullable<typeof fetcher.data>) => {
    const confirmation = confirming.current
    confirming.current = undefined
    if (result.ok) {
      onDone()
      confirmation?.resolve()
    } else {
      confirmation?.reject(result.failure)
    }
  })
  const settled = fetcher.state === 'submitting' ? undefined : fetcher.data
  useEffect(() => {
    if (settled !== undefined) {
      settle(settled)
    }
  }, [settled])
  const submit = (command: Command) =>
    fetcher.submit(command, {
      method: 'post',
      action,
      encType: 'application/json',
      defaultShouldRevalidate: revalidate,
    })
  const confirm = (command: Command) =>
    new Promise<void>((resolve, reject) => {
      confirming.current = { resolve, reject }
      void submit(command)
    })
  return {
    submit,
    confirm,
    pending: fetcher.state !== 'idle',
    failure: fetcher.data?.ok === false ? fetcher.data.failure : undefined,
  }
}
