import {
  Controller,
  Post,
  Body,
  Req,
  Param,
  ParseIntPipe,
  Get,
  Query,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common'
import { CommentServices } from '../services/comment.service'
import { CreateCommentReqDto } from '../dto/req/create-comment.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { EditCommentReqDto } from '../dto/req/edit-comment.req.dto'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'

@Controller('comment')
export class CommentController {
  constructor(private readonly commentServices: CommentServices) {}

  @UseGuards(JwtAuthGuard)
  @Post('game/:game_id')
  async createComment(
    @Body() dto: CreateCommentReqDto,
    @Param('game_id', ParseIntPipe) game_id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.commentServices.createGameComment(game_id, dto, req)
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':comment_id')
  async editComment(
    @Body() dto: EditCommentReqDto,
    @Param('comment_id', ParseIntPipe) comment_id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.commentServices.editComment(comment_id, dto, req)
  }

  @UseGuards(JwtAuthGuard)
  @Get(':comment_id/raw')
  async getRawComment(
    @Param('comment_id', ParseIntPipe) comment_id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.commentServices.getRaw(comment_id, req)
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':comment_id')
  async deleteComment(
    @Param('comment_id', ParseIntPipe) comment_id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.commentServices.deleteComment(comment_id, req)
  }

  @Get('game/:game_id')
  async getGameComments(
    @Param('game_id', ParseIntPipe) game_id: number,
    @Query() paginationReqDto: PaginationReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.commentServices.getGameComments(game_id, paginationReqDto, req)
  }

  @UseGuards(JwtAuthGuard)
  @Post(':comment_id/like')
  async likeComment(
    @Param('comment_id', ParseIntPipe) comment_id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.commentServices.likeComment(comment_id, req)
  }
}
