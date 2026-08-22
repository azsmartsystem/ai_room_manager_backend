import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';
import { CreateBuildingDto, UpdateBuildingDto } from './dto/building.dto';
import { CreateFloorDto, UpdateFloorDto } from './dto/floor.dto';
import { CreateRoomDto, UpdateRoomDto, UpdateRoomStatusDto } from './dto/room.dto';
import { PropertyNotFoundException } from '../common/exceptions/operations/property-not-found.exception';
import { BuildingNotFoundException } from '../common/exceptions/operations/building-not-found.exception';
import { FloorNotFoundException } from '../common/exceptions/operations/floor-not-found.exception';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import { DeviceNotFoundException } from '../common/exceptions/iot/device-not-found.exception';
import { RoomStatusStateMachine } from './room-status.state-machine';
import { RoomStatus, Role, Property, Building, Floor, Room, Device, Prisma } from '@prisma/client';

export interface ScopedActor {
  id: string;
  email: string;
  role: Role;
  propertyId?: string | null;
}

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── PROPERTIES ─────────────────────────────────────────────────────────────

  async createProperty(dto: CreatePropertyDto, actor: ScopedActor): Promise<Property> {
    const property = await this.prisma.property.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        address: dto.address,
        city: dto.city,
        country: dto.country,
      },
    });

    this.logger.log({
      event: 'PROPERTY_CREATED',
      propertyId: property.id,
      code: property.code,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PROPERTY_CREATED',
      resource: 'PROPERTY',
      resourceId: property.id,
      metadata: { code: property.code, name: property.name },
    });

    return property;
  }

  async findProperties(actor: ScopedActor): Promise<Property[]> {
    if (actor.role === Role.SUPER_ADMIN) {
      return this.prisma.property.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!actor.propertyId) {
      return [];
    }

    const prop = await this.prisma.property.findUnique({
      where: { id: actor.propertyId },
    });

    return prop ? [prop] : [];
  }

  async findPropertyById(id: string): Promise<Property> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        buildings: {
          include: {
            floors: {
              include: {
                rooms: true,
              },
            },
          },
        },
      },
    });

    if (!property) {
      throw new PropertyNotFoundException(id);
    }

    return property;
  }

  async updateProperty(id: string, dto: UpdatePropertyDto, actor: ScopedActor): Promise<Property> {
    await this.findPropertyById(id);

    const updated = await this.prisma.property.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code ? dto.code.toUpperCase() : undefined,
        address: dto.address,
        city: dto.city,
        country: dto.country,
      },
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'PROPERTY_UPDATED',
      resource: 'PROPERTY',
      resourceId: id,
    });

    return updated;
  }

  // ─── BUILDINGS ─────────────────────────────────────────────────────────────

  async createBuilding(
    propertyId: string,
    dto: CreateBuildingDto,
    actor: ScopedActor,
  ): Promise<Building> {
    await this.findPropertyById(propertyId);

    const building = await this.prisma.building.create({
      data: {
        name: dto.name,
        propertyId,
      },
    });

    this.logger.log({
      event: 'BUILDING_CREATED',
      buildingId: building.id,
      propertyId,
      actorId: actor.id,
    });

    return building;
  }

  async findBuildings(propertyId: string): Promise<Building[]> {
    await this.findPropertyById(propertyId);
    return this.prisma.building.findMany({
      where: { propertyId },
      include: { floors: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateBuilding(id: string, dto: UpdateBuildingDto): Promise<Building> {
    const existing = await this.prisma.building.findUnique({ where: { id } });
    if (!existing) {
      throw new BuildingNotFoundException(id);
    }

    return this.prisma.building.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  // ─── FLOORS ────────────────────────────────────────────────────────────────

  async createFloor(buildingId: string, dto: CreateFloorDto, actor: ScopedActor): Promise<Floor> {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) {
      throw new BuildingNotFoundException(buildingId);
    }

    const floor = await this.prisma.floor.create({
      data: {
        number: dto.number,
        name: dto.name,
        buildingId,
      },
    });

    this.logger.log({
      event: 'FLOOR_CREATED',
      floorId: floor.id,
      number: floor.number,
      buildingId,
      actorId: actor.id,
    });

    return floor;
  }

  async findFloors(buildingId: string): Promise<Floor[]> {
    const building = await this.prisma.building.findUnique({ where: { id: buildingId } });
    if (!building) {
      throw new BuildingNotFoundException(buildingId);
    }

    return this.prisma.floor.findMany({
      where: { buildingId },
      include: { rooms: true },
      orderBy: { number: 'asc' },
    });
  }

  async updateFloor(id: string, dto: UpdateFloorDto): Promise<Floor> {
    const floor = await this.prisma.floor.findUnique({ where: { id } });
    if (!floor) {
      throw new FloorNotFoundException(id);
    }

    return this.prisma.floor.update({
      where: { id },
      data: {
        number: dto.number,
        name: dto.name,
      },
    });
  }

  // ─── ROOMS ─────────────────────────────────────────────────────────────────

  async createRoom(propertyId: string, dto: CreateRoomDto, actor: ScopedActor): Promise<Room> {
    await this.findPropertyById(propertyId);

    const building = await this.prisma.building.findUnique({ where: { id: dto.buildingId } });
    if (!building || building.propertyId !== propertyId) {
      throw new BuildingNotFoundException(dto.buildingId);
    }

    const floor = await this.prisma.floor.findUnique({ where: { id: dto.floorId } });
    if (!floor || floor.buildingId !== dto.buildingId) {
      throw new FloorNotFoundException(dto.floorId);
    }

    const room = await this.prisma.room.create({
      data: {
        number: dto.number,
        propertyId,
        buildingId: dto.buildingId,
        floorId: dto.floorId,
        maxOccupancy: dto.maxOccupancy ?? 2,
        status: (dto.status as RoomStatus) ?? RoomStatus.VACANT_CLEAN,
      },
    });

    this.logger.log({
      event: 'ROOM_CREATED',
      roomId: room.id,
      roomNumber: room.number,
      propertyId,
      status: room.status,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ROOM_CREATED',
      resource: 'ROOM',
      resourceId: room.id,
      metadata: { roomNumber: room.number, propertyId },
    });

    return room;
  }

  async findRooms(propertyId: string, status?: RoomStatus): Promise<Room[]> {
    await this.findPropertyById(propertyId);

    const where: Prisma.RoomWhereInput = { propertyId };
    if (status) {
      where.status = status;
    }

    return this.prisma.room.findMany({
      where,
      include: {
        devices: true,
        building: true,
        floor: true,
      },
      orderBy: { number: 'asc' },
    });
  }

  async findRoomById(id: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        devices: true,
        building: true,
        floor: true,
        tasks: { take: 5, orderBy: { createdAt: 'desc' } },
        tickets: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!room) {
      throw new RoomNotFoundException(id);
    }

    return room;
  }

  async updateRoom(id: string, dto: UpdateRoomDto, actor: ScopedActor): Promise<Room> {
    await this.findRoomById(id);

    const updated = await this.prisma.room.update({
      where: { id },
      data: {
        number: dto.number,
        buildingId: dto.buildingId,
        floorId: dto.floorId,
        maxOccupancy: dto.maxOccupancy,
      },
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ROOM_UPDATED',
      resource: 'ROOM',
      resourceId: id,
    });

    return updated;
  }

  async updateRoomStatus(id: string, dto: UpdateRoomStatusDto, actor: ScopedActor): Promise<Room> {
    const room = await this.findRoomById(id);
    const previousStatus = room.status;
    const newStatus = dto.status as RoomStatus;

    // Validate state transition through the deterministic state machine
    RoomStatusStateMachine.validateTransition(previousStatus, newStatus, dto.reason);

    const updated = await this.prisma.room.update({
      where: { id },
      data: { status: newStatus },
    });

    this.logger.log({
      event: 'ROOM_STATUS_CHANGED',
      roomId: room.id,
      previousStatus,
      newStatus,
      reason: dto.reason,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'ROOM_STATUS_CHANGED',
      resource: 'ROOM',
      resourceId: id,
      metadata: { previousStatus, newStatus, reason: dto.reason },
    });

    return updated;
  }

  // ─── DEVICE-TO-ROOM ASSIGNMENT ─────────────────────────────────────────────

  async assignDeviceToRoom(roomId: string, deviceId: string, actor: ScopedActor): Promise<Device> {
    const room = await this.findRoomById(roomId);

    let device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      // Auto-provision unprovisioned device if not yet in registry
      device = await this.prisma.device.create({
        data: {
          id: deviceId,
          propertyId: room.propertyId,
          type: 'GATEWAY',
        },
      });
    }

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        roomId: room.id,
        propertyId: room.propertyId,
      },
    });

    this.logger.log({
      event: 'DEVICE_ASSIGNED_TO_ROOM',
      deviceId,
      roomId: room.id,
      propertyId: room.propertyId,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DEVICE_ASSIGNED_TO_ROOM',
      resource: 'DEVICE',
      resourceId: deviceId,
      metadata: { roomId: room.id, propertyId: room.propertyId },
    });

    return updated;
  }

  async unassignDeviceFromRoom(
    roomId: string,
    deviceId: string,
    actor: ScopedActor,
  ): Promise<Device> {
    await this.findRoomById(roomId);

    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      throw new DeviceNotFoundException(deviceId);
    }

    const updated = await this.prisma.device.update({
      where: { id: deviceId },
      data: { roomId: null },
    });

    this.logger.log({
      event: 'DEVICE_UNASSIGNED_FROM_ROOM',
      deviceId,
      roomId,
      actorId: actor.id,
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'DEVICE_UNASSIGNED_FROM_ROOM',
      resource: 'DEVICE',
      resourceId: deviceId,
      metadata: { previousRoomId: roomId },
    });

    return updated;
  }
}
