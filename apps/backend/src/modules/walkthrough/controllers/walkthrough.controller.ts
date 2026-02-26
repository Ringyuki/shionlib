import {
  Controller,
  Post,
  Req,
  UseGuards,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  Get,
  Query,
} from '@nestjs/common'
import { WalkthroughService } from '../services/walkthrough.service'
import { CreateWalkthroughReqDto } from '../dto/req/create-walkthrough.req.dto'
import { Body } from '@nestjs/common'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { UpdateWalkthroughReqDto } from '../dto/req/update-walkthrough.req.dto'
import { Public } from '../../auth/decorators/public.decorator'
import { GetWalkthroughListReqDto } from '../dto/req/get-walkthrough-list.req.dto'

@UseGuards(JwtAuthGuard)
@Controller('walkthrough')
export class WalkthroughController {
  constructor(private readonly walkthroughService: WalkthroughService) {}

  @Post()
  async create(@Body() dto: CreateWalkthroughReqDto, @Req() req: RequestWithUser) {
    return this.walkthroughService.create(dto, req)
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWalkthroughReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.walkthroughService.update(id, dto, req)
  }

  @Public()
  @Get(':id')
  async getById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Query('withContent') withContent?: string,
  ) {
    return this.walkthroughService.getById(id, withContent === 'true', req)
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.walkthroughService.delete(id, req)
  }

  @Public()
  @Get('game/:id')
  async getListByGameId(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationReqDto: GetWalkthroughListReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.walkthroughService.getListByGameId(id, paginationReqDto, req)
  }
}
