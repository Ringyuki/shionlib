import { Inject, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { ShionConfigService } from '../../../common/config/services/config.service'
import { ShionBizException } from '../../../common/exceptions/shion-business.exception'
import { ShionBizCode } from '../../../shared/enums/biz-code/shion-biz-code.enum'
import { PAYMENT_PROVIDER, PaymentProvider } from '../interfaces/payment-provider.interface'
import { CreateSponsorOrderReqDto } from '../dto/req/create-sponsor-order.req.dto'
import { PaySponsorOrderReqDto } from '../dto/req/pay-sponsor-order.req.dto'
import { CreateSponsorOrderResDto } from '../dto/res/create-sponsor-order.res.dto'
import { PaySponsorOrderResDto } from '../dto/res/pay-sponsor-order.res.dto'
import { SponsorOrderInfoResDto } from '../dto/res/sponsor-order-info.res.dto'
import { PaginatedResult } from '../../../shared/interfaces/response/response.interface'
import { GetSponsorOrderListReqDto } from '../dto/req/get-sponsor-order-list.req.dto'
import { USER_AVATAR_SELECT, mapUserAvatar } from '../../../shared/constants/user-select.constant'

@Injectable()
export class SponsorService {
  private readonly logger = new Logger(SponsorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ShionConfigService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  private ensureEnabled(): void {
    if (!this.configService.get('sponsor.enabled')) {
      throw new ShionBizException(
        ShionBizCode.SPONSOR_MODULE_DISABLED,
        'shion-biz.SPONSOR_MODULE_DISABLED',
      )
    }
  }

  async createOrder(
    dto: CreateSponsorOrderReqDto,
    userId?: number,
  ): Promise<CreateSponsorOrderResDto> {
    this.ensureEnabled()

    const { amount, isPrivate = false, name = '', message = '' } = dto
    const providerResult = await this.paymentProvider.createOrder({
      amount: amount,
      isPrivate: isPrivate,
      name: name,
      message: message,
    })

    const orderInfo = await this.paymentProvider.getOrderInfo(providerResult.providerOrderId)

    const order = await this.prisma.sponsorOrder.create({
      data: {
        provider_order_id: providerResult.providerOrderId,
        provider: this.configService.get('sponsor.provider'),
        amount: amount,
        sponsor_name: name || null,
        sponsor_message: message || null,
        is_private: isPrivate,
        user_id: userId || null,
        expires_at: orderInfo.expiresAt
          ? new Date(orderInfo.expiresAt)
          : new Date(Date.now() + 60 * 60 * 1000), // 1 hour if no expires_at
      },
    })

    return {
      orderId: order.id,
      providerOrderId: providerResult.providerOrderId,
      paymentMethods: orderInfo.paymentMethods,
      expiresAt: orderInfo.expiresAt,
    }
  }

  async payOrder(orderId: number, dto: PaySponsorOrderReqDto): Promise<PaySponsorOrderResDto> {
    this.ensureEnabled()

    const { method, redirectUrl } = dto
    const order = await this.prisma.sponsorOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      throw new ShionBizException(
        ShionBizCode.SPONSOR_ORDER_NOT_FOUND,
        'shion-biz.SPONSOR_ORDER_NOT_FOUND',
      )
    }

    if (order.status === 'DONE') {
      throw new ShionBizException(
        ShionBizCode.SPONSOR_ORDER_ALREADY_PAID,
        'shion-biz.SPONSOR_ORDER_ALREADY_PAID',
      )
    }

    if (order.status === 'EXPIRED') {
      throw new ShionBizException(
        ShionBizCode.SPONSOR_ORDER_EXPIRED,
        'shion-biz.SPONSOR_ORDER_EXPIRED',
      )
    }

    const callbackBaseUrl = this.configService.get('sponsor.callbackBaseUrl')
    const callbackUrl = `${callbackBaseUrl}/sponsor/webhook/idatariver`

    const { payUrl, payCurrency, amount } = await this.paymentProvider.payOrder({
      providerOrderId: order.provider_order_id,
      method: method,
      redirectUrl: redirectUrl,
      callbackUrl,
    })

    await this.prisma.sponsorOrder.update({
      where: { id: orderId },
      data: { payment_method: method },
    })

    return {
      payUrl: payUrl,
      payCurrency: payCurrency,
      amount: amount,
    }
  }

  async getOrderStatus(orderId: number): Promise<SponsorOrderInfoResDto> {
    const order = await this.prisma.sponsorOrder.findUnique({
      where: { id: orderId },
      include: { user: { select: USER_AVATAR_SELECT } },
    })
    if (!order) {
      throw new ShionBizException(
        ShionBizCode.SPONSOR_ORDER_NOT_FOUND,
        'shion-biz.SPONSOR_ORDER_NOT_FOUND',
      )
    }

    // If still NEW, check with provider for latest status
    if (order.status === 'NEW') {
      try {
        const providerInfo = await this.paymentProvider.getOrderInfo(order.provider_order_id)
        if (providerInfo.status !== 'NEW') {
          const updateData: Record<string, unknown> = { status: providerInfo.status }
          if (providerInfo.status === 'DONE') {
            updateData.paid_at = new Date()
          }
          await this.prisma.sponsorOrder.update({
            where: { id: orderId },
            data: updateData,
          })
          order.status = providerInfo.status
          if (providerInfo.status === 'DONE') {
            order.paid_at = new Date()
          }
        }
      } catch {
        // If provider check fails, return local status
      }
    }

    return {
      id: order.id,
      providerOrderId: order.provider_order_id,
      amount: Number(order.amount),
      status: order.status,
      sponsorName: order.sponsor_name,
      user: order.user ? mapUserAvatar(order.user) : null,
      message: order.sponsor_message,
      isPrivate: order.is_private,
      paymentMethod: order.payment_method,
      paidAt: order.paid_at,
      created: order.created,
    }
  }

  async handlePaymentCallback(providerOrderId: string): Promise<void> {
    const order = await this.prisma.sponsorOrder.findUnique({
      where: { provider_order_id: providerOrderId },
    })

    if (!order) {
      this.logger.warn(`Webhook received for unknown order: ${providerOrderId}`)
      return
    }
    if (order.status === 'DONE') {
      this.logger.log(`Order ${providerOrderId} already DONE, skipping`)
      return
    }

    // Re-verify with provider (iDataRiver requirement)
    const verified = await this.paymentProvider.verifyAndGetOrder(providerOrderId)

    if (verified.status === 'DONE') {
      await this.prisma.sponsorOrder.update({
        where: { id: order.id },
        data: {
          status: 'DONE',
          paid_at: new Date(),
          callback_verified: true,
        },
      })

      // Extend sponsor badge duration for logged-in users
      if (order.user_id) {
        await this.extendSponsorExpiry(order.user_id, Number(order.amount))
      }

      this.logger.log(`Order ${providerOrderId} confirmed as DONE`)
    } else if (verified.status === 'REFUND') {
      await this.prisma.sponsorOrder.update({
        where: { id: order.id },
        data: {
          status: 'REFUND',
          callback_verified: true,
        },
      })
      this.logger.log(`Order ${providerOrderId} refunded`)
    }
  }

  private async extendSponsorExpiry(userId: number, amount: number): Promise<void> {
    const DAYS_PER_DOLLAR = 6
    const daysToAdd = Math.floor(amount * DAYS_PER_DOLLAR)
    if (daysToAdd <= 0) return

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { sponsor_expires_at: true },
    })
    if (!user) return

    const now = new Date()
    const baseDate =
      user.sponsor_expires_at && user.sponsor_expires_at > now ? user.sponsor_expires_at : now
    const newExpiry = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)

    await this.prisma.user.update({
      where: { id: userId },
      data: { sponsor_expires_at: newExpiry },
    })

    this.logger.log(
      `Extended sponsor expiry for user ${userId}: +${daysToAdd} days → ${newExpiry.toISOString()}`,
    )
  }

  async getOrderList(
    dto: GetSponsorOrderListReqDto,
  ): Promise<PaginatedResult<SponsorOrderInfoResDto>> {
    const { page, pageSize, status } = dto
    const where = status ? { status } : {}

    const [items, totalItems] = await Promise.all([
      this.prisma.sponsorOrder.findMany({
        where,
        orderBy: { created: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: USER_AVATAR_SELECT } },
      }),
      this.prisma.sponsorOrder.count({ where }),
    ])

    return {
      items: items.map(order => ({
        id: order.id,
        providerOrderId: order.provider_order_id,
        amount: Number(order.amount),
        status: order.status,
        sponsorName: order.sponsor_name,
        user: order.user ? mapUserAvatar(order.user) : null,
        message: order.sponsor_message,
        isPrivate: order.is_private,
        paymentMethod: order.payment_method,
        paidAt: order.paid_at,
        created: order.created,
      })),
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
        currentPage: page,
      },
    }
  }

  async adminUpdateOrderStatus(
    orderId: number,
    status: 'NEW' | 'DONE' | 'EXPIRED' | 'REFUND',
  ): Promise<void> {
    const order = await this.prisma.sponsorOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      throw new ShionBizException(
        ShionBizCode.SPONSOR_ORDER_NOT_FOUND,
        'shion-biz.SPONSOR_ORDER_NOT_FOUND',
      )
    }

    const data: Record<string, unknown> = { status }
    if (status === 'DONE' && !order.paid_at) {
      data.paid_at = new Date()
    }

    await this.prisma.sponsorOrder.update({ where: { id: orderId }, data })

    // If marking as DONE and user is linked, extend sponsor expiry
    if (status === 'DONE' && order.user_id && order.status !== 'DONE') {
      await this.extendSponsorExpiry(order.user_id, Number(order.amount))
    }
  }

  async adminDeleteOrder(orderId: number): Promise<void> {
    const order = await this.prisma.sponsorOrder.findUnique({ where: { id: orderId } })
    if (!order) {
      throw new ShionBizException(
        ShionBizCode.SPONSOR_ORDER_NOT_FOUND,
        'shion-biz.SPONSOR_ORDER_NOT_FOUND',
      )
    }
    await this.prisma.sponsorOrder.delete({ where: { id: orderId } })
  }

  async getPublicStats(): Promise<{ totalSponsors: number; totalAmount: number }> {
    const result = await this.prisma.sponsorOrder.aggregate({
      where: { status: 'DONE' },
      _count: { id: true },
      _sum: { amount: true },
    })

    return {
      totalSponsors: result._count.id,
      totalAmount: Number(result._sum.amount ?? 0),
    }
  }
}
