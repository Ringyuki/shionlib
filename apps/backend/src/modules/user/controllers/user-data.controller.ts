import { Controller, Get, Param, ParseIntPipe, Query, Req } from '@nestjs/common'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { PaginationReqDto } from '../../../shared/dto/req/pagination.req.dto'
import { UserDataService } from '../services/user-data.service'

@Controller('user/datas')
export class UserDataController {
  constructor(private readonly userDataService: UserDataService) {}

  @Get(':id/game-resources')
  async getGameResources(
    @Req() req: RequestWithUser,
    @Query() dto: PaginationReqDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.userDataService.getGameResources(id, req, dto)
  }

  @Get(':id/comments')
  async getComments(
    @Req() req: RequestWithUser,
    @Query() dto: PaginationReqDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.userDataService.getComments(id, req, dto)
  }

  @Get(':id/edit-records')
  async getEditRecords(@Query() dto: PaginationReqDto, @Param('id', ParseIntPipe) id: number) {
    return await this.userDataService.getEditRecords(id, dto)
  }
}
