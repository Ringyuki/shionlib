import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import { MessageService } from '../services/message.service'
import { GetMessagesReqDto } from '../dto/req/get-messages.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('list')
  async getList(@Query() paginationReqDto: GetMessagesReqDto, @Req() req: RequestWithUser) {
    return this.messageService.getList(paginationReqDto, req)
  }

  @Get('unread')
  async getUnreadCount(@Req() req: RequestWithUser) {
    return this.messageService.getUnreadCount(req)
  }

  @Get(':id')
  async getById(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.messageService.getById(id, req)
  }

  @Post('all/read')
  async markAllAsRead(@Req() req: RequestWithUser) {
    return this.messageService.markAllAsRead(req)
  }

  @Post('all/unread')
  async markAllAsUnread(@Req() req: RequestWithUser) {
    return this.messageService.markAllAsUnread(req)
  }

  @Post(':id/read')
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.messageService.markAsRead(id, req)
  }
}
