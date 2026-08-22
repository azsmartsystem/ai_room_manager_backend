import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PropertiesService, ScopedActor } from './properties.service';
import {
  CreatePropertyDto,
  CreatePropertyDtoSchema,
  UpdatePropertyDto,
  UpdatePropertyDtoSchema,
} from './dto/property.dto';
import {
  CreateBuildingDto,
  CreateBuildingDtoSchema,
  UpdateBuildingDto,
  UpdateBuildingDtoSchema,
} from './dto/building.dto';
import {
  CreateFloorDto,
  CreateFloorDtoSchema,
  UpdateFloorDto,
  UpdateFloorDtoSchema,
} from './dto/floor.dto';
import {
  CreateRoomDto,
  CreateRoomDtoSchema,
  UpdateRoomDto,
  UpdateRoomDtoSchema,
  UpdateRoomStatusDto,
  UpdateRoomStatusDtoSchema,
} from './dto/room.dto';
import { AssignDeviceDto, AssignDeviceDtoSchema } from './dto/assign-device.dto';
import { TypeBoxValidationPipe } from '../common/pipes/validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role, RoomStatus } from '@prisma/client';

@ApiTags('Properties')
@ApiBearerAuth('jwt-access')
@Controller('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  private getActor(user: AuthenticatedUser): ScopedActor {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    };
  }

  // ─── PROPERTIES ─────────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new property',
    description:
      'Creates a top-level property (hotel, shortlet, serviced apartment). ' +
      'Only SUPER_ADMIN can create properties. The property becomes the root of the building → floor → room hierarchy.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'code', 'address', 'city', 'country'],
      properties: {
        name: {
          type: 'string',
          minLength: 2,
          maxLength: 100,
          example: 'Grand Marina Hotel',
          description: 'Property display name',
        },
        code: {
          type: 'string',
          minLength: 2,
          maxLength: 20,
          example: 'GMH-001',
          description: 'Unique property identifier code',
        },
        address: {
          type: 'string',
          minLength: 3,
          maxLength: 255,
          example: '12 Marina Street, Lagos',
          description: 'Full street address',
        },
        city: {
          type: 'string',
          minLength: 2,
          maxLength: 100,
          example: 'Lagos',
          description: 'City',
        },
        country: {
          type: 'string',
          minLength: 2,
          maxLength: 100,
          example: 'Nigeria',
          description: 'Country',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Property created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — requires SUPER_ADMIN role' })
  @ApiResponse({ status: 422, description: 'Validation failed' })
  async createProperty(
    @Body(new TypeBoxValidationPipe(CreatePropertyDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.createProperty(dto as CreatePropertyDto, this.getActor(user));
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK)
  @ApiOperation({
    summary: 'List all accessible properties',
    description:
      'Returns properties the current user has access to. SUPER_ADMIN sees all properties. ' +
      'PROPERTY_MANAGER and FRONT_DESK see only their assigned property.',
  })
  @ApiResponse({ status: 200, description: 'List of properties' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listProperties(@CurrentUser() user: AuthenticatedUser) {
    return this.propertiesService.findProperties(this.getActor(user));
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK)
  @ApiOperation({
    summary: 'Get property by ID',
    description: 'Returns a single property with its buildings, floors, and room count summary.',
  })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  @ApiResponse({ status: 200, description: 'Property details' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async getProperty(@Param('id') id: string) {
    return this.propertiesService.findPropertyById(id);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Update a property',
    description:
      'Updates property details. Only the assigned property manager or SUPER_ADMIN can update.',
  })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2, maxLength: 100 },
        code: { type: 'string', minLength: 2, maxLength: 20 },
        address: { type: 'string', minLength: 3, maxLength: 255 },
        city: { type: 'string', minLength: 2, maxLength: 100 },
        country: { type: 'string', minLength: 2, maxLength: 100 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Property updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async updateProperty(
    @Param('id') id: string,
    @Body(new TypeBoxValidationPipe(UpdatePropertyDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.updateProperty(id, dto as UpdatePropertyDto, this.getActor(user));
  }

  // ─── BUILDINGS ─────────────────────────────────────────────────────────────

  @Post(':propertyId/buildings')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a building within a property',
    description:
      'Adds a building to the specified property. Buildings contain floors, and floors contain rooms.',
  })
  @ApiParam({ name: 'propertyId', description: 'Parent property UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          minLength: 1,
          maxLength: 100,
          example: 'Tower A',
          description: 'Building name',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Building created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Property not found' })
  async createBuilding(
    @Param('propertyId') propertyId: string,
    @Body(new TypeBoxValidationPipe(CreateBuildingDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.createBuilding(
      propertyId,
      dto as CreateBuildingDto,
      this.getActor(user),
    );
  }

  @Get(':propertyId/buildings')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK)
  @ApiOperation({
    summary: 'List buildings in a property',
    description:
      'Returns all buildings for the specified property, including floor and room counts.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiResponse({ status: 200, description: 'List of buildings' })
  async listBuildings(@Param('propertyId') propertyId: string) {
    return this.propertiesService.findBuildings(propertyId);
  }

  @Put('buildings/:id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Update a building',
    description: 'Updates the building name or other details.',
  })
  @ApiParam({ name: 'id', description: 'Building UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Building updated' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  async updateBuilding(
    @Param('id') id: string,
    @Body(new TypeBoxValidationPipe(UpdateBuildingDtoSchema)) dto: Record<string, unknown>,
  ) {
    return this.propertiesService.updateBuilding(id, dto as UpdateBuildingDto);
  }

  // ─── FLOORS ────────────────────────────────────────────────────────────────

  @Post('buildings/:buildingId/floors')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a floor in a building',
    description:
      'Adds a floor to the specified building. Floor numbers can be negative (basements) up to 200.',
  })
  @ApiParam({ name: 'buildingId', description: 'Parent building UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['number'],
      properties: {
        number: {
          type: 'integer',
          minimum: -5,
          maximum: 200,
          example: 3,
          description: 'Floor number (negative for basements)',
        },
        name: {
          type: 'string',
          maxLength: 100,
          example: 'Third Floor',
          description: 'Optional floor name',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Floor created' })
  @ApiResponse({ status: 404, description: 'Building not found' })
  async createFloor(
    @Param('buildingId') buildingId: string,
    @Body(new TypeBoxValidationPipe(CreateFloorDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.createFloor(
      buildingId,
      dto as CreateFloorDto,
      this.getActor(user),
    );
  }

  @Get('buildings/:buildingId/floors')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK)
  @ApiOperation({
    summary: 'List floors in a building',
    description: 'Returns all floors for the specified building, ordered by floor number.',
  })
  @ApiParam({ name: 'buildingId', description: 'Building UUID' })
  @ApiResponse({ status: 200, description: 'List of floors' })
  async listFloors(@Param('buildingId') buildingId: string) {
    return this.propertiesService.findFloors(buildingId);
  }

  @Put('floors/:id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Update a floor',
    description: 'Updates the floor number or name.',
  })
  @ApiParam({ name: 'id', description: 'Floor UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        number: { type: 'integer', minimum: -5, maximum: 200 },
        name: { type: 'string', maxLength: 100 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Floor updated' })
  @ApiResponse({ status: 404, description: 'Floor not found' })
  async updateFloor(
    @Param('id') id: string,
    @Body(new TypeBoxValidationPipe(UpdateFloorDtoSchema)) dto: Record<string, unknown>,
  ) {
    return this.propertiesService.updateFloor(id, dto as UpdateFloorDto);
  }

  // ─── ROOMS ─────────────────────────────────────────────────────────────────

  @Post(':propertyId/rooms')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a room in a property',
    description:
      'Adds a room to the specified property. The room must be assigned to an existing building and floor. ' +
      'Default max occupancy is 2. Initial status defaults to VACANT_CLEAN.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['number', 'buildingId', 'floorId'],
      properties: {
        number: {
          type: 'string',
          minLength: 1,
          maxLength: 20,
          example: '204A',
          description: 'Room number (unique within property)',
        },
        buildingId: {
          type: 'string',
          format: 'uuid',
          description: 'Building UUID this room belongs to',
        },
        floorId: { type: 'string', format: 'uuid', description: 'Floor UUID this room is on' },
        maxOccupancy: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          default: 2,
          description: 'Maximum guest count',
        },
        status: {
          type: 'string',
          enum: [
            'VACANT_CLEAN',
            'VACANT_DIRTY',
            'OCCUPIED_CLEAN',
            'OCCUPIED_DIRTY',
            'OUT_OF_ORDER',
            'MAINTENANCE_REQUIRED',
          ],
          description: 'Initial room status',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Room created' })
  @ApiResponse({ status: 404, description: 'Property, building, or floor not found' })
  async createRoom(
    @Param('propertyId') propertyId: string,
    @Body(new TypeBoxValidationPipe(CreateRoomDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.createRoom(propertyId, dto as CreateRoomDto, this.getActor(user));
  }

  @Get(':propertyId/rooms')
  @Roles(
    Role.SUPER_ADMIN,
    Role.PROPERTY_MANAGER,
    Role.FRONT_DESK,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
    Role.SECURITY,
  )
  @ApiOperation({
    summary: 'List rooms in a property',
    description:
      'Returns all rooms for the specified property. Filter by status using the `status` query parameter. ' +
      'All authenticated users can list rooms — this is the primary endpoint for the room status board.',
  })
  @ApiParam({ name: 'propertyId', description: 'Property UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'VACANT_CLEAN',
      'VACANT_DIRTY',
      'OCCUPIED_CLEAN',
      'OCCUPIED_DIRTY',
      'OUT_OF_ORDER',
      'MAINTENANCE_REQUIRED',
    ],
    description: 'Filter rooms by status',
  })
  @ApiResponse({ status: 200, description: 'List of rooms with current status' })
  async listRooms(@Param('propertyId') propertyId: string, @Query('status') status?: RoomStatus) {
    return this.propertiesService.findRooms(propertyId, status);
  }

  @Get('rooms/:id')
  @Roles(
    Role.SUPER_ADMIN,
    Role.PROPERTY_MANAGER,
    Role.FRONT_DESK,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
    Role.SECURITY,
  )
  @ApiOperation({
    summary: 'Get room details',
    description:
      'Returns full room details including current status, assigned devices, and recent occupancy data.',
  })
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiResponse({ status: 200, description: 'Room details' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async getRoom(@Param('id') id: string) {
    return this.propertiesService.findRoomById(id);
  }

  @Put('rooms/:id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'Update room details',
    description:
      'Updates room number, building assignment, floor assignment, or max occupancy. Does not change room status.',
  })
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        number: { type: 'string', minLength: 1, maxLength: 20 },
        buildingId: { type: 'string', format: 'uuid' },
        floorId: { type: 'string', format: 'uuid' },
        maxOccupancy: { type: 'integer', minimum: 1, maximum: 20 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Room updated' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async updateRoom(
    @Param('id') id: string,
    @Body(new TypeBoxValidationPipe(UpdateRoomDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.updateRoom(id, dto as UpdateRoomDto, this.getActor(user));
  }

  @Patch('rooms/:id/status')
  @Roles(
    Role.SUPER_ADMIN,
    Role.PROPERTY_MANAGER,
    Role.FRONT_DESK,
    Role.HOUSEKEEPING,
    Role.MAINTENANCE,
  )
  @ApiOperation({
    summary: 'Update room status',
    description:
      "Changes the room's current status (e.g., VACANT_CLEAN → OCCUPIED_CLEAN). " +
      'This is the primary endpoint for check-in/check-out and housekeeping status updates. ' +
      'An optional `reason` can be included for audit trail purposes.',
  })
  @ApiParam({ name: 'id', description: 'Room UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: [
            'VACANT_CLEAN',
            'VACANT_DIRTY',
            'OCCUPIED_CLEAN',
            'OCCUPIED_DIRTY',
            'OUT_OF_ORDER',
            'MAINTENANCE_REQUIRED',
          ],
          description: 'New room status',
        },
        reason: {
          type: 'string',
          maxLength: 255,
          example: 'Guest checked in',
          description: 'Optional reason for status change',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Room status updated' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async updateRoomStatus(
    @Param('id') id: string,
    @Body(new TypeBoxValidationPipe(UpdateRoomStatusDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.updateRoomStatus(
      id,
      dto as UpdateRoomStatusDto,
      this.getActor(user),
    );
  }

  // ─── DEVICE ASSIGNMENT ─────────────────────────────────────────────────────

  @Post('rooms/:roomId/devices')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign an IoT device to a room',
    description:
      'Links an IoT device (ESP32 gateway, PIR sensor, door sensor, etc.) to a room. ' +
      'The device must already be registered in the system. A device can only be assigned to one room at a time.',
  })
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['deviceId'],
      properties: {
        deviceId: { type: 'string', format: 'uuid', description: 'Device UUID to assign' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Device assigned to room' })
  @ApiResponse({ status: 404, description: 'Room or device not found' })
  async assignDevice(
    @Param('roomId') roomId: string,
    @Body(new TypeBoxValidationPipe(AssignDeviceDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.assignDeviceToRoom(
      roomId,
      (dto as AssignDeviceDto).deviceId,
      this.getActor(user),
    );
  }

  @Post('rooms/:roomId/devices/:deviceId/unassign')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unassign an IoT device from a room',
    description:
      'Removes the link between a device and a room. The device remains registered but is no longer associated.',
  })
  @ApiParam({ name: 'roomId', description: 'Room UUID' })
  @ApiParam({ name: 'deviceId', description: 'Device UUID to unassign' })
  @ApiResponse({ status: 200, description: 'Device unassigned from room' })
  @ApiResponse({ status: 404, description: 'Room or device not found' })
  async unassignDevice(
    @Param('roomId') roomId: string,
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.propertiesService.unassignDeviceFromRoom(roomId, deviceId, this.getActor(user));
  }
}
