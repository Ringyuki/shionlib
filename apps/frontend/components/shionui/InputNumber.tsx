'use client'

import * as React from 'react'
import { PlusIcon, MinusIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Input } from '@/components/shionui/Input'
import { Button } from '@/components/shionui/Button'

type InputSize = 'sm' | 'md' | 'lg'

type InputNumberProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'inputMode'
> & {
  value?: number | null
  defaultValue?: number
  onChange?: (value: number | null) => void
  size?: InputSize
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  step?: number
  min?: number
  max?: number
  precision?: number
  clearable?: boolean
  onClear?: () => void
  formatter?: (value: number | null) => string
  parser?: (input: string) => number | null
  allowWheel?: boolean
  clampOnBlur?: boolean
  showIncrement?: boolean
  showDecrement?: boolean
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'h-8 text-sm px-3 py-1',
  md: 'h-9 md:text-sm px-3 py-1',
  lg: 'h-10 text-base px-4 py-2',
}

const calcPadding = (base: string, hasPrefix: boolean, hasInteractiveRight: boolean): string => {
  return cn(base, hasPrefix && 'pl-9', hasInteractiveRight && 'pr-16')
}

function getStepPrecision(step: number): number {
  const s = step.toString()
  if (!s.includes('.')) return 0
  return s.split('.')[1].length
}

function clamp(value: number, min?: number, max?: number): number {
  let v = value
  if (min !== undefined) v = Math.max(v, min)
  if (max !== undefined) v = Math.min(v, max)
  return v
}

function roundToPrecision(value: number, precision: number | undefined): number {
  if (!Number.isFinite(value)) return value
  if (precision === undefined) return value
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}

function defaultParser(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null
  const normalized = trimmed.replace(/[^0-9+\-\.eE]/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function defaultFormatter(value: number | null): string {
  return value == null ? '' : String(value)
}

const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(
  (
    {
      className,
      size = 'md' as InputSize,
      prefix,
      suffix,
      value,
      defaultValue,
      onChange,
      step = 1,
      min,
      max,
      precision,
      clearable,
      onClear,
      formatter = defaultFormatter,
      parser = defaultParser,
      allowWheel = true,
      clampOnBlur = true,
      disabled,
      readOnly,
      showIncrement = true,
      showDecrement = true,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const isControlled = value !== undefined
    const initialNumber: number | null = isControlled
      ? (value as number | null)
      : (defaultValue ?? null)

    const [internalNumber, setInternalNumber] = React.useState<number | null>(initialNumber)
    const currentNumber = isControlled ? (value as number | null) : internalNumber
    const lastValidRef = React.useRef<number | null>(currentNumber)

    const [inputString, setInputString] = React.useState<string>(formatter(currentNumber))

    React.useEffect(() => {
      if (isControlled) {
        setInputString(formatter(value as number | null))
      }
      lastValidRef.current = isControlled
        ? ((value as number | null) ?? null)
        : lastValidRef.current
    }, [isControlled, value, formatter])

    const emitChange = (next: number | null) => {
      if (!isControlled) setInternalNumber(next)
      onChange?.(next)
    }

    const applyConstraints = (n: number | null, round: boolean): number | null => {
      if (n == null) return null
      const p = precision ?? getStepPrecision(step)
      let v = n
      if (round) v = roundToPrecision(v, p)
      v = clamp(v, min, max)
      if (round) v = roundToPrecision(v, p)
      return v
    }

    const commitFromString = (raw: string, options?: { round?: boolean }) => {
      const parsed = parser(raw)
      const rounded = applyConstraints(parsed, options?.round ?? true)
      setInputString(formatter(rounded))
      lastValidRef.current = rounded
      emitChange(rounded)
    }

    const handleInput: React.FormEventHandler<HTMLInputElement> = e => {
      const str = e.currentTarget.value
      const parsed = parser(str)
      if (parsed == null && str.trim() !== '') return
      if (parsed == null) {
        setInputString('')
        lastValidRef.current = null
        emitChange(null)
        return
      }
      const p = precision ?? getStepPrecision(step)
      const soft = roundToPrecision(parsed, p)
      const clamped = clamp(soft, min, max)
      const nextStr = formatter(clamped)
      setInputString(nextStr)
      lastValidRef.current = clamped
      emitChange(clamped)
    }

    const handleBlur: React.FocusEventHandler<HTMLInputElement> = e => {
      if (!clampOnBlur || readOnly) return
      commitFromString(e.currentTarget.value, { round: true })
      props.onBlur?.(e)
    }

    const stepBy = (direction: 1 | -1, factor = 1) => {
      if (disabled || readOnly) return
      const base = lastValidRef.current ?? 0
      const delta = step * factor * direction
      const next = applyConstraints(base + delta, true)
      setInputString(formatter(next))
      lastValidRef.current = next
      emitChange(next)
    }

    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = e => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        stepBy(1, e.shiftKey ? 10 : 1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        stepBy(-1, e.shiftKey ? 10 : 1)
      } else if (e.key === 'Enter') {
        commitFromString((e.currentTarget as HTMLInputElement).value, { round: true })
      }
      props.onKeyDown?.(e)
    }

    const handleWheel: React.WheelEventHandler<HTMLInputElement> = e => {
      if (!allowWheel) return
      if (document.activeElement !== inputRef.current) return
      if (e.deltaY < 0) stepBy(1)
      else if (e.deltaY > 0) stepBy(-1)
    }

    const handleClear = () => {
      if (disabled || readOnly) return
      setInputString('')
      lastValidRef.current = null
      emitChange(null)
      onClear?.()
      inputRef.current?.focus()
    }

    const baseClass = calcPadding(sizeClasses[size], !!prefix, true)

    return (
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={className}
        inputClassName={cn(baseClass)}
        prefix={prefix}
        suffix={suffix}
        clearable={clearable && !readOnly && !disabled}
        onClear={handleClear}
        rightSlot={
          <div className="flex gap-1 items-center justify-center">
            {showIncrement && (
              <Button
                size="icon"
                appearance="ghost"
                intent="secondary"
                aria-label="Increment"
                className="h-4 w-4 p-0"
                onClick={() => stepBy(1)}
                disabled={
                  disabled || readOnly || (max !== undefined && (currentNumber ?? 0) >= max)
                }
                tabIndex={-1}
                renderIcon={<PlusIcon className="h-3 w-3" />}
              />
            )}
            {showDecrement && (
              <Button
                size="icon"
                appearance="ghost"
                intent="secondary"
                aria-label="Decrement"
                className="h-4 w-4 p-0"
                onClick={() => stepBy(-1)}
                disabled={
                  disabled || readOnly || (min !== undefined && (currentNumber ?? 0) <= min)
                }
                tabIndex={-1}
                renderIcon={<MinusIcon className="h-3 w-3" />}
              />
            )}
          </div>
        }
        value={inputString}
        onInput={handleInput}
        onBlur={handleBlur}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        readOnly={readOnly}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={currentNumber ?? undefined}
        role="spinbutton"
        {...props}
      />
    )
  },
)

InputNumber.displayName = 'InputNumber'

export { InputNumber }
