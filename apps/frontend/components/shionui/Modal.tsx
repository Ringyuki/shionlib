'use client'

import * as React from 'react'
import { useMedia } from 'react-use'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shionui/Dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/shionui/Drawer'
import { cn } from '@/utils/cn'

type ModalTone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive'

interface ShionlibModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  /**
   * Whether backdrop click / swipe dismisses the modal.
   * Maps to `maskClosable` on Dialog and `dismissible` on Drawer.
   * @default true
   */
  closable?: boolean
  /**
   * Viewport width (px) below which Drawer is rendered instead of Dialog.
   * @default 1024
   */
  breakpoint?: number
  /** Dialog-only: tone for colored border and title */
  tone?: ModalTone
  /** Dialog-only: fit content width instead of fixed max-width */
  fitContent?: boolean
  /** Extra className forwarded to DialogContent */
  dialogClassName?: string
  /** Extra className forwarded to DrawerContent */
  drawerClassName?: string
  /** data-testid forwarded to DialogContent / DrawerContent */
  'data-testid'?: string
}

function ShionlibModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closable = true,
  breakpoint = 1024,
  tone,
  fitContent,
  dialogClassName,
  drawerClassName,
  'data-testid': testId,
}: ShionlibModalProps) {
  const isMobile = useMedia(`(max-width: ${breakpoint}px)`, false)

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={closable}>
        <DrawerContent aria-describedby={!description ? undefined : undefined} data-testid={testId}>
          {title && (
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
          )}
          <div className={cn('px-3 overflow-y-auto pb-4', drawerClassName)}>{children}</div>
          {footer && <DrawerFooter>{footer}</DrawerFooter>}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maskClosable={closable}>
      <DialogContent
        aria-describedby={!description ? undefined : undefined}
        tone={tone}
        fitContent={fitContent}
        className={dialogClassName}
        data-testid={testId}
      >
        {title && (
          <DialogHeader>
            <DialogTitle tone={tone}>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}

const Modal = ShionlibModal

export { Modal, ShionlibModal }
export type { ShionlibModalProps }
