import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { OccupancyService } from './occupancy.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import type { OccupancyActor } from './occupancy.service';

@ApiTags('Occupancy')
@ApiBearerAuth('jwt-access')
@Controller('properties/:propertyId/rooms/:roomId/occupancy')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OccupancyController {
  constructor(private readonly occupancyService: OccupancyService) {}

  private getActor(user: AuthenticatedUser): OccupancyActor {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  // ─── GET /properties/:propertyId/rooms/:roomId/occupancy ──────────────────

  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.PROPERTY_MANAGER,
    Role.FRONT_DESK,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
    Role.SECURITY,
  )
  @ApiOperation({
    summary: 'Get current room occupancy',
    description:
      'Returns the current and maximum occupancy for a room, and whether the room is at capacity.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiResponse({
    status: 200,
    description: 'Occupancy data returned.',
    schema: {
      type: 'object',
      properties: {
        roomId: { type: 'string', format: 'uuid' },
        currentOccupancy: { type: 'number', example: 2 },
        maxOccupancy: { type: 'number', example: 4 },
        isAtCapacity: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async getRoomOccupancy(@Param('roomId') roomId: string) {
    return this.occupancyService.getRoomOccupancy(roomId);
  }

  // ─── POST /properties/:propertyId/rooms/:roomId/occupancy/reset ───────────

  @Post('reset')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.SECURITY)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Manually reset room occupancy to zero',
    description:
      'Staff can reset `currentOccupancy` to 0 when sensors have missed exit events. ' +
      'The room status is updated to the appropriate VACANT_* state. ' +
      'Action is audited.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiResponse({ status: 204, description: 'Occupancy reset successfully.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async resetRoomOccupancy(
    @Param('roomId') roomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.occupancyService.resetRoomOccupancy(roomId, this.getActor(user));
  }
}
