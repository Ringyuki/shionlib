'use client'

import * as React from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'

import { cn } from '@/utils/cn'
import { Button } from '@/components/shionui/Button'

type AlertDialogTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'destructive'

function toneBorderClass(tone: AlertDialogTone | undefined) {
  switch (tone) {
    case 'primary':
      return 'border-primary/40'
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

function toneTextClass(tone: AlertDialogTone | undefined) {
  switch (tone) {
    case 'primary':
      return 'text-primary'
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

function toneToIntent(
  tone: AlertDialogTone | undefined,
): NonNullable<React.ComponentProps<typeof Button>['intent']> {
  switch (tone) {
    case 'primary':
      return 'primary'
    case 'info':
      return 'info'
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'destructive':
      return 'destructive'
    default:
      return 'neutral'
  }
}

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  tone,
  fitContent,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  tone?: AlertDialogTone
  fitContent?: boolean
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200',
          fitContent ? 'w-auto' : 'w-full sm:max-w-lg',
          toneBorderClass(tone),
          className,
        )}
        data-tone={tone}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  tone,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title> & { tone?: AlertDialogTone }) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('text-lg font-semibold', toneTextClass(tone), className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  tone,
  loading,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & {
  tone?: AlertDialogTone
  loading?: boolean
}) {
  const intent = toneToIntent(tone)
  return (
    <AlertDialogPrimitive.Action asChild>
      <Button
        intent={intent}
        appearance="solid"
        className={className}
        loading={loading}
        {...props}
      />
    </AlertDialogPrimitive.Action>
  )
}

function AlertDialogCancel({
  className,
  tone,
  loading,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> & {
  tone?: AlertDialogTone
  loading?: boolean
}) {
  const intent = toneToIntent(tone)
  return (
    <AlertDialogPrimitive.Cancel asChild>
      <Button
        intent={intent}
        appearance="outline"
        className={cn(className)}
        loading={loading}
        {...props}
      />
    </AlertDialogPrimitive.Cancel>
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
