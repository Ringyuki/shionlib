import { Controller, Patch, Body, ParseIntPipe, Param, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { DeveloperEditService } from '../services/developer-edit.service'
import { EditDeveloperReqDto } from '../dto/req/edit-developer.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { EditAuthGuard } from '../../edit/guards/edit-auth.guard'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import { developerRequiredBits, DeveloperKeyToBit } from '../../edit/resolvers/permisson-resolver'

@Controller('developer')
export class DeveloperEditController {
  constructor(private readonly developerEditService: DeveloperEditService) {}

  @UseGuards(JwtAuthGuard)
  @UseGuards(EditAuthGuard(PermissionEntity.DEVELOPER, developerRequiredBits, DeveloperKeyToBit))
  @Patch(':id/edit/scalar')
  async editDeveloperScalar(
    @Body() dto: EditDeveloperReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.developerEditService.editDeveloperScalar(id, dto, req)
  }
}
