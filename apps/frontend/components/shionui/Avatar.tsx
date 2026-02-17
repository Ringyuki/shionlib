'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { FadeImage } from '../common/shared/FadeImage'

import { cn } from '@/utils/cn'

const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    data-slot="avatar"
    className={cn(
      'relative bg-primary/20 flex size-8 shrink-0 overflow-hidden rounded-full',
      className,
    )}
    {...props}
  />
))

const AvatarImage = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    data-slot="avatar-image"
    className={cn('aspect-square size-full', className)}
    asChild
    {...props}
  >
    <FadeImage src={props.src as string} alt={props.alt as string} className={className} />
  </AvatarPrimitive.Image>
))

const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    data-slot="avatar-fallback"
    className={cn('bg-muted flex size-full items-center justify-center rounded-full', className)}
    {...props}
  />
))

Avatar.displayName = 'Avatar'
AvatarImage.displayName = 'AvatarImage'
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarImage, AvatarFallback }
