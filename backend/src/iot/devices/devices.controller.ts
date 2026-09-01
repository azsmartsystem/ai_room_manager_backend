import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { DevicesService } from './devices.service';
import {
  CreateDeviceDto,
  CreateDeviceDtoSchema,
  UpdateDeviceDto,
  UpdateDeviceDtoSchema,
  SendCommandDto,
  SendCommandDtoSchema,
  ListDevicesQuery,
} from './dto/device.dto';
import { TypeBoxValidationPipe } from '../../common/pipes/validation.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { ScopedActor } from '../../properties/properties.service';

@ApiTags('Devices')
@ApiBearerAuth('jwt-access')
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  private getActor(user: AuthenticatedUser): ScopedActor {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    };
  }

  // ─── Provision Device ────────────────────────────────────────────────────────

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Provision an IoT device',
    description: 'Registers a physical sensor, relay, or gateway in the system registry.',
  })
  @ApiBody({
    description: 'Device provisioning payload',
    schema: {
      type: 'object',
      required: ['id', 'type', 'propertyId'],
      properties: {
        id: { type: 'string', example: 'pir_esp32_01_a9f2' },
        macAddress: { type: 'string', example: '98:CD:AC:12:34:56' },
        type: {
          type: 'string',
          enum: [
            'PIR',
            'DOOR',
            'TEMPERATURE',
            'RELAY',
            'GATEWAY',
            'SMOKE',
            'WATER_LEAK',
            'PANIC_BUTTON',
          ],
          example: 'PIR',
        },
        propertyId: { type: 'string', format: 'uuid', example: 'prop-uuid' },
        roomId: { type: 'string', format: 'uuid', example: 'room-uuid' },
        firmwareVersion: { type: 'string', example: 'v2.1.4-prod' },
        metadata: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Device registered successfully.' })
  @ApiResponse({ status: 404, description: 'Property or Room not found.' })
  async createDevice(
    @Body(new TypeBoxValidationPipe(CreateDeviceDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.createDevice(dto as CreateDeviceDto, this.getActor(user));
  }

  // ─── List Devices ────────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK, Role.MAINTENANCE, Role.SECURITY)
  @ApiOperation({
    summary: 'List devices',
    description: 'Returns devices matching optional property, room, status, and type filters.',
  })
  @ApiQuery({ name: 'propertyId', required: false, description: 'Property UUID filter' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Room UUID filter' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ONLINE', 'OFFLINE', 'DEGRADED', 'UNPROVISIONED'],
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['PIR', 'DOOR', 'TEMPERATURE', 'RELAY', 'GATEWAY', 'SMOKE', 'WATER_LEAK', 'PANIC_BUTTON'],
  })
  @ApiResponse({ status: 200, description: 'List of devices returned.' })
  async listDevices(
    @Query('propertyId') propertyId?: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.devicesService.findDevices(
      {
        propertyId,
        roomId,
        status: status as ListDevicesQuery['status'],
        type: type as ListDevicesQuery['type'],
      },
      this.getActor(user!),
    );
  }

  // ─── Get Single Device ───────────────────────────────────────────────────────

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.FRONT_DESK, Role.MAINTENANCE, Role.SECURITY)
  @ApiOperation({ summary: 'Get device details by ID' })
  @ApiParam({ name: 'id', description: 'Device ID string' })
  @ApiResponse({ status: 200, description: 'Device details returned.' })
  @ApiResponse({ status: 404, description: 'Device not found.' })
  async getDevice(@Param('id') id: string) {
    return this.devicesService.findDeviceById(id);
  }

  // ─── Update Device ───────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'Update device properties and room assignment' })
  @ApiParam({ name: 'id', description: 'Device ID string' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: [
            'PIR',
            'DOOR',
            'TEMPERATURE',
            'RELAY',
            'GATEWAY',
            'SMOKE',
            'WATER_LEAK',
            'PANIC_BUTTON',
          ],
        },
        status: { type: 'string', enum: ['ONLINE', 'OFFLINE', 'DEGRADED', 'UNPROVISIONED'] },
        roomId: { type: 'string', format: 'uuid', nullable: true },
        firmwareVersion: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Device updated successfully.' })
  @ApiResponse({ status: 404, description: 'Device or Room not found.' })
  async updateDevice(
    @Param('id') id: string,
    @Body(new TypeBoxValidationPipe(UpdateDeviceDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.updateDevice(id, dto as UpdateDeviceDto, this.getActor(user));
  }

  // ─── Delete Device ───────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'De-provision and remove a device from the registry' })
  @ApiParam({ name: 'id', description: 'Device ID string' })
  @ApiResponse({ status: 200, description: 'Device de-provisioned.' })
  @ApiResponse({ status: 404, description: 'Device not found.' })
  async deleteDevice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.deleteDevice(id, this.getActor(user));
  }

  // ─── Send Command ────────────────────────────────────────────────────────────

  @Post(':id/commands')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER, Role.MAINTENANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dispatch a control command to an edge device',
    description: 'Publishes a command payload over MQTT to the target device via its room gateway.',
  })
  @ApiParam({ name: 'id', description: 'Target Device ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', example: 'set_relay' },
        parameters: { type: 'object', example: { channel: 1, state: 'ON' } },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Command dispatched successfully.' })
  @ApiResponse({ status: 404, description: 'Device not found or not assigned to a room.' })
  async sendCommand(
    @Param('id') id: string,
    @Body(new TypeBoxValidationPipe(SendCommandDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.sendCommand(id, dto as SendCommandDto, this.getActor(user));
  }

  // ─── Liveness Check ──────────────────────────────────────────────────────────

  @Post('check-liveness')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger stale heartbeat liveness check',
    description: 'Scans all devices and transitions un-heartbeated devices to OFFLINE status.',
  })
  @ApiResponse({ status: 200, description: 'Number of devices transitioned to OFFLINE.' })
  async checkLiveness() {
    const offlineCount = await this.devicesService.checkStaleDevices();
    return { status: 'OK', offlineDevicesCount: offlineCount };
  }
}
