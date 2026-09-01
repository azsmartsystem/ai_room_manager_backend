import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CommandPublisher } from '../publishers/command.publisher';
import {
  CreateDeviceDto,
  UpdateDeviceDto,
  SendCommandDto,
  ListDevicesQuery,
} from './dto/device.dto';
import { Device, DeviceStatus, DeviceType, Role, Prisma } from '@prisma/client';
import { DeviceNotFoundException } from '../../common/exceptions/iot/device-not-found.exception';
import { PropertyNotFoundException } from '../../common/exceptions/operations/property-not-found.exception';
import { RoomNotFoundException } from '../../common/exceptions/operations/room-not-found.exception';
import type { DeviceHeartbeatEvent, DeviceErrorEvent } from '../events/sensor-event';
import { ScopedActor } from '../../properties/properties.service';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly commandPublisher: CommandPublisher,
  ) {}

  // ─── Event Handlers (Decoupled Ingestion Listeners) ─────────────────────────

  @OnEvent('device.heartbeat')
  async handleDeviceHeartbeat(event: DeviceHeartbeatEvent): Promise<Device | null> {
    try {
      const existing = await this.prisma.device.findUnique({
        where: { id: event.gatewayId },
      });

      const metadata: Record<string, unknown> = {
        ...(existing?.metadata as Record<string, unknown> | null),
        ipAddress: event.ipAddress,
        macAddress: event.macAddress,
        wifiRssi: event.wifiRssi,
        freeHeapBytes: event.freeHeapBytes,
        connectedNodesCount: event.connectedNodesCount,
        batteryBackupPercent: event.batteryBackupPercent,
        uptimeSeconds: event.uptimeSeconds,
      };

      if (!existing) {
        // Auto-register gateway device if not already provisioned
        const created = await this.prisma.device.create({
          data: {
            id: event.gatewayId,
            macAddress: event.macAddress,
            type: DeviceType.GATEWAY,
            status: DeviceStatus.ONLINE,
            propertyId: event.propertyId,
            firmwareVersion: event.firmwareVersion,
            lastHeartbeatAt: event.timestamp,
            metadata: metadata as Prisma.InputJsonValue,
          },
        });

        this.logger.log({
          event: 'GATEWAY_AUTO_PROVISIONED_FROM_HEARTBEAT',
          gatewayId: event.gatewayId,
          propertyId: event.propertyId,
        });

        return created;
      }

      const updated = await this.prisma.device.update({
        where: { id: event.gatewayId },
        data: {
          status: DeviceStatus.ONLINE,
          lastHeartbeatAt: event.timestamp,
          firmwareVersion: event.firmwareVersion ?? existing.firmwareVersion,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });

      return updated;
    } catch (error) {
      this.logger.error({
        event: 'HEARTBEAT_PROCESSING_FAILED',
        gatewayId: event.gatewayId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  @OnEvent('device.error')
  async handleDeviceError(event: DeviceErrorEvent): Promise<void> {
    this.logger.warn({
      event: 'DEVICE_FAULT_RECEIVED',
      propertyId: event.propertyId,
      gatewayId: event.gatewayId,
      deviceId: event.deviceId,
      errorCode: event.errorCode,
      description: event.description,
    });

    const targetId = event.deviceId || event.gatewayId;
    const device = await this.prisma.device.findUnique({ where: { id: targetId } });
    if (device) {
      const metadata = {
        ...(device.metadata as Record<string, unknown> | null),
        lastError: {
          errorCode: event.errorCode,
          description: event.description,
          occurredAt: event.occurredAt.toISOString(),
        },
      };

      await this.prisma.device.update({
        where: { id: targetId },
        data: {
          status: DeviceStatus.DEGRADED,
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
    }
  }

  // ─── Stale Heartbeat Detection (Liveness Logic) ─────────────────────────────

  /**
   * Scans devices marked ONLINE and transitions them to OFFLINE if no heartbeat
   * has been received within the threshold (default: 90 seconds = 3 missed 30s heartbeats).
   */
  async checkStaleDevices(staleThresholdMs = 90_000): Promise<number> {
    const cutoff = new Date(Date.now() - staleThresholdMs);

    const staleDevices = await this.prisma.device.findMany({
      where: {
        status: DeviceStatus.ONLINE,
        OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null }],
      },
    });

    if (staleDevices.length === 0) {
      return 0;
    }

    const ids = staleDevices.map((d) => d.id);
    await this.prisma.device.updateMany({
      where: { id: { in: ids } },
      data: { status: DeviceStatus.OFFLINE },
    });

    for (const d of staleDevices) {
      this.logger.warn({
        event: 'DEVICE_MARKED_OFFLINE_STALE_HEARTBEAT',
        deviceId: d.id,
        propertyId: d.propertyId,
        lastHeartbeatAt: d.lastHeartbeatAt,
      });
    }

    return staleDevices.length;
  }

  // ─── CRUD Operations ────────────────────────────────────────────────────────

  async createDevice(dto: CreateDeviceDto, actor: ScopedActor): Promise<Device> {
    const property = await this.prisma.property.findUnique({ where: { id: dto.propertyId } });
    if (!property) {
      throw new PropertyNotFoundException(dto.propertyId);
    }

    if (dto.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
      if (!room || room.propertyId !== dto.propertyId) {
        throw new RoomNotFoundException(dto.roomId);
      }
    }

    const device = await this.prisma.device.create({
      data: {
        id: dto.id,
        macAddress: dto.macAddress,
        type: dto.type as DeviceType,
        status: DeviceStatus.UNPROVISIONED,
        propertyId: dto.propertyId,
        roomId: dto.roomId,
        firmwareVersion: dto.firmwareVersion,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
      },
      include: {
        property: true,
        room: true,
      },
    });

    this.logger.log({
      event: 'DEVICE_PROVISIONED',
      deviceId: device.id,
      type: device.type,
      propertyId: device.propertyId,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DEVICE_PROVISIONED',
      resource: 'DEVICE',
      resourceId: device.id,
      metadata: { propertyId: device.propertyId, type: device.type },
    });

    return device;
  }

  async findDevices(query: ListDevicesQuery, actor: ScopedActor): Promise<Device[]> {
    const where: Prisma.DeviceWhereInput = {};

    if (actor.role !== Role.SUPER_ADMIN) {
      where.propertyId = actor.propertyId || 'none';
    } else if (query.propertyId) {
      where.propertyId = query.propertyId;
    }

    if (query.roomId) where.roomId = query.roomId;
    if (query.status) where.status = query.status as DeviceStatus;
    if (query.type) where.type = query.type as DeviceType;

    return this.prisma.device.findMany({
      where,
      include: {
        property: true,
        room: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDeviceById(id: string): Promise<Device> {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        property: true,
        room: true,
      },
    });

    if (!device) {
      throw new DeviceNotFoundException(id);
    }

    return device;
  }

  async updateDevice(id: string, dto: UpdateDeviceDto, actor: ScopedActor): Promise<Device> {
    await this.findDeviceById(id);

    if (dto.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
      if (!room) {
        throw new RoomNotFoundException(dto.roomId);
      }
    }

    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        type: dto.type ? (dto.type as DeviceType) : undefined,
        status: dto.status ? (dto.status as DeviceStatus) : undefined,
        roomId: dto.roomId !== undefined ? dto.roomId : undefined,
        firmwareVersion: dto.firmwareVersion,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
      },
      include: {
        property: true,
        room: true,
      },
    });

    this.logger.log({
      event: 'DEVICE_UPDATED',
      deviceId: id,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DEVICE_UPDATED',
      resource: 'DEVICE',
      resourceId: id,
    });

    return updated;
  }

  async deleteDevice(id: string, actor: ScopedActor): Promise<Device> {
    await this.findDeviceById(id);

    const deleted = await this.prisma.device.delete({
      where: { id },
    });

    this.logger.log({
      event: 'DEVICE_DEPROVISIONED',
      deviceId: id,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DEVICE_DEPROVISIONED',
      resource: 'DEVICE',
      resourceId: id,
    });

    return deleted;
  }

  // ─── Command Dispatch ───────────────────────────────────────────────────────

  async sendCommand(
    deviceId: string,
    dto: SendCommandDto,
    actor: ScopedActor,
  ): Promise<{ commandId: string; status: string }> {
    const device = await this.findDeviceById(deviceId);

    if (!device.roomId) {
      throw new RoomNotFoundException(`Device '${deviceId}' is not assigned to a room`);
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    const commandId = await this.commandPublisher.publishCommand(
      device.propertyId,
      device.roomId,
      dto.action,
      deviceId,
      dto.parameters || {},
      expiresAt,
    );

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DEVICE_COMMAND_ISSUED',
      resource: 'DEVICE',
      resourceId: deviceId,
      metadata: { action: dto.action, commandId, parameters: dto.parameters },
    });

    return { commandId, status: 'DISPATCHED' };
  }
}
