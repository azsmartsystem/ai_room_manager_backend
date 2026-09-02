import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('DevicesController', () => {
  let controller: DevicesController;
  let mockDevicesService: {
    createDevice: jest.Mock;
    findDevices: jest.Mock;
    findDeviceById: jest.Mock;
    updateDevice: jest.Mock;
    deleteDevice: jest.Mock;
    sendCommand: jest.Mock;
    checkStaleDevices: jest.Mock;
  };

  const mockUser: AuthenticatedUser = {
    id: 'user_1',
    email: 'admin@hotel.com',
    firstName: 'Admin',
    lastName: 'User',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
    propertyId: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDevicesService = {
      createDevice: jest.fn(),
      findDevices: jest.fn(),
      findDeviceById: jest.fn(),
      updateDevice: jest.fn(),
      deleteDevice: jest.fn(),
      sendCommand: jest.fn(),
      checkStaleDevices: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [{ provide: DevicesService, useValue: mockDevicesService }],
    }).compile();

    controller = module.get<DevicesController>(DevicesController);
  });

  it('createDevice calls devicesService.createDevice', async () => {
    const dto = { id: 'dev_1', type: 'PIR', propertyId: 'prop_1' };
    mockDevicesService.createDevice.mockResolvedValue({ id: 'dev_1' });

    const result = await controller.createDevice(dto, mockUser);
    expect(result).toEqual({ id: 'dev_1' });
    expect(mockDevicesService.createDevice).toHaveBeenCalledWith(dto, expect.any(Object));
  });

  it('listDevices passes query filters to devicesService.findDevices', async () => {
    mockDevicesService.findDevices.mockResolvedValue([]);

    const result = await controller.listDevices('prop_1', 'room_1', 'ONLINE', 'PIR', mockUser);
    expect(result).toEqual([]);
    expect(mockDevicesService.findDevices).toHaveBeenCalledWith(
      { propertyId: 'prop_1', roomId: 'room_1', status: 'ONLINE', type: 'PIR' },
      expect.any(Object),
    );
  });

  it('getDevice calls devicesService.findDeviceById', async () => {
    mockDevicesService.findDeviceById.mockResolvedValue({ id: 'dev_1' });
    const result = await controller.getDevice('dev_1');
    expect(result).toEqual({ id: 'dev_1' });
  });

  it('updateDevice calls devicesService.updateDevice', async () => {
    mockDevicesService.updateDevice.mockResolvedValue({ id: 'dev_1', status: 'ONLINE' });
    const result = await controller.updateDevice('dev_1', { status: 'ONLINE' }, mockUser);
    expect(result).toEqual({ id: 'dev_1', status: 'ONLINE' });
  });

  it('deleteDevice calls devicesService.deleteDevice', async () => {
    mockDevicesService.deleteDevice.mockResolvedValue({ id: 'dev_1' });
    const result = await controller.deleteDevice('dev_1', mockUser);
    expect(result).toEqual({ id: 'dev_1' });
  });

  it('sendCommand calls devicesService.sendCommand', async () => {
    mockDevicesService.sendCommand.mockResolvedValue({ commandId: 'cmd_1', status: 'DISPATCHED' });
    const result = await controller.sendCommand('dev_1', { action: 'set_relay' }, mockUser);
    expect(result).toEqual({ commandId: 'cmd_1', status: 'DISPATCHED' });
  });

  it('checkLiveness calls devicesService.checkStaleDevices', async () => {
    mockDevicesService.checkStaleDevices.mockResolvedValue(3);
    const result = await controller.checkLiveness();
    expect(result).toEqual({ status: 'OK', offlineDevicesCount: 3 });
  });
});
