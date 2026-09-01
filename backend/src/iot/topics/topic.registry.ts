export type SensorType = 'pir' | 'door' | 'temperature' | 'relay';

export interface ParsedSensorTopic {
  propertyId: string;
  roomId: string;
  sensorType: SensorType;
}

export interface ParsedHeartbeatTopic {
  propertyId: string;
  gatewayId: string;
}

export interface ParsedErrorTopic {
  propertyId: string;
  gatewayId: string;
}

export interface ParsedEmergencyTopic {
  propertyId: string;
  roomId: string;
}

export interface ParsedCommandTopic {
  propertyId: string;
  roomId: string;
  action: string;
}

export interface ParsedAckTopic {
  propertyId: string;
  roomId: string;
  action: string;
}

export class TopicRegistry {
  // ─── Subscription Patterns (Wildcards) ──────────────────────────────────────
  static readonly SENSOR_TELEMETRY_PATTERN = 'hotel/+/room/+/sensor/#';
  static readonly GATEWAY_HEARTBEAT_PATTERN = 'hotel/+/gateway/+/heartbeat';
  static readonly GATEWAY_ERRORS_PATTERN = 'hotel/+/gateway/+/errors';
  static readonly EMERGENCY_ALERT_PATTERN = 'hotel/+/room/+/emergency';
  static readonly COMMAND_ACK_PATTERN = 'hotel/+/room/+/ack/+';

  // ─── Builders ───────────────────────────────────────────────────────────────

  static buildSensorTopic(propertyId: string, roomId: string, sensorType: SensorType): string {
    return `hotel/${propertyId}/room/${roomId}/sensor/${sensorType}`;
  }

  static buildHeartbeatTopic(propertyId: string, gatewayId: string): string {
    return `hotel/${propertyId}/gateway/${gatewayId}/heartbeat`;
  }

  static buildErrorTopic(propertyId: string, gatewayId: string): string {
    return `hotel/${propertyId}/gateway/${gatewayId}/errors`;
  }

  static buildEmergencyTopic(propertyId: string, roomId: string): string {
    return `hotel/${propertyId}/room/${roomId}/emergency`;
  }

  static buildCommandTopic(propertyId: string, roomId: string, action: string): string {
    return `hotel/${propertyId}/room/${roomId}/command/${action}`;
  }

  static buildAckTopic(propertyId: string, roomId: string, action: string): string {
    return `hotel/${propertyId}/room/${roomId}/ack/${action}`;
  }

  // ─── Parsers ────────────────────────────────────────────────────────────────

  static parseSensorTopic(topic: string): ParsedSensorTopic | null {
    const parts = topic.split('/');
    if (
      parts.length === 6 &&
      parts[0] === 'hotel' &&
      parts[2] === 'room' &&
      parts[4] === 'sensor'
    ) {
      const sensorType = parts[5] as SensorType;
      if (['pir', 'door', 'temperature', 'relay'].includes(sensorType)) {
        return {
          propertyId: parts[1]!,
          roomId: parts[3]!,
          sensorType,
        };
      }
    }
    return null;
  }

  static parseHeartbeatTopic(topic: string): ParsedHeartbeatTopic | null {
    const parts = topic.split('/');
    if (
      parts.length === 5 &&
      parts[0] === 'hotel' &&
      parts[2] === 'gateway' &&
      parts[4] === 'heartbeat'
    ) {
      return {
        propertyId: parts[1]!,
        gatewayId: parts[3]!,
      };
    }
    return null;
  }

  static parseErrorTopic(topic: string): ParsedErrorTopic | null {
    const parts = topic.split('/');
    if (
      parts.length === 5 &&
      parts[0] === 'hotel' &&
      parts[2] === 'gateway' &&
      parts[4] === 'errors'
    ) {
      return {
        propertyId: parts[1]!,
        gatewayId: parts[3]!,
      };
    }
    return null;
  }

  static parseEmergencyTopic(topic: string): ParsedEmergencyTopic | null {
    const parts = topic.split('/');
    if (
      parts.length === 5 &&
      parts[0] === 'hotel' &&
      parts[2] === 'room' &&
      parts[4] === 'emergency'
    ) {
      return {
        propertyId: parts[1]!,
        roomId: parts[3]!,
      };
    }
    return null;
  }

  static parseCommandTopic(topic: string): ParsedCommandTopic | null {
    const parts = topic.split('/');
    if (
      parts.length === 6 &&
      parts[0] === 'hotel' &&
      parts[2] === 'room' &&
      parts[4] === 'command'
    ) {
      return {
        propertyId: parts[1]!,
        roomId: parts[3]!,
        action: parts[5]!,
      };
    }
    return null;
  }

  static parseAckTopic(topic: string): ParsedAckTopic | null {
    const parts = topic.split('/');
    if (parts.length === 6 && parts[0] === 'hotel' && parts[2] === 'room' && parts[4] === 'ack') {
      return {
        propertyId: parts[1]!,
        roomId: parts[3]!,
        action: parts[5]!,
      };
    }
    return null;
  }
}
