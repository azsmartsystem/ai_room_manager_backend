# MQTT Communication & Payload Contract (Backend ↔ Firmware)

**Document Version:** 1.0.0  
**Authors:** Backend Engineering & Firmware Engineering Teams  
**Organization:** ALLINZUCOLSMART SYSTEMS LTD / ZORACOM COMMUNICATIONS LTD  
**Status:** Authoritative Shared Specification  

---

## 1. Overview & Architecture Principles

This document defines the authoritative bi-directional communication contract between the physical IoT hardware (ESP32 Gateways, Edge Sensor Nodes, Actuators, Safety Triggers) and the AI Room Manager NestJS backend.

### Core Principles

1. **Strict Decoupling:** The backend business logic (occupancy, housekeeping, emergency escalation) never directly accesses MQTT clients. Ingestion happens strictly via `iot/ingestion/`, which validates payloads against TypeBox schemas before emitting normalized `SensorEvent`s on the internal event bus.
2. **Deterministic Topic Namespace:** Topic structures are hierarchical, parameterized by property ID, room ID, device type, and directionality.
3. **Mutual TLS & Per-Device Credentials:** Every gateway connects over MQTT over TLS (`mqtts://`, port 8883) with unique client certificates or device credentials. Global shared credentials are prohibited.
4. **Guaranteed Delivery & QoS:**
   - Standard Telemetry & Heartbeats: **QoS 1**
   - Commands & Acknowledgements: **QoS 1**
   - Emergency & Life-Safety Alerts: **QoS 2** (Strictly prioritized)

---

## 2. Topic Hierarchy & Namespace Convention

Base structure:

```zsh
hotel/{property_id}/room/{room_id}/...
```

| Direction | Channel / Purpose | Topic Pattern | QoS |
| ----- | ----- | ----- | ----- |

| **Device → Backend** | Periodic Telemetry | `hotel/{property_id}/room/{room_id}/sensor/{sensor_type}` | 1 |
| **Device → Backend** | Gateway / Device Heartbeat | `hotel/{property_id}/gateway/{gateway_id}/heartbeat` | 1 |
| **Device → Backend** | Hardware Fault / Error | `hotel/{property_id}/gateway/{gateway_id}/errors` | 1 |
| **Device → Backend** | Life-Safety Emergency Alert | `hotel/{property_id}/room/{room_id}/emergency` | 2 |
| **Backend → Device** | Relay / Actuator Command | `hotel/{property_id}/room/{room_id}/command/{action}` | 1 |
| **Device → Backend** | Command Acknowledgement (ACK/NACK) | `hotel/{property_id}/room/{room_id}/ack/{action}` | 1 |

---

## 3. Payload Schemas (JSON)

All timestamps must be formatted as ISO 8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).

---

### 3.1. Sensor Telemetry Payloads

#### A. PIR Motion Sensor

- **Topic:** `hotel/{property_id}/room/{room_id}/sensor/pir`
- **Schema / Payload:**

```json
{
  "version": "1.0",
  "deviceId": "pir_esp32_01_a9f2",
  "gatewayId": "gw_floor2_001",
  "sensorType": "pir",
  "value": {
    "motionDetected": true,
    "confidenceScore": 0.98,
    "durationMs": 4200
  },
  "occurredAt": "2026-08-21T16:00:00.000Z"
}
```

#### B. Door Position Contact (Magnetic Reed Switch)

- **Topic:** `hotel/{property_id}/room/{room_id}/sensor/door`
- **Schema / Payload:**

```json
{
  "version": "1.0",
  "deviceId": "door_contact_01_b12c",
  "gatewayId": "gw_floor2_001",
  "sensorType": "door",
  "value": {
    "state": "OPEN", // "OPEN" | "CLOSED"
    "durationInPreviousStateSec": 3600
  },
  "occurredAt": "2026-08-21T16:00:05.120Z"
}
```

#### C. Ambient Temperature & Humidity Sensor

- **Topic:** `hotel/{property_id}/room/{room_id}/sensor/temperature`
- **Schema / Payload:**

```json
{
  "version": "1.0",
  "deviceId": "env_dht_01_c34d",
  "gatewayId": "gw_floor2_001",
  "sensorType": "temperature",
  "value": {
    "temperatureCelsius": 22.5,
    "humidityPercent": 54.2,
    "batteryLevelPercent": 94
  },
  "occurredAt": "2026-08-21T16:00:00.000Z"
}
```

#### D. Relay State / Energy Meter

- **Topic:** `hotel/{property_id}/room/{room_id}/sensor/relay`
- **Schema / Payload:**

```json
{
  "version": "1.0",
  "deviceId": "relay_pwr_01_e56f",
  "gatewayId": "gw_floor2_001",
  "sensorType": "relay",
  "value": {
    "channel": 1,
    "relayState": "ON", // "ON" | "OFF"
    "currentAmps": 2.45,
    "voltageVolts": 228.4,
    "activePowerWatts": 559.58,
    "accumulatedKWh": 14.82
  },
  "occurredAt": "2026-08-21T16:00:00.000Z"
}
```

---

### 3.2. Heartbeat & Health Telemetry

- **Topic:** `hotel/{property_id}/gateway/{gateway_id}/heartbeat`
- **Frequency:** Every 30 seconds (Backend flags device `OFFLINE` after missing 3 consecutive heartbeats / 90 seconds).
- **Payload:**

```json
{
  "version": "1.0",
  "gatewayId": "gw_floor2_001",
  "ipAddress": "192.168.10.45",
  "macAddress": "98:CD:AC:12:34:56",
  "firmwareVersion": "v2.1.4-prod",
  "uptimeSeconds": 86400,
  "wifiRssi": -58,
  "freeHeapBytes": 148200,
  "connectedNodesCount": 8,
  "batteryBackupPercent": 100,
  "timestamp": "2026-08-21T16:00:30.000Z"
}
```

---

### 3.3. Life-Safety & Emergency Trigger Payloads

- **Topic:** `hotel/{property_id}/room/{room_id}/emergency`
- **QoS:** 2 (Exactly-Once delivery)
- **Supported Alert Types:** `SMOKE`, `FIRE`, `MEDICAL`, `PANIC`, `INTRUSION`, `WATER_LEAK`, `DEVICE_FAILURE`
- **Payload:**

```json
{
  "version": "1.0",
  "eventId": "evt_emg_98234ab1",
  "gatewayId": "gw_floor2_001",
  "deviceId": "smoke_sensor_01_d90e",
  "alertType": "SMOKE",
  "severity": "CRITICAL", // "WARNING" | "HIGH" | "CRITICAL"
  "details": {
    "sensorRawValue": 450,
    "thresholdValue": 200,
    "batteryPercent": 89,
    "zone": "BEDROOM_CEILING"
  },
  "triggeredAt": "2026-08-21T16:01:10.000Z"
}
```

---

### 3.4. Command & Acknowledgement Protocol

#### A. Backend Command Dispatch (Backend → Gateway)

- **Topic:** `hotel/{property_id}/room/{room_id}/command/{action}`
  *(e.g., `hotel/prop_lagos_01/room/204/command/set_relay`)*
- **Payload:**

```json
{
  "commandId": "cmd_8719238472",
  "action": "set_relay",
  "targetDeviceId": "relay_pwr_01_e56f",
  "parameters": {
    "channel": 1,
    "state": "OFF"
  },
  "issuedAt": "2026-08-21T16:02:00.000Z",
  "expiresAt": "2026-08-21T16:02:30.000Z"
}
```

#### B. Firmware Execution Acknowledgement (Gateway → Backend)

- **Topic:** `hotel/{property_id}/room/{room_id}/ack/{action}`
  *(e.g., `hotel/prop_lagos_01/room/204/ack/set_relay`)*
- **Payload:**

```json
{
  "commandId": "cmd_8719238472",
  "action": "set_relay",
  "targetDeviceId": "relay_pwr_01_e56f",
  "status": "SUCCESS", // "SUCCESS" | "FAILED" | "TIMEOUT" | "REJECTED"
  "result": {
    "channel": 1,
    "state": "OFF",
    "executionTimeMs": 48
  },
  "errorMessage": null,
  "acknowledgedAt": "2026-08-21T16:02:00.052Z"
}
```

---

### 3.5. Firmware Fault & Diagnostics

- **Topic:** `hotel/{property_id}/gateway/{gateway_id}/errors`
- **Payload:**

```json
{
  "version": "1.0",
  "gatewayId": "gw_floor2_001",
  "deviceId": "env_dht_01_c34d",
  "errorCode": "ERR_I2C_BUS_TIMEOUT",
  "description": "DHT sensor failed to respond on I2C bus address 0x38",
  "occurredAt": "2026-08-21T16:03:00.000Z"
}
```

---

## 4. Contract Governance & Versioning

1. **Zero Breaking Changes in Production:** Schema changes must increment the semantic payload version (`version: "1.1"`).
2. **Simultaneous PR Rule:** Any change to topic registry or payload schema must be committed simultaneously in both the backend repository (`backend/docs/mqtt-contract.md`) and the firmware repository.
3. **TypeBox Validation:** Payloads failing TypeBox validation at the ingestion layer will throw typed `InvalidPayloadException` and be logged with full context.
