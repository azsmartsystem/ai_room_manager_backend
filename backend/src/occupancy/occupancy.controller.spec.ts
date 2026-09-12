import { OccupancyController } from './occupancy.controller';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

// ─── Mock service ─────────────────────────────────────────────────────────────

const mockService = {
  getRoomOccupancy: jest.fn(),
  resetRoomOccupancy: jest.fn(),
};

const fakeUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'manager@hotel.com',
  role: Role.PROPERTY_MANAGER,
  firstName: 'Jane',
  lastName: 'Manager',
  status: 'ACTIVE' as const,
  propertyId: 'prop-1',
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('OccupancyController', () => {
  let controller: OccupancyController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OccupancyController(
      mockService as unknown as import('./occupancy.service').OccupancyService,
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getRoomOccupancy
  // ──────────────────────────────────────────────────────────────────────────

  describe('getRoomOccupancy', () => {
    it('returns occupancy data from the service', async () => {
      const expected = {
        roomId: 'room-1',
        currentOccupancy: 2,
        maxOccupancy: 4,
        isAtCapacity: false,
      };
      mockService.getRoomOccupancy.mockResolvedValueOnce(expected);

      const result = await controller.getRoomOccupancy('room-1');

      expect(mockService.getRoomOccupancy).toHaveBeenCalledWith('room-1');
      expect(result).toEqual(expected);
    });

    it('propagates RoomNotFoundException from the service', async () => {
      mockService.getRoomOccupancy.mockRejectedValueOnce(new RoomNotFoundException('room-x'));

      await expect(controller.getRoomOccupancy('room-x')).rejects.toThrow(RoomNotFoundException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // resetRoomOccupancy
  // ──────────────────────────────────────────────────────────────────────────

  describe('resetRoomOccupancy', () => {
    it('calls service with roomId and actor derived from current user', async () => {
      mockService.resetRoomOccupancy.mockResolvedValueOnce(undefined);

      await controller.resetRoomOccupancy('room-1', fakeUser);

      expect(mockService.resetRoomOccupancy).toHaveBeenCalledWith('room-1', {
        id: fakeUser.id,
        email: fakeUser.email,
        role: fakeUser.role,
      });
    });

    it('propagates RoomNotFoundException from the service', async () => {
      mockService.resetRoomOccupancy.mockRejectedValueOnce(new RoomNotFoundException('room-x'));

      await expect(controller.resetRoomOccupancy('room-x', fakeUser)).rejects.toThrow(
        RoomNotFoundException,
      );
    });
  });
});
