import {
  RiAlipayFill,
  RiWechatPayFill,
  RiGoogleFill,
  RiAppleFill,
  RiPaypalFill,
} from 'react-icons/ri'
import { SiTether } from 'react-icons/si'

export const PRESET_AMOUNTS = [5, 10, 20, 50, 100]

export const METHOD_ICONS: Record<string, React.ReactNode> = {
  alipay: <RiAlipayFill className="size-8" />,
  wxpay: <RiWechatPayFill className="size-8" />,
  crypto: <SiTether className="size-8" />,
  'onramp-google': <RiGoogleFill className="size-8" />,
  'onramp-apple': <RiAppleFill className="size-8" />,
  'onramp-paypal': <RiPaypalFill className="size-8" />,
}

export const POLL_INTERVAL = 3000
