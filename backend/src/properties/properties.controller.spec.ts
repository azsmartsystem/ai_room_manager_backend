import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Role, RoomStatus, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let service: {
    createProperty: jest.Mock;
    findProperties: jest.Mock;
    findPropertyById: jest.Mock;
    updateProperty: jest.Mock;
    createBuilding: jest.Mock;
    findBuildings: jest.Mock;
    updateBuilding: jest.Mock;
    createFloor: jest.Mock;
    findFloors: jest.Mock;
    updateFloor: jest.Mock;
    createRoom: jest.Mock;
    findRooms: jest.Mock;
    findRoomById: jest.Mock;
    updateRoom: jest.Mock;
    updateRoomStatus: jest.Mock;
    assignDeviceToRoom: jest.Mock;
    unassignDeviceFromRoom: jest.Mock;
  };

  const mockUser: AuthenticatedUser = {
    id: 'u1',
    email: 'admin@hotel.com',
    firstName: 'Admin',
    lastName: 'User',
    role: Role.SUPER_ADMIN,
    status: UserStatus.ACTIVE,
    propertyId: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      createProperty: jest.fn(),
      findProperties: jest.fn(),
      findPropertyById: jest.fn(),
      updateProperty: jest.fn(),
      createBuilding: jest.fn(),
      findBuildings: jest.fn(),
      updateBuilding: jest.fn(),
      createFloor: jest.fn(),
      findFloors: jest.fn(),
      updateFloor: jest.fn(),
      createRoom: jest.fn(),
      findRooms: jest.fn(),
      findRoomById: jest.fn(),
      updateRoom: jest.fn(),
      updateRoomStatus: jest.fn(),
      assignDeviceToRoom: jest.fn(),
      unassignDeviceFromRoom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [{ provide: PropertiesService, useValue: service }],
    }).compile();

    controller = module.get<PropertiesController>(PropertiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Properties Endpoints', () => {
    it('should create property', async () => {
      const dto = {
        name: 'Hotel Lagos',
        code: 'PROP1',
        address: 'Main Rd',
        city: 'Lagos',
        country: 'Nigeria',
      };
      service.createProperty.mockResolvedValue({ id: 'p1', ...dto });

      const result = await controller.createProperty(dto, mockUser);
      expect(service.createProperty).toHaveBeenCalled();
      expect(result.id).toBe('p1');
    });

    it('should list properties', async () => {
      service.findProperties.mockResolvedValue([{ id: 'p1' }]);
      const result = await controller.listProperties(mockUser);
      expect(result).toHaveLength(1);
    });

    it('should get single property', async () => {
      service.findPropertyById.mockResolvedValue({ id: 'p1' });
      const result = await controller.getProperty('p1');
      expect(result.id).toBe('p1');
    });

    it('should update property', async () => {
      service.updateProperty.mockResolvedValue({ id: 'p1', name: 'New Name' });
      const result = await controller.updateProperty('p1', { name: 'New Name' }, mockUser);
      expect(result.name).toBe('New Name');
    });
  });

  describe('Buildings & Floors Endpoints', () => {
    it('should create and list buildings', async () => {
      service.createBuilding.mockResolvedValue({ id: 'b1', name: 'Wing A' });
      service.findBuildings.mockResolvedValue([{ id: 'b1' }]);

      const created = await controller.createBuilding('p1', { name: 'Wing A' }, mockUser);
      const listed = await controller.listBuildings('p1');

      expect(created.id).toBe('b1');
      expect(listed).toHaveLength(1);
    });

    it('should update building', async () => {
      service.updateBuilding.mockResolvedValue({ id: 'b1', name: 'Wing B' });
      const result = await controller.updateBuilding('b1', { name: 'Wing B' });
      expect(result.name).toBe('Wing B');
    });

    it('should create, list, and update floors', async () => {
      service.createFloor.mockResolvedValue({ id: 'f1', number: 1 });
      service.findFloors.mockResolvedValue([{ id: 'f1' }]);
      service.updateFloor.mockResolvedValue({ id: 'f1', number: 2 });

      const created = await controller.createFloor('b1', { number: 1 }, mockUser);
      const listed = await controller.listFloors('b1');
      const updated = await controller.updateFloor('f1', { number: 2 });

      expect(created.id).toBe('f1');
      expect(listed).toHaveLength(1);
      expect(updated.number).toBe(2);
    });
  });

  describe('Rooms Endpoints', () => {
    it('should create room', async () => {
      const dto = { number: '101', buildingId: 'b1', floorId: 'f1' };
      service.createRoom.mockResolvedValue({ id: 'r1', ...dto });

      const result = await controller.createRoom('p1', dto, mockUser);
      expect(result.id).toBe('r1');
    });

    it('should list and get rooms with and without status filter', async () => {
      service.findRooms.mockResolvedValue([{ id: 'r1' }]);
      service.findRoomById.mockResolvedValue({ id: 'r1' });

      const listFiltered = await controller.listRooms('p1', RoomStatus.VACANT_CLEAN);
      const listAll = await controller.listRooms('p1', undefined);
      const single = await controller.getRoom('r1');

      expect(listFiltered).toHaveLength(1);
      expect(listAll).toHaveLength(1);
      expect(single.id).toBe('r1');
    });

    it('should update room', async () => {
      service.updateRoom.mockResolvedValue({ id: 'r1', number: '102' });
      const result = await controller.updateRoom('r1', { number: '102' }, mockUser);
      expect(result.number).toBe('102');
    });

    it('should update room status', async () => {
      service.updateRoomStatus.mockResolvedValue({ id: 'r1', status: RoomStatus.OCCUPIED_CLEAN });
      const result = await controller.updateRoomStatus(
        'r1',
        { status: 'OCCUPIED_CLEAN' },
        mockUser,
      );
      expect(result.status).toBe(RoomStatus.OCCUPIED_CLEAN);
    });
  });

  describe('Device Assignment Endpoints', () => {
    it('should assign and unassign device', async () => {
      service.assignDeviceToRoom.mockResolvedValue({ id: 'dev1', roomId: 'r1' });
      service.unassignDeviceFromRoom.mockResolvedValue({ id: 'dev1', roomId: null });

      const assign = await controller.assignDevice('r1', { deviceId: 'dev1' }, mockUser);
      const unassign = await controller.unassignDevice('r1', 'dev1', mockUser);

      expect(assign.roomId).toBe('r1');
      expect(unassign.roomId).toBeNull();
    });
  });
});
