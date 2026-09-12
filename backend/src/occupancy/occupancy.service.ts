import { Injectable, Logger } from '@nestjs/common';
import { RoomStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RoomNotFoundException } from '../common/exceptions/operations/room-not-found.exception';
import type { SensorEvent } from '../iot/events/sensor-event';

// ─── Actor shape (mirrors ScopedActor without propertyId dependency) ──────────

export interface OccupancyActor {
  id: string;
  email: string;
  role: string;
}

// ─── Return shape ─────────────────────────────────────────────────────────────

export interface RoomOccupancyData {
  roomId: string;
  currentOccupancy: number;
  maxOccupancy: number;
  isAtCapacity: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OccupancyService {
  private readonly logger = new Logger(OccupancyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Handle Sensor Event ──────────────────────────────────────────────────

  /**
   * Primary entry point called by `OccupancyListener` for every `sensor.event`.
   * Never throws — wraps everything in try/catch so a sensor error cannot
   * crash the background EventEmitter handler.
   */
  async handleSensorEvent(event: SensorEvent): Promise<void> {
    try {
      if (event.sensorType === 'pir') {
        await this.handlePirEvent(event);
      } else if (event.sensorType === 'door') {
        await this.handleDoorEvent(event);
      }
      // temperature / relay → no occupancy concern; intentional no-op
    } catch (error: unknown) {
      this.logger.error({
        event: 'OCCUPANCY_SENSOR_HANDLER_ERROR',
        sensorType: event.sensorType,
        roomId: event.roomId,
        deviceId: event.deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ─── Get Room Occupancy ───────────────────────────────────────────────────

  /**
   * Returns current occupancy data for a room.
   * Throws `RoomNotFoundException` when the room does not exist.
   */
  async getRoomOccupancy(roomId: string): Promise<RoomOccupancyData> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, currentOccupancy: true, maxOccupancy: true },
    });

    if (!room) {
      throw new RoomNotFoundException(roomId);
    }

    return {
      roomId: room.id,
      currentOccupancy: room.currentOccupancy,
      maxOccupancy: room.maxOccupancy,
      isAtCapacity: room.currentOccupancy >= room.maxOccupancy,
    };
  }

  // ─── Reset Room Occupancy ─────────────────────────────────────────────────

  /**
   * Manually resets `currentOccupancy` to 0 and transitions the room status
   * to VACANT_CLEAN or VACANT_DIRTY depending on its current cleanliness state.
   * Throws `RoomNotFoundException` when the room does not exist.
   */
  async resetRoomOccupancy(roomId: string, actor: OccupancyActor): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, status: true, currentOccupancy: true },
    });

    if (!room) {
      throw new RoomNotFoundException(roomId);
    }

    const previousStatus = room.status;
    const newStatus = this.resolveVacantStatus(previousStatus);

    await this.prisma.room.update({
      where: { id: roomId },
      data: {
        currentOccupancy: 0,
        status: newStatus,
      },
    });

    this.logger.log({
      event: 'OCCUPANCY_RESET',
      roomId,
      previousOccupancy: room.currentOccupancy,
      previousStatus,
      newStatus,
      actorId: actor.id,
      source: 'manual_override',
    });

    await this.auditService.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'OCCUPANCY_RESET',
      resource: 'ROOM',
      resourceId: roomId,
      metadata: {
        previousOccupancy: room.currentOccupancy,
        newOccupancy: 0,
        previousStatus,
        newStatus,
      },
    });
  }

  // ─── Private: PIR handler ─────────────────────────────────────────────────

  private async handlePirEvent(event: SensorEvent): Promise<void> {
    // Type-narrow: PirSensorValue has { motionDetected: boolean }
    const pirValue = event.value as { motionDetected?: boolean };
    const motionDetected = pirValue.motionDetected;

    if (motionDetected !== true) {
      // PIR cleared — not reliable for exit detection, no-op
      return;
    }

    const room = await this.prisma.room.findUnique({
      where: { id: event.roomId },
      select: { id: true, status: true, currentOccupancy: true, maxOccupancy: true },
    });

    if (!room) {
      this.logger.warn({
        event: 'OCCUPANCY_ROOM_NOT_FOUND',
        sensorType: 'pir',
        roomId: event.roomId,
        deviceId: event.deviceId,
      });
      return;
    }

    if (room.currentOccupancy > 0) {
      // Already occupied — PIR confirms presence, no state change needed
      return;
    }

    // currentOccupancy === 0 → treat first motion as one person entering
    const newStatus = this.resolveOccupiedStatus(room.status);

    if (newStatus === null) {
      // Room is in a state where OCCUPIED transition is not valid (e.g. OUT_OF_ORDER)
      this.logger.warn({
        event: 'OCCUPANCY_INVALID_TRANSITION_SKIPPED',
        sensorType: 'pir',
        roomId: event.roomId,
        currentStatus: room.status,
      });
      return;
    }

    await this.prisma.room.update({
      where: { id: event.roomId },
      data: {
        currentOccupancy: 1,
        status: newStatus,
      },
    });

    this.logger.log({
      event: 'OCCUPANCY_CHANGED',
      sensorType: 'pir',
      roomId: event.roomId,
      deviceId: event.deviceId,
      previousOccupancy: 0,
      newOccupancy: 1,
      previousStatus: room.status,
      newStatus,
      source: 'sensor_event',
    });

    if (room.currentOccupancy >= room.maxOccupancy) {
      this.logger.warn({
        event: 'OCCUPANCY_LIMIT_BREACH',
        roomId: event.roomId,
        currentOccupancy: room.currentOccupancy,
        maxOccupancy: room.maxOccupancy,
      });
    }
  }

  // ─── Private: Door handler ────────────────────────────────────────────────

  private async handleDoorEvent(event: SensorEvent): Promise<void> {
    // Type-narrow: DoorSensorValue has { state: 'OPEN' | 'CLOSED' }
    const doorValue = event.value as { state?: string };
    const doorState = doorValue.state;

    if (doorState !== 'OPEN' && doorState !== 'CLOSED') {
      return; // Unexpected payload shape — skip silently
    }

    const isOpen = doorState === 'OPEN';

    const room = await this.prisma.room.findUnique({
      where: { id: event.roomId },
      select: { id: true, status: true, currentOccupancy: true, maxOccupancy: true },
    });

    if (!room) {
      this.logger.warn({
        event: 'OCCUPANCY_ROOM_NOT_FOUND',
        sensorType: 'door',
        roomId: event.roomId,
        deviceId: event.deviceId,
      });
      return;
    }

    const previousOccupancy = room.currentOccupancy;
    let newOccupancy: number;
    let newStatus: RoomStatus = room.status;

    if (isOpen) {
      // Door opened → someone entering
      newOccupancy = Math.min(previousOccupancy + 1, room.maxOccupancy);

      if (previousOccupancy === 0) {
        // Room transitioning from vacant → occupied
        const resolved = this.resolveOccupiedStatus(room.status);
        if (resolved !== null) {
          newStatus = resolved;
        }
      }

      if (newOccupancy >= room.maxOccupancy) {
        this.logger.warn({
          event: 'OCCUPANCY_LIMIT_BREACH',
          roomId: event.roomId,
          currentOccupancy: newOccupancy,
          maxOccupancy: room.maxOccupancy,
        });
      }
    } else {
      // Door closed → someone exiting
      newOccupancy = Math.max(previousOccupancy - 1, 0);

      if (newOccupancy === 0) {
        newStatus = this.resolveVacantStatus(room.status);
      }
    }

    if (newOccupancy === previousOccupancy && newStatus === room.status) {
      return; // No effective change (e.g. already at cap or already at 0)
    }

    await this.prisma.room.update({
      where: { id: event.roomId },
      data: {
        currentOccupancy: newOccupancy,
        status: newStatus,
      },
    });

    this.logger.log({
      event: 'OCCUPANCY_CHANGED',
      sensorType: 'door',
      roomId: event.roomId,
      deviceId: event.deviceId,
      doorState,
      previousOccupancy,
      newOccupancy,
      previousStatus: room.status,
      newStatus,
      source: 'sensor_event',
    });
  }

  // ─── Private: Status helpers ──────────────────────────────────────────────

  /**
   * Maps a VACANT_* status to its OCCUPIED_* counterpart.
   * Returns `null` if the current status does not support an OCCUPIED transition.
   */
  private resolveOccupiedStatus(current: RoomStatus): RoomStatus | null {
    if (current === RoomStatus.VACANT_CLEAN) {
      return RoomStatus.OCCUPIED_CLEAN;
    }
    if (current === RoomStatus.VACANT_DIRTY) {
      return RoomStatus.OCCUPIED_DIRTY;
    }
    // OCCUPIED_* → already occupied; MAINTENANCE_REQUIRED / OUT_OF_ORDER → not safe to flip
    if (current === RoomStatus.OCCUPIED_CLEAN || current === RoomStatus.OCCUPIED_DIRTY) {
      return current; // already occupied, no status change
    }
    return null;
  }

  /**
   * Maps an OCCUPIED_* status to its VACANT_* counterpart, preserving the
   * cleanliness suffix. Non-occupied statuses are returned unchanged.
   */
  private resolveVacantStatus(current: RoomStatus): RoomStatus {
    if (current === RoomStatus.OCCUPIED_CLEAN) {
      return RoomStatus.VACANT_DIRTY; // room was occupied — needs cleaning
    }
    if (current === RoomStatus.OCCUPIED_DIRTY) {
      return RoomStatus.VACANT_DIRTY;
    }
    // Already VACANT_* or other statuses — keep as-is (or return VACANT_CLEAN for reset)
    if (current === RoomStatus.VACANT_CLEAN || current === RoomStatus.VACANT_DIRTY) {
      return current;
    }
    // Fallback for MAINTENANCE_REQUIRED / OUT_OF_ORDER — stay in place
    return current;
  }
}
