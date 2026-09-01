import { DeviceNotFoundException } from './device-not-found.exception';
import { InvalidPayloadException } from './invalid-payload.exception';
import { StaleHeartbeatException } from './stale-heartbeat.exception';
import { HttpStatus } from '@nestjs/common';

describe('IoT Domain Exceptions', () => {
  describe('DeviceNotFoundException', () => {
    it('initializes with correct code and 404 status', () => {
      const ex = new DeviceNotFoundException('dev_123');
      expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(ex.code).toBe('DEVICE_NOT_FOUND');
      expect(ex.message).toContain('dev_123');
      expect(ex.context).toEqual({ deviceId: 'dev_123' });
    });
  });

  describe('InvalidPayloadException', () => {
    it('initializes with correct code and 422 status', () => {
      const ex = new InvalidPayloadException('hotel/1/room/101/sensor/pir', { foo: 'bar' }, [
        { path: '/value', message: 'Missing' },
      ]);
      expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(ex.code).toBe('IOT_INVALID_PAYLOAD');
      expect(ex.message).toContain('hotel/1/room/101/sensor/pir');
      expect(ex.context).toHaveProperty('validationErrors');
    });
  });

  describe('StaleHeartbeatException', () => {
    it('initializes with correct code and 422 status', () => {
      const lastSeen = new Date();
      const ex = new StaleHeartbeatException('gw_001', lastSeen, 120);
      expect(ex.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(ex.code).toBe('IOT_STALE_HEARTBEAT');
      expect(ex.message).toContain('gw_001');
      expect(ex.context).toEqual({
        gatewayId: 'gw_001',
        lastHeartbeatAt: lastSeen,
        timeDifferenceSeconds: 120,
      });
    });
  });
});
