import { cva, type VariantProps } from 'class-variance-authority'

import {
  Tabs as TabsPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsContents as TabsContentsPrimitive,
  TabsHighlight as TabsHighlightPrimitive,
  TabsHighlightItem as TabsHighlightItemPrimitive,
  type TabsProps as TabsPrimitiveProps,
  type TabsListProps as TabsListPrimitiveProps,
  type TabsTriggerProps as TabsTriggerPrimitiveProps,
  type TabsContentProps as TabsContentPrimitiveProps,
  type TabsContentsProps as TabsContentsPrimitiveProps,
} from '@/components/shionui/animated/libs/primitives/animate/tabs'
import { ScrollArea } from '@/components/shionui/ScrollArea'
import { cn } from '@/utils/cn'

type TabsProps = TabsPrimitiveProps

function Tabs({ className, ...props }: TabsProps) {
  return <TabsPrimitive className={cn('flex flex-col gap-2', className)} {...props} />
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground',
  {
    variants: {
      variant: {
        solid: 'h-9 rounded-lg bg-muted p-[3px]',
        bordered: 'h-9 rounded-lg border border-border/70 bg-transparent p-[3px]',
        light: 'h-9 rounded-lg bg-muted/40 p-[3px]',
        underlined: 'h-9 rounded-none bg-transparent px-0',
      },
      intent: {
        neutral: '',
        primary: '',
        secondary: '',
        success: '',
        warning: '',
        info: '',
        destructive: '',
      },
    },
    defaultVariants: {
      variant: 'solid',
      intent: 'neutral',
    },
  },
)

const tabsHighlightVariants = cva('absolute z-0 inset-0', {
  variants: {
    variant: {
      solid: 'rounded-md border border-transparent shadow-sm',
      bordered: 'rounded-md border shadow-xs',
      light: 'rounded-md shadow-none',
      underlined:
        'rounded-none border-0 shadow-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-current',
    },
    intent: {
      neutral: '',
      primary: '',
      secondary: '',
      success: '',
      warning: '',
      info: '',
      destructive: '',
    },
  },
  compoundVariants: [
    {
      variant: 'solid',
      intent: 'neutral',
      className: 'bg-background dark:border-input dark:bg-input/30',
    },
    { variant: 'solid', intent: 'primary', className: 'bg-primary' },
    { variant: 'solid', intent: 'secondary', className: 'bg-secondary' },
    { variant: 'solid', intent: 'success', className: 'bg-success' },
    { variant: 'solid', intent: 'warning', className: 'bg-warning' },
    { variant: 'solid', intent: 'info', className: 'bg-info' },
    { variant: 'solid', intent: 'destructive', className: 'bg-destructive' },
    {
      variant: 'bordered',
      intent: 'neutral',
      className: 'border-border/70 bg-background/80 dark:border-input',
    },
    { variant: 'bordered', intent: 'primary', className: 'border-primary/30 bg-primary/10' },
    { variant: 'bordered', intent: 'secondary', className: 'border-border bg-secondary/40' },
    { variant: 'bordered', intent: 'success', className: 'border-success/30 bg-success/10' },
    { variant: 'bordered', intent: 'warning', className: 'border-warning/30 bg-warning/10' },
    { variant: 'bordered', intent: 'info', className: 'border-info/30 bg-info/10' },
    {
      variant: 'bordered',
      intent: 'destructive',
      className: 'border-destructive/30 bg-destructive/10',
    },
    { variant: 'light', intent: 'neutral', className: 'bg-muted/70 dark:bg-input/40' },
    { variant: 'light', intent: 'primary', className: 'bg-primary/15' },
    { variant: 'light', intent: 'secondary', className: 'bg-secondary/40' },
    { variant: 'light', intent: 'success', className: 'bg-success/15' },
    { variant: 'light', intent: 'warning', className: 'bg-warning/15' },
    { variant: 'light', intent: 'info', className: 'bg-info/15' },
    { variant: 'light', intent: 'destructive', className: 'bg-destructive/15' },
    { variant: 'underlined', intent: 'neutral', className: 'text-foreground' },
    { variant: 'underlined', intent: 'primary', className: 'text-primary' },
    { variant: 'underlined', intent: 'secondary', className: 'text-secondary' },
    { variant: 'underlined', intent: 'success', className: 'text-success' },
    { variant: 'underlined', intent: 'warning', className: 'text-warning' },
    { variant: 'underlined', intent: 'info', className: 'text-info' },
    { variant: 'underlined', intent: 'destructive', className: 'text-destructive' },
  ],
  defaultVariants: {
    variant: 'solid',
    intent: 'neutral',
  },
})

const tabsTriggerIntentClasses = [
  'group-data-[intent=primary]/tabs-list:data-[state=active]:text-primary',
  'group-data-[intent=secondary]/tabs-list:data-[state=active]:text-secondary',
  'group-data-[intent=success]/tabs-list:data-[state=active]:text-success',
  'group-data-[intent=warning]/tabs-list:data-[state=active]:text-warning',
  'group-data-[intent=info]/tabs-list:data-[state=active]:text-info',
  'group-data-[intent=destructive]/tabs-list:data-[state=active]:text-destructive',
  'group-data-[variant=solid]/tabs-list:group-data-[intent=primary]/tabs-list:data-[state=active]:text-primary-foreground',
  'group-data-[variant=solid]/tabs-list:group-data-[intent=secondary]/tabs-list:data-[state=active]:text-secondary-foreground',
  'group-data-[variant=solid]/tabs-list:group-data-[intent=success]/tabs-list:data-[state=active]:text-success-foreground',
  'group-data-[variant=solid]/tabs-list:group-data-[intent=warning]/tabs-list:data-[state=active]:text-warning-foreground',
  'group-data-[variant=solid]/tabs-list:group-data-[intent=info]/tabs-list:data-[state=active]:text-info-foreground',
  'group-data-[variant=solid]/tabs-list:group-data-[intent=destructive]/tabs-list:data-[state=active]:text-destructive-foreground',
].join(' ')

type TabsListProps = TabsListPrimitiveProps &
  VariantProps<typeof tabsListVariants> & {
    highlightClassName?: string
    showBaseline?: boolean
    scrollable?: boolean
    scrollAreaClassName?: string
    showScrollHint?: boolean
  }

function TabsList({
  className,
  highlightClassName,
  variant,
  intent,
  showBaseline,
  scrollable,
  scrollAreaClassName,
  showScrollHint,
  ...props
}: TabsListProps) {
  const resolvedVariant = variant ?? 'solid'
  const resolvedIntent = intent ?? 'neutral'
  const resolvedShowBaseline = showBaseline ?? true
  const resolvedScrollable = scrollable ?? true
  const resolvedShowScrollHint = showScrollHint ?? true

  const tabsList = (
    <TabsHighlightPrimitive
      className={cn(
        tabsHighlightVariants({ variant: resolvedVariant, intent: resolvedIntent }),
        highlightClassName,
      )}
    >
      <TabsListPrimitive
        data-variant={resolvedVariant}
        data-intent={resolvedIntent}
        className={cn(
          tabsListVariants({ variant: resolvedVariant, intent: resolvedIntent }),
          resolvedVariant === 'underlined' && resolvedShowBaseline && 'border-b border-border',
          className,
        )}
        {...props}
      />
    </TabsHighlightPrimitive>
  )

  return (
    <div className="relative z-0 min-w-0">
      {resolvedScrollable ? (
        <ScrollArea
          className={cn(
            'w-full max-w-full rounded-md [&&_[data-slot=scroll-area-viewport]]:overflow-y-hidden [&&_[data-slot=scroll-area-viewport]]:touch-pan-x',
            scrollAreaClassName,
          )}
          showScrollHint={resolvedShowScrollHint}
          scrollbarOrientation="horizontal"
          showScrollbar={false}
        >
          {tabsList}
        </ScrollArea>
      ) : (
        tabsList
      )}
    </div>
  )
}

type TabsTriggerProps = TabsTriggerPrimitiveProps

function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsHighlightItemPrimitive value={props.value} className="flex-1">
      <TabsTriggerPrimitive
        className={cn(
          "cursor-pointer hover:data-[state=inactive]:opacity-80 active:data-[state=inactive]:opacity-60 transition-all data-[state=active]:cursor-default data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md w-full px-2 py-1 text-sm font-medium whitespace-nowrap duration-200 ease-in-out focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 group-data-[variant=underlined]/tabs-list:rounded-none group-data-[variant=underlined]/tabs-list:px-2 group-data-[variant=underlined]/tabs-list:py-2",
          tabsTriggerIntentClasses,
          className,
        )}
        {...props}
      />
    </TabsHighlightItemPrimitive>
  )
}

type TabsContentsProps = TabsContentsPrimitiveProps

function TabsContents(props: TabsContentsProps) {
  return <TabsContentsPrimitive {...props} />
}

type TabsContentProps = TabsContentPrimitiveProps

function TabsContent({ className, ...props }: TabsContentProps) {
  return <TabsContentPrimitive className={cn('outline-none', className)} {...props} />
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContents,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentsProps,
  type TabsContentProps,
}
