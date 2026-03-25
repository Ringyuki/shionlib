export interface IDataRiverResponse<T = unknown> {
  code: number
  result: T
  msg: string
}

export interface IDataRiverCreateOrderResult {
  orderId: string
}

export interface IDataRiverPayOrderResult {
  payUrl: string
  payCurrency: string | null
  amount: number | null
}

export interface IDataRiverOrderPaymentMethod {
  method: string
  name: string
  enabled: boolean
  ratioRange?: string
  fixedFeeRange?: string
  desc?: string
}

export interface IDataRiverOrderInfo {
  id: string
  status: 'NEW' | 'DONE' | 'EXPIRED' | 'REFUND'
  oriPrice: number
  price: number
  quantity: number
  skuName: string
  projectName: string
  anonymous: boolean
  contactInfo: string
  mPayments: IDataRiverOrderPaymentMethod[]
  expiredInterval: number
  createdTS: number
}
