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
import type { Brand, Method } from '../sponsor'

const marks: Record<Brand, ComponentType<{ className?: string }>> = {
  alipay: RiAlipayFill,
  wechat_pay: RiWechatPayFill,
  paypal: RiPaypalFill,
  google_pay: RiGoogleFill,
  apple_pay: RiAppleFill,
  usdt: SiTether,
}

type MethodMarkProps = {
  method: Pick<Method, 'brand'>
  className?: string
}

export function MethodMark({ method, className }: MethodMarkProps) {
  const Mark = method.brand === null ? CreditCard : marks[method.brand]
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
