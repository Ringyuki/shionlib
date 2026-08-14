import { Controller, Patch, Body, ParseIntPipe, Param, Req, UseGuards, Post } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { DeveloperEditService } from '../services/developer-edit.service'
import {
  ApplyDeveloperScalarSyncReqDto,
  EditDeveloperReqDto,
  PreviewDeveloperScalarSyncBatchReqDto,
} from '../dto/req/edit-developer.req.dto'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { EditAuthGuard } from '../../edit/guards/edit-auth.guard'
import { PermissionEntity } from '../../edit/enums/permission-entity.enum'
import {
  developerRequiredBits,
  developerScalarSyncRequiredBits,
  DeveloperKeyToBit,
} from '../../edit/resolvers/permisson-resolver'
import { DeveloperFieldSyncService } from '../services/developer-field-sync.service'
import { MirrorModeGuard } from '../../hikarinagi/guards/mirror-mode.guard'

@UseGuards(MirrorModeGuard)
@Controller('developer')
export class DeveloperEditController {
  constructor(
    private readonly developerEditService: DeveloperEditService,
    private readonly developerFieldSyncService: DeveloperFieldSyncService,
  ) {}

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

  @UseGuards(JwtAuthGuard)
  @UseGuards(
    EditAuthGuard(PermissionEntity.DEVELOPER, developerScalarSyncRequiredBits, undefined, 'scalar'),
  )
  @Post(':id/edit/sync/preview')
  async previewFieldSyncBatch(
    @Body() dto: PreviewDeveloperScalarSyncBatchReqDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.developerFieldSyncService.previewBatch(id, dto.fields)
  }

  @UseGuards(JwtAuthGuard)
  @UseGuards(
    EditAuthGuard(PermissionEntity.DEVELOPER, developerScalarSyncRequiredBits, undefined, 'scalar'),
  )
  @Post(':id/edit/scalar/sync/apply')
  async applyScalarSync(
    @Body() dto: ApplyDeveloperScalarSyncReqDto,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.developerFieldSyncService.apply(id, dto.field, dto.candidateIds, req, dto.note)
  }
}
