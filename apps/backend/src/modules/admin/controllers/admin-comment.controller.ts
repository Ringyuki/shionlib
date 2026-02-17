import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common'
import { AdminCommentService } from '../services/admin-comment.service'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { AdminCommentListReqDto } from '../dto/req/comment-list.req.dto'
import { AdminUpdateCommentStatusReqDto } from '../dto/req/comment-status.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ShionlibUserRoles.ADMIN)
@Controller('admin/comments')
export class AdminCommentController {
  constructor(private readonly adminCommentService: AdminCommentService) {}

  @Get()
  async getCommentList(@Query() query: AdminCommentListReqDto) {
    return this.adminCommentService.getCommentList(query)
  }

  @Get(':id')
  async getCommentDetail(@Param('id', ParseIntPipe) id: number) {
    return this.adminCommentService.getCommentDetail(id)
  }

  @Patch(':id/status')
  async updateCommentStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateCommentStatusReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminCommentService.updateCommentStatus(id, dto, req.user)
  }

  @Post(':id/rescan')
  async rescanComment(@Param('id', ParseIntPipe) id: number) {
    return this.adminCommentService.rescanComment(id)
  }
}
