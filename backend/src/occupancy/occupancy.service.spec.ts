import { OccupancyService } from './occupancy.service';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import { RoomStatus } from '@prisma/client';
import type { SensorEvent } from '../iot/events/sensor-event';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePirEvent(roomId: string, motionDetected: boolean): SensorEvent {
  return {
    propertyId: 'prop-1',
    roomId,
    sensorType: 'pir',
    deviceId: 'dev-pir-1',
    gatewayId: 'gw-1',
    value: { motionDetected } as unknown as SensorEvent['value'],
    occurredAt: new Date(),
    rawPayload: {},
  };
}

function makeDoorEvent(roomId: string, state: 'OPEN' | 'CLOSED'): SensorEvent {
  return {
    propertyId: 'prop-1',
    roomId,
    sensorType: 'door',
    deviceId: 'dev-door-1',
    gatewayId: 'gw-1',
    value: { state } as unknown as SensorEvent['value'],
    occurredAt: new Date(),
    rawPayload: {},
  };
}

function makeRoomRow(overrides: {
  id?: string;
  status?: RoomStatus;
  currentOccupancy?: number;
  maxOccupancy?: number;
}) {
  return {
    id: overrides.id ?? 'room-1',
    status: overrides.status ?? RoomStatus.VACANT_CLEAN,
    currentOccupancy: overrides.currentOccupancy ?? 0,
    maxOccupancy: overrides.maxOccupancy ?? 4,
  };
}

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockPrismaRoom = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrisma = {
  room: mockPrismaRoom,
} as unknown as import('../common/prisma/prisma.service').PrismaService;

const mockAudit = {
  log: jest.fn(),
} as unknown as import('../audit/audit.service').AuditService;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('OccupancyService', () => {
  let service: OccupancyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OccupancyService(mockPrisma, mockAudit);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleSensorEvent — PIR
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleSensorEvent — PIR', () => {
    it('motionDetected=true when room is VACANT_CLEAN with occupancy=0 → sets to 1, status=OCCUPIED_CLEAN', async () => {
      const room = makeRoomRow({ status: RoomStatus.VACANT_CLEAN, currentOccupancy: 0 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({
        ...room,
        currentOccupancy: 1,
        status: RoomStatus.OCCUPIED_CLEAN,
      });

      await service.handleSensorEvent(makePirEvent('room-1', true));

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 1, status: RoomStatus.OCCUPIED_CLEAN },
      });
    });

    it('motionDetected=true when room is VACANT_DIRTY with occupancy=0 → sets to 1, status=OCCUPIED_DIRTY', async () => {
      const room = makeRoomRow({ status: RoomStatus.VACANT_DIRTY, currentOccupancy: 0 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({
        ...room,
        currentOccupancy: 1,
        status: RoomStatus.OCCUPIED_DIRTY,
      });

      await service.handleSensorEvent(makePirEvent('room-1', true));

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 1, status: RoomStatus.OCCUPIED_DIRTY },
      });
    });

    it('motionDetected=true when room already has occupancy=2 → no DB update', async () => {
      const room = makeRoomRow({ status: RoomStatus.OCCUPIED_CLEAN, currentOccupancy: 2 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);

      await service.handleSensorEvent(makePirEvent('room-1', true));

      expect(mockPrismaRoom.update).not.toHaveBeenCalled();
    });

    it('motionDetected=false → no DB calls at all', async () => {
      await service.handleSensorEvent(makePirEvent('room-1', false));

      expect(mockPrismaRoom.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaRoom.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleSensorEvent — Door
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleSensorEvent — Door', () => {
    it('OPEN increments occupancy from 0 → 1, transitions VACANT_CLEAN → OCCUPIED_CLEAN', async () => {
      const room = makeRoomRow({ status: RoomStatus.VACANT_CLEAN, currentOccupancy: 0 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({
        ...room,
        currentOccupancy: 1,
        status: RoomStatus.OCCUPIED_CLEAN,
      });

      await service.handleSensorEvent(makeDoorEvent('room-1', 'OPEN'));

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 1, status: RoomStatus.OCCUPIED_CLEAN },
      });
    });

    it('OPEN increments occupancy from 1 → 2, no status change when already OCCUPIED_CLEAN', async () => {
      const room = makeRoomRow({
        status: RoomStatus.OCCUPIED_CLEAN,
        currentOccupancy: 1,
        maxOccupancy: 4,
      });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({ ...room, currentOccupancy: 2 });

      await service.handleSensorEvent(makeDoorEvent('room-1', 'OPEN'));

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 2, status: RoomStatus.OCCUPIED_CLEAN },
      });
    });

    it('OPEN does not exceed maxOccupancy (clamps at cap)', async () => {
      const room = makeRoomRow({
        status: RoomStatus.OCCUPIED_CLEAN,
        currentOccupancy: 4,
        maxOccupancy: 4,
      });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);

      await service.handleSensorEvent(makeDoorEvent('room-1', 'OPEN'));

      // newOccupancy === 4 === previousOccupancy, status unchanged → no update
      expect(mockPrismaRoom.update).not.toHaveBeenCalled();
    });

    it('CLOSED decrements occupancy 2 → 1, no status change', async () => {
      const room = makeRoomRow({ status: RoomStatus.OCCUPIED_CLEAN, currentOccupancy: 2 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({ ...room, currentOccupancy: 1 });

      await service.handleSensorEvent(makeDoorEvent('room-1', 'CLOSED'));

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 1, status: RoomStatus.OCCUPIED_CLEAN },
      });
    });

    it('CLOSED when occupancy hits 0 on OCCUPIED_CLEAN → sets VACANT_DIRTY', async () => {
      const room = makeRoomRow({ status: RoomStatus.OCCUPIED_CLEAN, currentOccupancy: 1 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({
        ...room,
        currentOccupancy: 0,
        status: RoomStatus.VACANT_DIRTY,
      });

      await service.handleSensorEvent(makeDoorEvent('room-1', 'CLOSED'));

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 0, status: RoomStatus.VACANT_DIRTY },
      });
    });

    it('CLOSED when occupancy hits 0 on OCCUPIED_DIRTY → sets VACANT_DIRTY', async () => {
      const room = makeRoomRow({ status: RoomStatus.OCCUPIED_DIRTY, currentOccupancy: 1 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({
        ...room,
        currentOccupancy: 0,
        status: RoomStatus.VACANT_DIRTY,
      });

      await service.handleSensorEvent(makeDoorEvent('room-1', 'CLOSED'));

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 0, status: RoomStatus.VACANT_DIRTY },
      });
    });

    it('CLOSED when occupancy is already 0 → does not update (min clamp)', async () => {
      const room = makeRoomRow({ status: RoomStatus.VACANT_CLEAN, currentOccupancy: 0 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);

      await service.handleSensorEvent(makeDoorEvent('room-1', 'CLOSED'));

      // newOccupancy 0 === previousOccupancy 0, and resolveVacantStatus(VACANT_CLEAN) = VACANT_CLEAN → no update
      expect(mockPrismaRoom.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleSensorEvent — unknown sensorType
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleSensorEvent — unknown sensorType', () => {
    it('temperature event → no-op, no DB calls', async () => {
      const event: SensorEvent = {
        propertyId: 'prop-1',
        roomId: 'room-1',
        sensorType: 'temperature',
        deviceId: 'dev-temp-1',
        gatewayId: 'gw-1',
        value: { temperatureCelsius: 22, humidityPercent: 55 } as unknown as SensorEvent['value'],
        occurredAt: new Date(),
        rawPayload: {},
      };

      await service.handleSensorEvent(event);

      expect(mockPrismaRoom.findUnique).not.toHaveBeenCalled();
      expect(mockPrismaRoom.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // handleSensorEvent — error safety
  // ══════════════════════════════════════════════════════════════════════════

  describe('handleSensorEvent — error handling', () => {
    it('when DB throws, logs error and does NOT rethrow', async () => {
      mockPrismaRoom.findUnique.mockRejectedValueOnce(new Error('DB connection refused'));

      // Should resolve cleanly — never rethrow
      await expect(
        service.handleSensorEvent(makePirEvent('room-1', true)),
      ).resolves.toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // getRoomOccupancy
  // ══════════════════════════════════════════════════════════════════════════

  describe('getRoomOccupancy', () => {
    it('returns occupancy data for an existing room', async () => {
      mockPrismaRoom.findUnique.mockResolvedValueOnce({
        id: 'room-1',
        currentOccupancy: 2,
        maxOccupancy: 4,
      });

      const result = await service.getRoomOccupancy('room-1');

      expect(result).toEqual({
        roomId: 'room-1',
        currentOccupancy: 2,
        maxOccupancy: 4,
        isAtCapacity: false,
      });
    });

    it('reports isAtCapacity=true when currentOccupancy >= maxOccupancy', async () => {
      mockPrismaRoom.findUnique.mockResolvedValueOnce({
        id: 'room-1',
        currentOccupancy: 4,
        maxOccupancy: 4,
      });

      const result = await service.getRoomOccupancy('room-1');

      expect(result.isAtCapacity).toBe(true);
    });

    it('throws RoomNotFoundException when room not found', async () => {
      mockPrismaRoom.findUnique.mockResolvedValueOnce(null);

      await expect(service.getRoomOccupancy('missing-room')).rejects.toThrow(RoomNotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // resetRoomOccupancy
  // ══════════════════════════════════════════════════════════════════════════

  describe('resetRoomOccupancy', () => {
    const actor = { id: 'user-1', email: 'staff@hotel.com', role: 'SECURITY' };

    it('resets occupancy to 0 and transitions OCCUPIED_CLEAN → VACANT_DIRTY', async () => {
      const room = makeRoomRow({ status: RoomStatus.OCCUPIED_CLEAN, currentOccupancy: 3 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({
        ...room,
        currentOccupancy: 0,
        status: RoomStatus.VACANT_DIRTY,
      });
      mockAudit.log = jest.fn().mockResolvedValueOnce(undefined);

      await service.resetRoomOccupancy('room-1', actor);

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 0, status: RoomStatus.VACANT_DIRTY },
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OCCUPANCY_RESET',
          resource: 'ROOM',
          resourceId: 'room-1',
          actorId: actor.id,
        }),
      );
    });

    it('resets occupancy to 0 and keeps VACANT_CLEAN when already vacant and clean', async () => {
      const room = makeRoomRow({ status: RoomStatus.VACANT_CLEAN, currentOccupancy: 0 });
      mockPrismaRoom.findUnique.mockResolvedValueOnce(room);
      mockPrismaRoom.update.mockResolvedValueOnce({
        ...room,
        currentOccupancy: 0,
        status: RoomStatus.VACANT_CLEAN,
      });
      mockAudit.log = jest.fn().mockResolvedValueOnce(undefined);

      await service.resetRoomOccupancy('room-1', actor);

      expect(mockPrismaRoom.update).toHaveBeenCalledWith({
        where: { id: 'room-1' },
        data: { currentOccupancy: 0, status: RoomStatus.VACANT_CLEAN },
      });
    });

    it('throws RoomNotFoundException when room not found', async () => {
      mockPrismaRoom.findUnique.mockResolvedValueOnce(null);

      await expect(service.resetRoomOccupancy('missing-room', actor)).rejects.toThrow(
        RoomNotFoundException,
      );
    });
  });
});
