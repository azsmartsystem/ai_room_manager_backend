import { TopicRegistry } from './topic.registry';

describe('TopicRegistry', () => {
  describe('Sensor Topics', () => {
    it('builds canonical sensor topic correctly', () => {
      const topic = TopicRegistry.buildSensorTopic('prop_1', 'room_101', 'pir');
      expect(topic).toBe('hotel/prop_1/room/room_101/sensor/pir');
    });

    it('parses valid sensor topic correctly', () => {
      const parsed = TopicRegistry.parseSensorTopic(
        'hotel/prop_lagos_01/room/room_204/sensor/temperature',
      );
      expect(parsed).toEqual({
        propertyId: 'prop_lagos_01',
        roomId: 'room_204',
        sensorType: 'temperature',
      });
    });

    it('returns null for invalid sensor topics', () => {
      expect(TopicRegistry.parseSensorTopic('invalid/topic')).toBeNull();
      expect(TopicRegistry.parseSensorTopic('hotel/prop1/room/101/sensor/invalid_type')).toBeNull();
      expect(TopicRegistry.parseSensorTopic('hotel/prop1/gateway/gw1/sensor/pir')).toBeNull();
    });
  });

  describe('Heartbeat Topics', () => {
    it('builds canonical heartbeat topic', () => {
      const topic = TopicRegistry.buildHeartbeatTopic('prop_1', 'gw_001');
      expect(topic).toBe('hotel/prop_1/gateway/gw_001/heartbeat');
    });

    it('parses valid heartbeat topic', () => {
      const parsed = TopicRegistry.parseHeartbeatTopic(
        'hotel/prop_lagos_01/gateway/gw_floor2_001/heartbeat',
      );
      expect(parsed).toEqual({
        propertyId: 'prop_lagos_01',
        gatewayId: 'gw_floor2_001',
      });
    });

    it('returns null for invalid heartbeat topics', () => {
      expect(TopicRegistry.parseHeartbeatTopic('hotel/prop1/room/101/heartbeat')).toBeNull();
      expect(TopicRegistry.parseHeartbeatTopic('invalid/topic')).toBeNull();
    });
  });

  describe('Error Topics', () => {
    it('builds canonical error topic', () => {
      const topic = TopicRegistry.buildErrorTopic('prop_1', 'gw_001');
      expect(topic).toBe('hotel/prop_1/gateway/gw_001/errors');
    });

    it('parses valid error topic', () => {
      const parsed = TopicRegistry.parseErrorTopic('hotel/prop_1/gateway/gw_001/errors');
      expect(parsed).toEqual({
        propertyId: 'prop_1',
        gatewayId: 'gw_001',
      });
    });

    it('returns null for invalid error topics', () => {
      expect(TopicRegistry.parseErrorTopic('hotel/prop_1/room/101/errors')).toBeNull();
    });
  });

  describe('Emergency Topics', () => {
    it('builds canonical emergency topic', () => {
      const topic = TopicRegistry.buildEmergencyTopic('prop_1', 'room_101');
      expect(topic).toBe('hotel/prop_1/room/room_101/emergency');
    });

    it('parses valid emergency topic', () => {
      const parsed = TopicRegistry.parseEmergencyTopic('hotel/prop_1/room/room_101/emergency');
      expect(parsed).toEqual({
        propertyId: 'prop_1',
        roomId: 'room_101',
      });
    });

    it('returns null for invalid emergency topics', () => {
      expect(TopicRegistry.parseEmergencyTopic('hotel/prop_1/gateway/gw1/emergency')).toBeNull();
    });
  });

  describe('Command & Ack Topics', () => {
    it('builds and parses command topic', () => {
      const topic = TopicRegistry.buildCommandTopic('prop_1', 'room_101', 'set_relay');
      expect(topic).toBe('hotel/prop_1/room/room_101/command/set_relay');

      const parsed = TopicRegistry.parseCommandTopic(topic);
      expect(parsed).toEqual({
        propertyId: 'prop_1',
        roomId: 'room_101',
        action: 'set_relay',
      });
    });

    it('builds and parses ack topic', () => {
      const topic = TopicRegistry.buildAckTopic('prop_1', 'room_101', 'set_relay');
      expect(topic).toBe('hotel/prop_1/room/room_101/ack/set_relay');

      const parsed = TopicRegistry.parseAckTopic(topic);
      expect(parsed).toEqual({
        propertyId: 'prop_1',
        roomId: 'room_101',
        action: 'set_relay',
      });
    });

    it('returns null for invalid command/ack topics', () => {
      expect(TopicRegistry.parseCommandTopic('invalid/topic')).toBeNull();
      expect(TopicRegistry.parseAckTopic('invalid/topic')).toBeNull();
    });
  });
});
