'use client'

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/utils/cn'
import { cva as createVariants } from 'class-variance-authority'
import { motion, AnimatePresence } from 'motion/react'
import { useState, Children, isValidElement, useRef, forwardRef, useImperativeHandle } from 'react'
import { Loader2, LoaderCircle } from 'lucide-react'
import { useAuthDialogStore } from '@/store/authDialogStore'
import { useShionlibUserStore } from '@/store/userStore'

const baseButton = createVariants(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: 'h-6 rounded-md gap-1 px-2 has-[>svg]:px-2',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

const shionButtonVariants = cva('', {
  variants: {
    intent: {
      primary: '',
      secondary: '',
      success: '',
      warning: '',
      info: '',
      destructive: '',
      neutral: '',
    },
    appearance: {
      solid: '',
      outline: '',
      soft: '',
      ghost: '',
      link: '',
    },
    size: {
      default: '',
      xs: '',
      sm: '',
      lg: '',
      icon: '',
    },
  },
  compoundVariants: [
    {
      intent: 'primary',
      appearance: 'solid',
      className:
        'bg-primary text-primary-foreground shadow-xs hover:bg-primary-700 active:bg-primary-700',
    },
    {
      intent: 'secondary',
      appearance: 'solid',
      className:
        'bg-secondary text-secondary-foreground shadow-xs hover:bg-neutral/25 active:bg-neutral/35',
    },
    {
      intent: 'success',
      appearance: 'solid',
      className: 'bg-success text-white shadow-xs hover:bg-success-700 active:bg-success-800',
    },
    {
      intent: 'warning',
      appearance: 'solid',
      className:
        'bg-warning text-warning-foreground shadow-xs hover:bg-warning-700 active:bg-warning-800',
    },
    {
      intent: 'info',
      appearance: 'solid',
      className: 'bg-info text-info-foreground shadow-xs hover:bg-info-700 active:bg-info-800',
    },
    {
      intent: 'destructive',
      appearance: 'solid',
      className: 'bg-destructive text-white shadow-xs hover:bg-danger-700 active:bg-danger-800',
    },
    {
      intent: 'neutral',
      appearance: 'solid',
      className:
        'bg-neutral-800 text-white shadow-xs hover:bg-neutral-700 active:bg-neutral-800 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300',
    },

    // outline
    {
      intent: 'primary',
      appearance: 'outline',
      className:
        'border border-primary/30 text-primary bg-background hover:bg-primary-100 active:bg-primary-200 dark:bg-input/30',
    },
    {
      intent: 'secondary',
      appearance: 'outline',
      className:
        'border border-border text-foreground bg-background hover:bg-accent-100 active:bg-accent-200 dark:bg-input/30',
    },
    {
      intent: 'success',
      appearance: 'outline',
      className:
        'border border-success/30 text-success bg-background hover:bg-success-100 active:bg-success-200 dark:bg-input/30',
    },
    {
      intent: 'warning',
      appearance: 'outline',
      className:
        'border border-warning/30 text-warning bg-background hover:bg-warning-100 active:bg-warning-200 dark:bg-input/30',
    },
    {
      intent: 'info',
      appearance: 'outline',
      className:
        'border border-info/30 text-info bg-background hover:bg-info-100 active:bg-info-200 dark:bg-input/30',
    },
    {
      intent: 'destructive',
      appearance: 'outline',
      className:
        'border border-destructive/30 text-destructive bg-background hover:bg-danger-100 active:bg-danger-200 dark:bg-input/30',
    },
    {
      intent: 'neutral',
      appearance: 'outline',
      className:
        'border border-neutral-300 text-foreground bg-background hover:bg-neutral-100 active:bg-neutral-200 dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
    },

    // soft
    {
      intent: 'primary',
      appearance: 'soft',
      className: 'bg-primary/15 text-primary hover:bg-primary/25 active:bg-primary/35',
    },
    {
      intent: 'secondary',
      appearance: 'soft',
      className:
        'bg-secondary text-secondary-foreground hover:bg-secondary/25 active:bg-secondary/35',
    },
    {
      intent: 'success',
      appearance: 'soft',
      className: 'bg-success/15 text-success hover:bg-success/25 active:bg-success/35',
    },
    {
      intent: 'warning',
      appearance: 'soft',
      className: 'bg-warning/15 text-warning hover:bg-warning/25 active:bg-warning/35',
    },
    {
      intent: 'info',
      appearance: 'soft',
      className: 'bg-info/15 text-info hover:bg-info/25 active:bg-info/35',
    },
    {
      intent: 'destructive',
      appearance: 'soft',
      className:
        'bg-destructive/15 text-destructive hover:bg-destructive/25 active:bg-destructive/35',
    },
    {
      intent: 'neutral',
      appearance: 'soft',
      className:
        'bg-neutral-100 text-foreground hover:bg-neutral-200 active:bg-neutral-300 dark:bg-input/30 dark:hover:bg-input/50',
    },

    // ghost
    {
      intent: 'primary',
      appearance: 'ghost',
      className: 'text-primary hover:bg-primary/10 active:bg-primary/20',
    },
    {
      intent: 'secondary',
      appearance: 'ghost',
      className: 'hover:bg-secondary/70 active:bg-secondary/80',
    },
    {
      intent: 'success',
      appearance: 'ghost',
      className: 'text-success hover:bg-success/10 active:bg-success/20',
    },
    {
      intent: 'warning',
      appearance: 'ghost',
      className: 'text-warning hover:bg-warning/10 active:bg-warning/20',
    },
    {
      intent: 'info',
      appearance: 'ghost',
      className: 'text-info hover:bg-info/10 active:bg-info/20',
    },
    {
      intent: 'destructive',
      appearance: 'ghost',
      className: 'text-destructive hover:bg-destructive/10 active:bg-destructive/20',
    },
    {
      intent: 'neutral',
      appearance: 'ghost',
      className: 'hover:bg-neutral-100 dark:hover:bg-input/40',
    },

    // link
    {
      intent: 'primary',
      appearance: 'link',
      className: 'text-primary underline-offset-4 hover:underline active:underline',
    },
    {
      intent: 'secondary',
      appearance: 'link',
      className: 'text-foreground/80 underline-offset-4 hover:underline',
    },
    {
      intent: 'success',
      appearance: 'link',
      className: 'text-success underline-offset-4 hover:underline',
    },
    {
      intent: 'warning',
      appearance: 'link',
      className: 'text-warning underline-offset-4 hover:underline',
    },
    {
      intent: 'info',
      appearance: 'link',
      className: 'text-info underline-offset-4 hover:underline',
    },
    {
      intent: 'destructive',
      appearance: 'link',
      className: 'text-destructive underline-offset-4 hover:underline',
    },
    {
      intent: 'neutral',
      appearance: 'link',
      className: 'text-foreground/80 underline-offset-4 hover:underline',
    },
  ],
  defaultVariants: {
    intent: 'primary',
    appearance: 'solid',
    size: 'default',
  },
})

interface Ripple {
  id: number
  x: number
  y: number
  size: number
}

interface RippleRef {
  addRipple: (e: React.MouseEvent<HTMLElement>) => void
}

const RippleEffect = forwardRef<RippleRef, {}>((_, ref) => {
  const [ripples, setRipples] = useState<Ripple[]>([])

  useImperativeHandle(ref, () => ({
    addRipple: (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const size = Math.max(rect.width, rect.height) * 2
      const id = Date.now() + Math.random()
      setRipples(prev => [...prev, { id, x, y, size }])
    },
  }))

  return (
    <AnimatePresence>
      {ripples.map(({ id, x, y, size }) => (
        <motion.span
          key={id}
          initial={{ opacity: 0.35, scale: 0, filter: 'blur(16px)' }}
          animate={{ opacity: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          onAnimationComplete={() => setRipples(prev => prev.filter(r => r.id !== id))}
          className="pointer-events-none absolute z-0 rounded-full"
          style={{
            width: size,
            height: size,
            left: x - size / 2,
            top: y - size / 2,
            background: 'currentColor',
            filter: 'blur(0.5px)',
          }}
        />
      ))}
    </AnimatePresence>
  )
})
RippleEffect.displayName = 'RippleEffect'

type ShionButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof shionButtonVariants> & {
    asChild?: boolean
    loading?: boolean
    loginRequired?: boolean
    renderIcon?: React.ReactNode | (() => React.ReactNode)
    iconPosition?: 'left' | 'right'
    innerClassName?: string
    showRipple?: boolean
  }

function Button({
  className,
  innerClassName,
  intent,
  appearance,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  loginRequired = false,
  renderIcon,
  iconPosition = 'left',
  showRipple = true,
  ...props
}: ShionButtonProps) {
  const rippleRef = useRef<RippleRef>(null)

  const Comp = asChild ? Slot : 'button'
  const base = baseButton({ size })
  const isDisabled = disabled || loading
  const { user } = useShionlibUserStore()
  const isLoggedIn = !!user?.id

  const handleLoginRequired = () => {
    if (loginRequired && !isLoggedIn) {
      useAuthDialogStore.getState().openAuthDialog('login')
    }
  }

  return (
    <Comp
      type="button"
      data-slot="button"
      disabled={isDisabled}
      onPointerDown={e => {
        if (!isDisabled) {
          rippleRef.current?.addRipple(e)
        }
        props.onMouseDown?.(e)
      }}
      onMouseDown={() => {
        handleLoginRequired()
      }}
      className={cn(
        base,
        shionButtonVariants({ intent, appearance, size }),
        className,
        'relative overflow-hidden duration-250 active:scale-98 active:duration-80',
        loading && 'cursor-not-allowed',
      )}
      {...props}
    >
      {(() => {
        const childArray = Children.toArray(children)
        const slotIconChild = childArray.find(
          child =>
            isValidElement(child) &&
            ((child.props as any)?.slot === 'icon' ||
              (child.props as any)?.['data-slot'] === 'icon'),
        ) as React.ReactElement | undefined

        const contentChildren = slotIconChild
          ? childArray.filter(c => c !== slotIconChild)
          : children

        const iconFromProp =
          typeof renderIcon === 'function' ? (renderIcon as () => React.ReactNode)() : renderIcon
        const iconNode = iconFromProp ?? slotIconChild ?? null
        const hasIcon = !!iconNode
        const isIconOnly =
          size === 'icon' &&
          hasIcon &&
          (!contentChildren || (Array.isArray(contentChildren) && contentChildren.length === 0))

        const hasText = !isIconOnly && !!contentChildren

        const iconElement = hasIcon ? (
          <span
            className={cn(
              'relative inline-flex size-4 items-center justify-center',
              hasText ? (iconPosition === 'right' ? 'ml-1.5' : 'mr-1.5') : undefined,
            )}
            aria-hidden="true"
          >
            <motion.span
              initial={false}
              animate={{ opacity: loading ? 1 : 0, scale: loading ? 1 : 0.98 }}
              transition={{ opacity: { duration: 0.14 }, scale: { duration: 0.18 } }}
              className="absolute inset-0 inline-flex items-center justify-center"
            >
              <motion.span
                className="size-4 inline-flex items-center justify-center origin-center"
                animate={loading ? { rotate: 360 } : { rotate: 0 }}
                transition={
                  loading ? { duration: 1, ease: 'linear', repeat: Infinity } : { duration: 0 }
                }
              >
                <LoaderCircle className="w-full h-full" />
              </motion.span>
            </motion.span>
            <motion.span
              initial={false}
              animate={{ opacity: loading ? 0 : 1, scale: loading ? 0.98 : 1 }}
              transition={{ opacity: { duration: 0.14 }, scale: { duration: 0.18 } }}
              className="inline-flex items-center justify-center"
            >
              {iconNode}
            </motion.span>
          </span>
        ) : (
          <AnimatePresence initial={false}>
            {loading && (
              <motion.span
                key="loading-icon"
                initial={{
                  opacity: 0,
                  scale: 0.8,
                  width: 0,
                  ...(iconPosition === 'right' ? { marginLeft: 0 } : { marginRight: 0 }),
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  width: 16,
                  ...(iconPosition === 'right'
                    ? { marginLeft: hasText ? 4 : 0 }
                    : { marginRight: hasText ? 4 : 0 }),
                }}
                exit={{
                  opacity: 0,
                  scale: 0.8,
                  width: 0,
                  ...(iconPosition === 'right' ? { marginLeft: 0 } : { marginRight: 0 }),
                }}
                transition={{
                  type: 'tween',
                  ease: [0.2, 0.8, 0.2, 1],
                  opacity: { duration: 0.14 },
                  scale: { duration: 0.18 },
                  width: { duration: 0.14 },
                  ...(iconPosition === 'right'
                    ? { marginLeft: { duration: 0.14 } }
                    : { marginRight: { duration: 0.14 } }),
                }}
                className="flex items-center overflow-hidden"
              >
                <motion.span
                  className="size-4 inline-flex items-center justify-center origin-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, ease: 'linear', repeat: Infinity }}
                >
                  <Loader2 className="w-full h-full" />
                </motion.span>
              </motion.span>
            )}
          </AnimatePresence>
        )

        const contentElement = !isIconOnly ? (
          <motion.span
            layout="position"
            transformTemplate={(t, generated) => {
              let s = generated
              s = s.replace(/translateY\(\s*[^)]*\)/g, 'translateY(0px)')
              s = s.replace(
                /translate3d\(\s*([^,]+),\s*([^,]+),\s*([^\)]+)\)/g,
                (_m, x, _y, z) => `translate3d(${x}, 0px, ${z})`,
              )
              s = s.replace(
                /translate\(\s*([^,]+),\s*([^\)]+)\)/g,
                (_m, x) => `translate(${x}, 0px)`,
              )
              return s
            }}
            transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1] }}
            className={cn('flex items-center', innerClassName)}
          >
            {contentChildren}
          </motion.span>
        ) : null

        return (
          <motion.span
            className={cn('relative z-10 flex items-center', innerClassName)}
            layout="position"
            transformTemplate={(_t, generated) => {
              // remove all animations on y-axis
              let s = generated
              // remove translateY
              s = s.replace(/translateY\(\s*[^)]*\)/g, 'translateY(0px)')
              // normalize translate3d(x, y, z) -> y to 0px
              s = s.replace(
                /translate3d\(\s*([^,]+),\s*([^,]+),\s*([^\)]+)\)/g,
                (_m, x, _y, z) => `translate3d(${x}, 0px, ${z})`,
              )
              // normalize translate(x, y) -> y to 0px (keep x)
              s = s.replace(
                /translate\(\s*([^,]+),\s*([^\)]+)\)/g,
                (_m, x) => `translate(${x}, 0px)`,
              )
              return s
            }}
            initial={false}
            transition={{ duration: 0.2, ease: [0.05, 0.7, 0.1, 1] }}
          >
            {iconPosition === 'right' ? (
              <>
                {contentElement}
                {iconElement}
              </>
            ) : (
              <>
                {iconElement}
                {contentElement}
              </>
            )}
          </motion.span>
        )
      })()}
      {showRipple && <RippleEffect ref={rippleRef} />}
    </Comp>
  )
}

export { Button, shionButtonVariants }
