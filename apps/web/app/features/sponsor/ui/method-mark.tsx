import { cn, Flex } from '@hina-ui/react'
import { CreditCard } from 'lucide-react'
import type { ComponentType } from 'react'
import {
  RiAlipayFill,
  RiAppleFill,
  RiGoogleFill,
  RiPaypalFill,
  RiWechatPayFill,
} from 'react-icons/ri'
import { SiTether } from 'react-icons/si'
import { knownMethod, type KnownMethod } from '../sponsor'

const marks: Record<KnownMethod, ComponentType<{ className?: string }>> = {
  alipay: RiAlipayFill,
  wxpay: RiWechatPayFill,
  crypto: SiTether,
  'onramp-google': RiGoogleFill,
  'onramp-apple': RiAppleFill,
  'onramp-paypal': RiPaypalFill,
}

type MethodMarkProps = {
  method: string
  className?: string
}

export function MethodMark({ method, className }: MethodMarkProps) {
  const known = knownMethod(method)
  const Mark = known === undefined ? CreditCard : marks[known]
  return (
    <Flex
      as="span"
      aria-hidden
      align="center"
      justify="center"
      className={cn('bg-subtle size-9 shrink-0 rounded-md', className)}
    >
      <Mark className="size-5" />
    </Flex>
  )
}
