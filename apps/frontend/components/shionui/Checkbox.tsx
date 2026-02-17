'use client'

import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from '@base-ui-components/react/checkbox'
import { motion, type HTMLMotionProps, type SVGMotionProps } from 'motion/react'

import { getStrictContext } from '@/components/shionui/libs/get-strict-context'
import { useControlledState } from '@/components/shionui/animated/hooks/use-controlled-state'
import { cn } from '@/utils/cn'

type CheckboxContextType = {
  isChecked: boolean
  setIsChecked: CheckboxProps['onCheckedChange']
  isIndeterminate: boolean | undefined
}

const [CheckboxProvider, useCheckbox] = getStrictContext<CheckboxContextType>('CheckboxContext')

type CheckboxProps = Omit<React.ComponentProps<typeof CheckboxPrimitive.Root>, 'render'> &
  HTMLMotionProps<'button'> & {
    indicatorClassName?: string
  }

function Checkbox({
  name,
  checked,
  defaultChecked,
  onCheckedChange,
  indeterminate,
  value,
  nativeButton,
  parent,
  disabled,
  readOnly,
  required,
  inputRef,
  id,
  className,
  type = 'button',
  children,
  indicatorClassName,
  ...props
}: CheckboxProps) {
  const [isChecked, setIsChecked] = useControlledState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  })

  return (
    <CheckboxProvider value={{ isChecked, setIsChecked, isIndeterminate: indeterminate }}>
      <CheckboxPrimitive.Root
        name={name}
        defaultChecked={defaultChecked}
        checked={isChecked}
        onCheckedChange={setIsChecked}
        indeterminate={indeterminate}
        value={value}
        nativeButton={nativeButton}
        parent={parent}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        inputRef={inputRef}
        id={id}
        render={
          <motion.button
            data-slot="checkbox"
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.05 }}
            type={type}
            className={cn(
              'size-4 rounded-sm border border-input shadow-xs bg-background text-primary-foreground transition-[color,box-shadow,background-color,border-color] outline-none',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'data-[checked]:bg-primary data-[checked]:border-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            {...props}
          >
            {children ?? (
              <CheckboxIndicator
                className={cn('size-3.5 text-primary-foreground', indicatorClassName)}
              />
            )}
          </motion.button>
        }
      />
    </CheckboxProvider>
  )
}

type CheckboxIndicatorProps = SVGMotionProps<SVGSVGElement>

function CheckboxIndicator(props: CheckboxIndicatorProps) {
  const { isChecked, isIndeterminate } = useCheckbox()

  return (
    <CheckboxPrimitive.Indicator
      keepMounted
      render={
        <motion.svg
          data-slot="checkbox-indicator"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          initial="unchecked"
          animate={isChecked || isIndeterminate ? 'checked' : 'unchecked'}
          {...props}
        >
          {isIndeterminate ? (
            <motion.line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{
                pathLength: 1,
                opacity: 1,
                transition: { duration: 0.2 },
              }}
            />
          ) : (
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
              variants={{
                checked: {
                  pathLength: 1,
                  opacity: 1,
                  transition: {
                    duration: 0.2,
                    delay: 0.2,
                  },
                },
                unchecked: {
                  pathLength: 0,
                  opacity: 0,
                  transition: {
                    duration: 0.2,
                  },
                },
              }}
            />
          )}
        </motion.svg>
      }
    ></CheckboxPrimitive.Indicator>
  )
}

export {
  Checkbox,
  CheckboxIndicator,
  useCheckbox,
  type CheckboxProps,
  type CheckboxIndicatorProps,
  type CheckboxContextType,
}
