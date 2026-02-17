'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'

import { ScrollBar } from '@/components/shionui/ScrollBar'
import { cn } from '@/utils/cn'

type DialogTone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive'

function toneBorderClass(tone: DialogTone | undefined) {
  switch (tone) {
    case 'info':
      return 'border-info/40'
    case 'success':
      return 'border-success/40'
    case 'warning':
      return 'border-warning/40'
    case 'destructive':
      return 'border-destructive/40'
    default:
      return 'border-border'
  }
}

function toneTextClass(tone: DialogTone | undefined) {
  switch (tone) {
    case 'info':
      return 'text-info'
    case 'success':
      return 'text-success'
    case 'warning':
      return 'text-warning'
    case 'destructive':
      return 'text-destructive'
    default:
      return undefined
  }
}

interface DialogProps extends React.ComponentProps<typeof DialogPrimitive.Root> {
  maskClosable?: boolean
}

const DialogOptionsContext = React.createContext<{ maskClosable: boolean }>({ maskClosable: true })

function Dialog({ maskClosable = true, ...props }: DialogProps) {
  const { children, onOpenChange, ...rest } = props
  return (
    <DialogOptionsContext.Provider value={{ maskClosable }}>
      <DialogPrimitive.Root data-slot="dialog" {...rest} onOpenChange={onOpenChange}>
        {children}
      </DialogPrimitive.Root>
    </DialogOptionsContext.Provider>
  )
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  tone,
  fitContent,
  ...rest
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  tone?: DialogTone
  fitContent?: boolean
}) {
  const { maskClosable } = React.useContext(DialogOptionsContext)

  const handleInteractOutside = React.useCallback<
    NonNullable<React.ComponentProps<typeof DialogPrimitive.Content>['onInteractOutside']>
  >(
    event => {
      if (!maskClosable) {
        event.preventDefault()
      }
      rest.onInteractOutside?.(event)
    },
    [maskClosable, rest],
  )

  const handlePointerDownOutside = React.useCallback<
    NonNullable<React.ComponentProps<typeof DialogPrimitive.Content>['onPointerDownOutside']>
  >(
    event => {
      if (!maskClosable) {
        event.preventDefault()
      }
      rest.onPointerDownOutside?.(event)
    },
    [maskClosable, rest],
  )

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        {...rest}
        onInteractOutside={handleInteractOutside}
        onPointerDownOutside={handlePointerDownOutside}
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 max-w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg border shadow-lg duration-200 overflow-hidden',
          fitContent ? 'w-auto' : 'w-full sm:max-w-lg',
          toneBorderClass(tone),
          className,
        )}
        data-tone={tone}
      >
        <ScrollBar
          className={cn(
            'max-h-[calc(100dvh-2rem)] min-h-0 w-full rounded-[inherit] p-6',
            className,
          )}
        >
          <div className="grid gap-4">{children}</div>
        </ScrollBar>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  tone,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title> & { tone?: DialogTone }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', toneTextClass(tone), className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
