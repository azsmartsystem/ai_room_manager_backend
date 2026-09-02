import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CommandPublisher } from '../publishers/command.publisher';
import { DeviceNotFoundException } from '../../common/exceptions/iot/device-not-found.exception';
import { PropertyNotFoundException } from '../../common/exceptions/operations/property-not-found.exception';
import { RoomNotFoundException } from '../../common/exceptions/operations/room-not-found.exception';
import { DeviceStatus, DeviceType, Role } from '@prisma/client';
import { ScopedActor } from '../../properties/properties.service';

const mockActor: ScopedActor = {
  id: 'user_1',
  email: 'admin@example.com',
  role: Role.SUPER_ADMIN,
  propertyId: null,
};

const mockPropertyManager: ScopedActor = {
  id: 'user_2',
  email: 'manager@example.com',
  role: Role.PROPERTY_MANAGER,
  propertyId: 'prop_1',
};

describe('DevicesService', () => {
  let service: DevicesService;
  let mockPrisma: {
    device: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    property: {
      findUnique: jest.Mock;
    };
    room: {
      findUnique: jest.Mock;
    };
  };
  let mockAuditService: { log: jest.Mock };
  let mockCommandPublisher: { publishCommand: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      device: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      property: {
        findUnique: jest.fn(),
      },
      room: {
        findUnique: jest.fn(),
      },
    };

    mockAuditService = { log: jest.fn() };
    mockCommandPublisher = { publishCommand: jest.fn().mockResolvedValue('cmd_123') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CommandPublisher, useValue: mockCommandPublisher },
      ],
    }).compile();

    service = module.get<DevicesService>(DevicesService);
  });

  describe('createDevice', () => {
    it('creates a new device in UNPROVISIONED status', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 'prop_1' });
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room_1', propertyId: 'prop_1' });
      mockPrisma.device.create.mockResolvedValue({
        id: 'dev_1',
        type: DeviceType.PIR,
        status: DeviceStatus.UNPROVISIONED,
        propertyId: 'prop_1',
        roomId: 'room_1',
      });

      const result = await service.createDevice(
        {
          id: 'dev_1',
          type: 'PIR',
          propertyId: 'prop_1',
          roomId: 'room_1',
        },
        mockActor,
      );

      expect(result.id).toBe('dev_1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEVICE_PROVISIONED' }),
      );
    });

    it('throws PropertyNotFoundException if property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(
        service.createDevice({ id: 'dev_1', type: 'PIR', propertyId: 'bad_prop' }, mockActor),
      ).rejects.toThrow(PropertyNotFoundException);
    });

    it('throws RoomNotFoundException if room belongs to a different property', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({ id: 'prop_1' });
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room_1', propertyId: 'different_prop' });

      await expect(
        service.createDevice(
          { id: 'dev_1', type: 'PIR', propertyId: 'prop_1', roomId: 'room_1' },
          mockActor,
        ),
      ).rejects.toThrow(RoomNotFoundException);
    });
  });

  describe('findDevices & findDeviceById', () => {
    it('scopes findDevices query to property for non-SUPER_ADMIN', async () => {
      mockPrisma.device.findMany.mockResolvedValue([]);

      await service.findDevices({}, mockPropertyManager);

      expect(mockPrisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ propertyId: 'prop_1' }),
        }),
      );
    });

    it('allows SUPER_ADMIN to filter across all properties', async () => {
      mockPrisma.device.findMany.mockResolvedValue([]);

      await service.findDevices({ status: 'ONLINE', type: 'PIR' }, mockActor);

      expect(mockPrisma.device.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: DeviceStatus.ONLINE, type: DeviceType.PIR }),
        }),
      );
    });

    it('findDeviceById returns device when found', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({ id: 'dev_1' });
      const device = await service.findDeviceById('dev_1');
      expect(device.id).toBe('dev_1');
    });

    it('findDeviceById throws DeviceNotFoundException when missing', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      await expect(service.findDeviceById('bad_id')).rejects.toThrow(DeviceNotFoundException);
    });
  });

  describe('updateDevice & deleteDevice', () => {
    it('updates device details and validates room if changed', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({ id: 'dev_1' });
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room_2' });
      mockPrisma.device.update.mockResolvedValue({ id: 'dev_1', roomId: 'room_2' });

      const updated = await service.updateDevice(
        'dev_1',
        {
          type: 'RELAY',
          status: 'ONLINE',
          roomId: 'room_2',
          firmwareVersion: 'v2.0.0',
          metadata: { note: 'test' },
        },
        mockActor,
      );
      expect(updated.roomId).toBe('room_2');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEVICE_UPDATED' }),
      );
    });

    it('throws RoomNotFoundException if updated room does not exist', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({ id: 'dev_1' });
      mockPrisma.room.findUnique.mockResolvedValue(null);

      await expect(
        service.updateDevice('dev_1', { roomId: 'bad_room' }, mockActor),
      ).rejects.toThrow(RoomNotFoundException);
    });

    it('deletes device and writes audit log', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({ id: 'dev_1' });
      mockPrisma.device.delete.mockResolvedValue({ id: 'dev_1' });

      const deleted = await service.deleteDevice('dev_1', mockActor);
      expect(deleted.id).toBe('dev_1');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEVICE_DEPROVISIONED' }),
      );
    });
  });

  describe('handleDeviceHeartbeat & handleDeviceError', () => {
    it('auto-provisions gateway when heartbeat arrives for new gateway', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      mockPrisma.device.create.mockResolvedValue({
        id: 'gw_new',
        status: DeviceStatus.ONLINE,
      });

      const event = {
        propertyId: 'prop_1',
        gatewayId: 'gw_new',
        uptimeSeconds: 100,
        timestamp: new Date(),
        rawPayload: {},
      };

      const result = await service.handleDeviceHeartbeat(event);
      expect(result?.status).toBe(DeviceStatus.ONLINE);
      expect(mockPrisma.device.create).toHaveBeenCalled();
    });

    it('updates existing gateway heartbeat and online status', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({
        id: 'gw_01',
        status: DeviceStatus.OFFLINE,
      });
      mockPrisma.device.update.mockResolvedValue({
        id: 'gw_01',
        status: DeviceStatus.ONLINE,
      });

      const event = {
        propertyId: 'prop_1',
        gatewayId: 'gw_01',
        firmwareVersion: 'v2.2.0',
        uptimeSeconds: 500,
        timestamp: new Date(),
        rawPayload: {},
      };

      const result = await service.handleDeviceHeartbeat(event);
      expect(result?.status).toBe(DeviceStatus.ONLINE);
      expect(mockPrisma.device.update).toHaveBeenCalled();
    });

    it('returns null and logs error if database fails during heartbeat', async () => {
      mockPrisma.device.findUnique.mockRejectedValue(new Error('DB connection failure'));

      const event = {
        propertyId: 'prop_1',
        gatewayId: 'gw_01',
        uptimeSeconds: 500,
        timestamp: new Date(),
        rawPayload: {},
      };

      const result = await service.handleDeviceHeartbeat(event);
      expect(result).toBeNull();
    });

    it('marks device DEGRADED on device error event', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({
        id: 'dev_1',
        status: DeviceStatus.ONLINE,
        metadata: {},
      });

      await service.handleDeviceError({
        propertyId: 'prop_1',
        gatewayId: 'gw_1',
        deviceId: 'dev_1',
        errorCode: 'ERR_TIMEOUT',
        description: 'Sensor timeout',
        occurredAt: new Date(),
        rawPayload: {},
      });

      expect(mockPrisma.device.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DeviceStatus.DEGRADED }),
        }),
      );
    });

    it('does nothing when device is not found on device error event', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);

      await service.handleDeviceError({
        propertyId: 'prop_1',
        gatewayId: 'gw_missing',
        errorCode: 'ERR_UNKNOWN',
        description: 'Unknown error',
        occurredAt: new Date(),
        rawPayload: {},
      });

      expect(mockPrisma.device.update).not.toHaveBeenCalled();
    });
  });

  describe('checkStaleDevices (Liveness)', () => {
    it('transitions stale devices without recent heartbeats to OFFLINE', async () => {
      const staleDate = new Date(Date.now() - 120_000);
      mockPrisma.device.findMany.mockResolvedValue([
        { id: 'gw_1', propertyId: 'prop_1', lastHeartbeatAt: staleDate },
        { id: 'gw_2', propertyId: 'prop_1', lastHeartbeatAt: null },
      ]);
      mockPrisma.device.updateMany.mockResolvedValue({ count: 2 });

      const offlineCount = await service.checkStaleDevices(90_000);

      expect(offlineCount).toBe(2);
      expect(mockPrisma.device.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['gw_1', 'gw_2'] } },
        data: { status: DeviceStatus.OFFLINE },
      });
    });

    it('returns 0 when no devices are stale', async () => {
      mockPrisma.device.findMany.mockResolvedValue([]);
      const offlineCount = await service.checkStaleDevices(90_000);
      expect(offlineCount).toBe(0);
    });
  });

  describe('sendCommand', () => {
    it('dispatches command to assigned room device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({
        id: 'relay_1',
        propertyId: 'prop_1',
        roomId: 'room_101',
      });

      const res = await service.sendCommand(
        'relay_1',
        { action: 'set_relay', parameters: { state: 'ON' } },
        mockActor,
      );

      expect(res).toEqual({ commandId: 'cmd_123', status: 'DISPATCHED' });
      expect(mockCommandPublisher.publishCommand).toHaveBeenCalledWith(
        'prop_1',
        'room_101',
        'set_relay',
        'relay_1',
        { state: 'ON' },
        undefined,
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEVICE_COMMAND_ISSUED' }),
      );
    });

    it('throws RoomNotFoundException if device is not assigned to a room', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({
        id: 'unassigned_dev',
        propertyId: 'prop_1',
        roomId: null,
      });

      await expect(
        service.sendCommand('unassigned_dev', { action: 'reboot' }, mockActor),
      ).rejects.toThrow(RoomNotFoundException);
    });
  });
});
