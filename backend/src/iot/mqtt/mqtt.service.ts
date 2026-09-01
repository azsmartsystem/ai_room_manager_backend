import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { AppConfigService } from '../../config/config.service';
import { MqttClientCertUtil } from './mqtt-client-cert.util';
import { TopicRegistry } from '../topics/topic.registry';

export type MqttMessageHandler = (topic: string, payload: unknown) => Promise<void> | void;

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient | null = null;
  private isConnected = false;
  private readonly messageHandlers: MqttMessageHandler[] = [];

  constructor(
    private readonly configService: AppConfigService,
    @Optional() customClient?: mqtt.MqttClient,
  ) {
    if (customClient) {
      this.client = customClient;
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      await this.connect();
    } else {
      this.setupClientEvents(this.client);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const brokerUrl = this.configService.get('MQTT_BROKER_URL') || 'mqtt://localhost:1883';
    const caPath = this.configService.get('MQTT_TLS_CA_CERT_PATH');
    const certPath = this.configService.get('MQTT_TLS_CLIENT_CERT_PATH');
    const keyPath = this.configService.get('MQTT_TLS_CLIENT_KEY_PATH');

    const tlsOptions = MqttClientCertUtil.loadTlsOptions(caPath, certPath, keyPath, false);

    const clientOptions: mqtt.IClientOptions = {
      clientId: `ai_room_manager_backend_${Math.random().toString(16).substring(2, 8)}`,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
      ...tlsOptions,
    };

    this.logger.log({
      event: 'MQTT_CONNECTING',
      brokerUrl,
    });

    try {
      this.client = mqtt.connect(brokerUrl, clientOptions);
      this.setupClientEvents(this.client);
    } catch (error) {
      this.logger.error({
        event: 'MQTT_CONNECTION_INIT_FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private setupClientEvents(client: mqtt.MqttClient): void {
    client.on('connect', () => {
      this.isConnected = true;
      this.logger.log({ event: 'MQTT_CONNECTED' });
      this.subscribeDefaultTopics();
    });

    client.on('reconnect', () => {
      this.logger.warn({ event: 'MQTT_RECONNECTING' });
    });

    client.on('close', () => {
      this.isConnected = false;
      this.logger.warn({ event: 'MQTT_CONNECTION_CLOSED' });
    });

    client.on('error', (err) => {
      this.logger.error({
        event: 'MQTT_ERROR',
        error: err.message,
      });
    });

    client.on('message', async (topic: string, buffer: Buffer) => {
      let payload: unknown;
      try {
        const text = buffer.toString('utf-8');
        payload = JSON.parse(text);
      } catch (err) {
        this.logger.warn({
          event: 'MQTT_RAW_PAYLOAD_PARSE_FAILED',
          topic,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }

      for (const handler of this.messageHandlers) {
        try {
          await handler(topic, payload);
        } catch (handlerErr) {
          this.logger.error({
            event: 'MQTT_MESSAGE_HANDLER_ERROR',
            topic,
            error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
          });
        }
      }
    });
  }

  private subscribeDefaultTopics(): void {
    // Subscribe to standard telemetry, heartbeats, errors, emergency, and acks per contract
    this.subscribe(TopicRegistry.SENSOR_TELEMETRY_PATTERN, 1);
    this.subscribe(TopicRegistry.GATEWAY_HEARTBEAT_PATTERN, 1);
    this.subscribe(TopicRegistry.GATEWAY_ERRORS_PATTERN, 1);
    this.subscribe(TopicRegistry.EMERGENCY_ALERT_PATTERN, 2);
    this.subscribe(TopicRegistry.COMMAND_ACK_PATTERN, 1);
  }

  subscribe(topic: string, qos: 0 | 1 | 2 = 1): void {
    if (this.client) {
      this.client.subscribe(topic, { qos }, (err) => {
        if (err) {
          this.logger.error({
            event: 'MQTT_SUBSCRIBE_FAILED',
            topic,
            error: err.message,
          });
        } else {
          this.logger.log({
            event: 'MQTT_SUBSCRIBED',
            topic,
            qos,
          });
        }
      });
    }
  }

  registerHandler(handler: MqttMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  async publish(topic: string, payload: unknown, qos: 0 | 1 | 2 = 1): Promise<void> {
    if (!this.client) {
      this.logger.warn({
        event: 'MQTT_PUBLISH_SKIPPED_NO_CLIENT',
        topic,
      });
      return;
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, payloadString, { qos }, (err) => {
        if (err) {
          this.logger.error({
            event: 'MQTT_PUBLISH_FAILED',
            topic,
            error: err.message,
          });
          reject(err);
        } else {
          this.logger.debug?.({
            event: 'MQTT_PUBLISHED',
            topic,
          });
          resolve();
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          this.isConnected = false;
          this.logger.log({ event: 'MQTT_DISCONNECTED' });
          resolve();
        });
      });
    }
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }
}
