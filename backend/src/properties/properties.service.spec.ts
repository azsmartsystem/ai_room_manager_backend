import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesService, ScopedActor } from './properties.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role, RoomStatus } from '@prisma/client';
import { PropertyNotFoundException } from '../common/exceptions/operations/property-not-found.exception';
import { BuildingNotFoundException } from '../common/exceptions/operations/building-not-found.exception';
import { FloorNotFoundException } from '../common/exceptions/operations/floor-not-found.exception';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import { DeviceNotFoundException } from '../common/exceptions/iot/device-not-found.exception';
import { InvalidRoomStateTransitionException } from '../common/exceptions/operations/invalid-room-state-transition.exception';

describe('PropertiesService', () => {
  let service: PropertiesService;
  let prisma: {
    property: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    building: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    floor: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    room: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    device: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: {
    log: jest.Mock;
  };

  const superAdminActor: ScopedActor = {
    id: 'admin-1',
    email: 'admin@hotel.com',
    role: Role.SUPER_ADMIN,
    propertyId: null,
  };

  const managerActor: ScopedActor = {
    id: 'manager-1',
    email: 'manager@hotel.com',
    role: Role.PROPERTY_MANAGER,
    propertyId: 'prop-1',
  };

  beforeEach(async () => {
    prisma = {
      property: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      building: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      floor: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      room: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      device: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    auditService = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── PROPERTIES ─────────────────────────────────────────────────────────────

  describe('createProperty', () => {
    it('should create property and dispatch audit log', async () => {
      const mockCreated = {
        id: 'prop-1',
        name: 'Grand Hotel Lagos',
        code: 'PROP_LAGOS_01',
        address: '12 Marina Road',
        city: 'Lagos',
        country: 'Nigeria',
      };
      prisma.property.create.mockResolvedValue(mockCreated);

      const result = await service.createProperty(
        {
          name: 'Grand Hotel Lagos',
          code: 'prop_lagos_01',
          address: '12 Marina Road',
          city: 'Lagos',
          country: 'Nigeria',
        },
        superAdminActor,
      );

      expect(prisma.property.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ code: 'PROP_LAGOS_01' }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PROPERTY_CREATED', resource: 'PROPERTY' }),
      );
      expect(result).toEqual(mockCreated);
    });
  });

  describe('findProperties', () => {
    it('should return all properties for super admin', async () => {
      const mockProps = [{ id: 'p1' }, { id: 'p2' }];
      prisma.property.findMany.mockResolvedValue(mockProps);

      const result = await service.findProperties(superAdminActor);
      expect(prisma.property.findMany).toHaveBeenCalled();
      expect(result).toEqual(mockProps);
    });

    it('should return scoped property for property manager', async () => {
      const mockProp = { id: 'prop-1' };
      prisma.property.findUnique.mockResolvedValue(mockProp);

      const result = await service.findProperties(managerActor);
      expect(prisma.property.findUnique).toHaveBeenCalledWith({ where: { id: 'prop-1' } });
      expect(result).toEqual([mockProp]);
    });

    it('should return empty list when manager has no assigned property', async () => {
      const unassignedManager = { ...managerActor, propertyId: null };
      const result = await service.findProperties(unassignedManager);
      expect(result).toEqual([]);
    });

    it('should return empty list when manager property is not found', async () => {
      prisma.property.findUnique.mockResolvedValue(null);
      const result = await service.findProperties(managerActor);
      expect(result).toEqual([]);
    });
  });

  describe('findPropertyById', () => {
    it('should return property with hierarchy when found', async () => {
      const mockProp = { id: 'prop-1', buildings: [] };
      prisma.property.findUnique.mockResolvedValue(mockProp);

      const result = await service.findPropertyById('prop-1');
      expect(result).toEqual(mockProp);
    });

    it('should throw PropertyNotFoundException when not found', async () => {
      prisma.property.findUnique.mockResolvedValue(null);
      await expect(service.findPropertyById('missing')).rejects.toThrow(PropertyNotFoundException);
    });
  });

  describe('updateProperty', () => {
    it('should update property with code and dispatch audit log', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.property.update.mockResolvedValue({
        id: 'prop-1',
        name: 'Updated Name',
        code: 'NEW_CODE',
      });

      const result = await service.updateProperty(
        'prop-1',
        { name: 'Updated Name', code: 'new_code' },
        superAdminActor,
      );
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: expect.objectContaining({ code: 'NEW_CODE' }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PROPERTY_UPDATED' }),
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should update property without code', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.property.update.mockResolvedValue({ id: 'prop-1', name: 'Updated Name' });

      const result = await service.updateProperty(
        'prop-1',
        { name: 'Updated Name' },
        superAdminActor,
      );
      expect(prisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: expect.objectContaining({ code: undefined }),
      });
      expect(result.name).toBe('Updated Name');
    });
  });

  // ─── BUILDINGS ─────────────────────────────────────────────────────────────

  describe('createBuilding & findBuildings', () => {
    it('should create building within existing property', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.building.create.mockResolvedValue({
        id: 'b1',
        name: 'Main Tower',
        propertyId: 'prop-1',
      });

      const result = await service.createBuilding('prop-1', { name: 'Main Tower' }, managerActor);
      expect(prisma.building.create).toHaveBeenCalledWith({
        data: { name: 'Main Tower', propertyId: 'prop-1' },
      });
      expect(result.id).toBe('b1');
    });

    it('should list buildings of a property', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.building.findMany.mockResolvedValue([{ id: 'b1' }]);

      const result = await service.findBuildings('prop-1');
      expect(result).toHaveLength(1);
    });

    it('should update building name', async () => {
      prisma.building.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.building.update.mockResolvedValue({ id: 'b1', name: 'Tower A' });

      const result = await service.updateBuilding('b1', { name: 'Tower A' });
      expect(result.name).toBe('Tower A');
    });

    it('should throw BuildingNotFoundException when updating missing building', async () => {
      prisma.building.findUnique.mockResolvedValue(null);
      await expect(service.updateBuilding('b99', { name: 'X' })).rejects.toThrow(
        BuildingNotFoundException,
      );
    });
  });

  // ─── FLOORS ────────────────────────────────────────────────────────────────

  describe('createFloor & findFloors', () => {
    it('should create floor in building', async () => {
      prisma.building.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.floor.create.mockResolvedValue({ id: 'f1', number: 2, buildingId: 'b1' });

      const result = await service.createFloor('b1', { number: 2 }, managerActor);
      expect(result.number).toBe(2);
    });

    it('should throw BuildingNotFoundException when creating floor for missing building', async () => {
      prisma.building.findUnique.mockResolvedValue(null);
      await expect(service.createFloor('missing-b', { number: 1 }, managerActor)).rejects.toThrow(
        BuildingNotFoundException,
      );
    });

    it('should list floors in building', async () => {
      prisma.building.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.floor.findMany.mockResolvedValue([{ id: 'f1' }]);

      const result = await service.findFloors('b1');
      expect(result).toHaveLength(1);
    });

    it('should update floor details', async () => {
      prisma.floor.findUnique.mockResolvedValue({ id: 'f1' });
      prisma.floor.update.mockResolvedValue({ id: 'f1', number: 3, name: 'Executive Level' });

      const result = await service.updateFloor('f1', { number: 3, name: 'Executive Level' });
      expect(result.number).toBe(3);
    });

    it('should throw FloorNotFoundException when updating missing floor', async () => {
      prisma.floor.findUnique.mockResolvedValue(null);
      await expect(service.updateFloor('missing-f', { number: 1 })).rejects.toThrow(
        FloorNotFoundException,
      );
    });
  });

  // ─── ROOMS ─────────────────────────────────────────────────────────────────

  describe('createRoom & findRooms', () => {
    it('should create room with custom status and custom maxOccupancy', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.building.findUnique.mockResolvedValue({ id: 'b1', propertyId: 'prop-1' });
      prisma.floor.findUnique.mockResolvedValue({ id: 'f1', buildingId: 'b1' });

      const mockRoom = {
        id: 'r1',
        number: '101',
        propertyId: 'prop-1',
        buildingId: 'b1',
        floorId: 'f1',
        maxOccupancy: 4,
        status: RoomStatus.OUT_OF_ORDER,
      };
      prisma.room.create.mockResolvedValue(mockRoom);

      const result = await service.createRoom(
        'prop-1',
        { number: '101', buildingId: 'b1', floorId: 'f1', maxOccupancy: 4, status: 'OUT_OF_ORDER' },
        managerActor,
      );

      expect(prisma.room.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ maxOccupancy: 4, status: RoomStatus.OUT_OF_ORDER }),
      });
      expect(result).toEqual(mockRoom);
    });

    it('should throw BuildingNotFoundException when building does not match property', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.building.findUnique.mockResolvedValue({ id: 'b1', propertyId: 'different-prop' });

      await expect(
        service.createRoom(
          'prop-1',
          { number: '101', buildingId: 'b1', floorId: 'f1' },
          managerActor,
        ),
      ).rejects.toThrow(BuildingNotFoundException);
    });

    it('should throw FloorNotFoundException when floor does not match building', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.building.findUnique.mockResolvedValue({ id: 'b1', propertyId: 'prop-1' });
      prisma.floor.findUnique.mockResolvedValue({ id: 'f1', buildingId: 'different-building' });

      await expect(
        service.createRoom(
          'prop-1',
          { number: '101', buildingId: 'b1', floorId: 'f1' },
          managerActor,
        ),
      ).rejects.toThrow(FloorNotFoundException);
    });

    it('should list all rooms when status filter is omitted', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.room.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);

      const result = await service.findRooms('prop-1');
      expect(prisma.room.findMany).toHaveBeenCalledWith({
        where: { propertyId: 'prop-1', status: undefined },
        include: expect.any(Object),
        orderBy: { number: 'asc' },
      });
      expect(result).toHaveLength(2);
    });

    it('should list rooms with status filter', async () => {
      prisma.property.findUnique.mockResolvedValue({ id: 'prop-1' });
      prisma.room.findMany.mockResolvedValue([{ id: 'r1', status: RoomStatus.VACANT_DIRTY }]);

      const result = await service.findRooms('prop-1', RoomStatus.VACANT_DIRTY);
      expect(prisma.room.findMany).toHaveBeenCalledWith({
        where: { propertyId: 'prop-1', status: RoomStatus.VACANT_DIRTY },
        include: expect.any(Object),
        orderBy: { number: 'asc' },
      });
      expect(result).toHaveLength(1);
    });

    it('should retrieve single room by ID', async () => {
      const mockRoom = { id: 'r1', number: '101' };
      prisma.room.findUnique.mockResolvedValue(mockRoom);

      const result = await service.findRoomById('r1');
      expect(result).toEqual(mockRoom);
    });

    it('should throw RoomNotFoundException when room not found', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      await expect(service.findRoomById('r-none')).rejects.toThrow(RoomNotFoundException);
    });

    it('should update room details', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.room.update.mockResolvedValue({ id: 'r1', number: '101-A' });

      const result = await service.updateRoom('r1', { number: '101-A' }, managerActor);
      expect(result.number).toBe('101-A');
    });
  });

  describe('updateRoomStatus', () => {
    it('should validate transition and update room status', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1', status: RoomStatus.VACANT_CLEAN });
      prisma.room.update.mockResolvedValue({ id: 'r1', status: RoomStatus.OCCUPIED_CLEAN });

      const result = await service.updateRoomStatus(
        'r1',
        { status: 'OCCUPIED_CLEAN', reason: 'Guest Check-in' },
        managerActor,
      );

      expect(prisma.room.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: RoomStatus.OCCUPIED_CLEAN },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROOM_STATUS_CHANGED' }),
      );
      expect(result.status).toBe(RoomStatus.OCCUPIED_CLEAN);
    });

    it('should reject illegal room status transitions', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1', status: RoomStatus.VACANT_DIRTY });

      await expect(
        service.updateRoomStatus(
          'r1',
          { status: 'OCCUPIED_CLEAN', reason: 'Direct check-in to dirty room' },
          managerActor,
        ),
      ).rejects.toThrow(InvalidRoomStateTransitionException);
    });
  });

  // ─── DEVICE ASSIGNMENT ─────────────────────────────────────────────────────

  describe('assignDeviceToRoom & unassignDeviceFromRoom', () => {
    it('should assign device to room and auto-provision if new', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1', propertyId: 'prop-1' });
      prisma.device.findUnique.mockResolvedValue(null); // not yet provisioned
      prisma.device.create.mockResolvedValue({ id: 'gw-1', propertyId: 'prop-1' });
      prisma.device.update.mockResolvedValue({ id: 'gw-1', roomId: 'r1', propertyId: 'prop-1' });

      const result = await service.assignDeviceToRoom('r1', 'gw-1', managerActor);

      expect(prisma.device.create).toHaveBeenCalledWith({
        data: { id: 'gw-1', propertyId: 'prop-1', type: 'GATEWAY' },
      });
      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { id: 'gw-1' },
        data: { roomId: 'r1', propertyId: 'prop-1' },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEVICE_ASSIGNED_TO_ROOM' }),
      );
      expect(result.roomId).toBe('r1');
    });

    it('should assign already existing device to room', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1', propertyId: 'prop-1' });
      prisma.device.findUnique.mockResolvedValue({ id: 'gw-1', propertyId: 'prop-1' });
      prisma.device.update.mockResolvedValue({ id: 'gw-1', roomId: 'r1', propertyId: 'prop-1' });

      const result = await service.assignDeviceToRoom('r1', 'gw-1', managerActor);
      expect(prisma.device.create).not.toHaveBeenCalled();
      expect(result.roomId).toBe('r1');
    });

    it('should unassign device from room', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.device.findUnique.mockResolvedValue({ id: 'gw-1', roomId: 'r1' });
      prisma.device.update.mockResolvedValue({ id: 'gw-1', roomId: null });

      const result = await service.unassignDeviceFromRoom('r1', 'gw-1', managerActor);
      expect(prisma.device.update).toHaveBeenCalledWith({
        where: { id: 'gw-1' },
        data: { roomId: null },
      });
      expect(result.roomId).toBeNull();
    });

    it('should throw DeviceNotFoundException when unassigning missing device', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'r1' });
      prisma.device.findUnique.mockResolvedValue(null);

      await expect(
        service.unassignDeviceFromRoom('r1', 'missing-dev', managerActor),
      ).rejects.toThrow(DeviceNotFoundException);
    });
  });
});
