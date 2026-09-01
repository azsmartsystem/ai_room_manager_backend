import { MqttService } from './mqtt.service';
import { AppConfigService } from '../../config/config.service';
import { MqttClientCertUtil } from './mqtt-client-cert.util';
import { EventEmitter } from 'events';
import * as fs from 'fs';

class MockMqttClient extends EventEmitter {
  subscribe = jest.fn((topic: string, opts: unknown, cb?: (err?: Error) => void) => {
    if (cb) cb();
    return this;
  });
  publish = jest.fn((topic: string, msg: string, opts: unknown, cb?: (err?: Error) => void) => {
    if (cb) cb();
    return this;
  });
  end = jest.fn((force: boolean, opts: unknown, cb?: () => void) => {
    if (cb) cb();
    return this;
  });
}

describe('MqttService', () => {
  let service: MqttService;
  let mockClient: MockMqttClient;
  let mockConfigService: Partial<AppConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'MQTT_BROKER_URL') return 'mqtt://localhost:1883';
        return undefined;
      }) as unknown as AppConfigService['get'],
    };

    mockClient = new MockMqttClient();
    service = new MqttService(
      mockConfigService as AppConfigService,
      mockClient as unknown as import('mqtt').MqttClient,
    );
  });

  describe('Lifecycle & Client Events', () => {
    it('sets up event handlers on module init', async () => {
      await service.onModuleInit();
      expect(service.getIsConnected()).toBe(false);

      mockClient.emit('connect');
      expect(service.getIsConnected()).toBe(true);
      expect(mockClient.subscribe).toHaveBeenCalled();

      mockClient.emit('reconnect');
      mockClient.emit('close');
      expect(service.getIsConnected()).toBe(false);

      mockClient.emit('error', new Error('MQTT connection error'));
    });

    it('processes incoming valid JSON messages across registered handlers', async () => {
      await service.onModuleInit();
      const handler = jest.fn();
      service.registerHandler(handler);

      const topic = 'hotel/prop_1/room/101/sensor/pir';
      const payload = { deviceId: 'pir_1', sensorType: 'pir' };
      const buffer = Buffer.from(JSON.stringify(payload));

      mockClient.emit('message', topic, buffer);
      expect(handler).toHaveBeenCalledWith(topic, payload);
    });

    it('gracefully handles malformed JSON message buffer', async () => {
      await service.onModuleInit();
      const handler = jest.fn();
      service.registerHandler(handler);

      const buffer = Buffer.from('not valid json {');
      mockClient.emit('message', 'hotel/prop_1/sensor', buffer);
      expect(handler).not.toHaveBeenCalled();
    });

    it('catches and logs handler execution errors without throwing', async () => {
      await service.onModuleInit();
      const faultyHandler = jest.fn().mockRejectedValue(new Error('Handler crashed'));
      service.registerHandler(faultyHandler);

      const buffer = Buffer.from(JSON.stringify({ ok: true }));
      mockClient.emit('message', 'test/topic', buffer);
      expect(faultyHandler).toHaveBeenCalled();
    });
  });

  describe('Publishing', () => {
    it('publishes JSON payload to target topic', async () => {
      await service.onModuleInit();
      await service.publish('test/topic', { test: true }, 1);

      expect(mockClient.publish).toHaveBeenCalledWith(
        'test/topic',
        JSON.stringify({ test: true }),
        { qos: 1 },
        expect.any(Function),
      );
    });

    it('rejects if client.publish returns an error', async () => {
      await service.onModuleInit();
      mockClient.publish.mockImplementationOnce((t, m, o, cb) => {
        if (cb) cb(new Error('Publish failed'));
        return mockClient;
      });

      await expect(service.publish('test/topic', 'hello', 1)).rejects.toThrow('Publish failed');
    });

    it('skips publish if no client is connected', async () => {
      const emptyService = new MqttService(mockConfigService as AppConfigService);
      await expect(emptyService.publish('test/topic', 'hello')).resolves.toBeUndefined();
    });
  });

  describe('Subscriptions', () => {
    it('logs error when client subscribe encounters failure callback', async () => {
      await service.onModuleInit();
      mockClient.subscribe.mockImplementationOnce((t, o, cb) => {
        if (cb) cb(new Error('Sub failed'));
        return mockClient;
      });

      service.subscribe('faulty/topic');
      expect(mockClient.subscribe).toHaveBeenCalled();
    });
  });

  describe('Disconnect', () => {
    it('disconnects client cleanly on module destroy', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();
      expect(mockClient.end).toHaveBeenCalled();
      expect(service.getIsConnected()).toBe(false);
    });
  });

  describe('MqttClientCertUtil', () => {
    it('returns empty options when paths are not provided', () => {
      const opts = MqttClientCertUtil.loadTlsOptions(undefined, undefined, undefined, false);
      expect(opts.rejectUnauthorized).toBe(false);
      expect(opts.ca).toBeUndefined();
    });

    it('reads files when they exist', () => {
      const tempCa = './temp_ca_test.pem';
      const tempCert = './temp_cert_test.pem';
      const tempKey = './temp_key_test.pem';

      fs.writeFileSync(tempCa, 'fake ca content');
      fs.writeFileSync(tempCert, 'fake cert content');
      fs.writeFileSync(tempKey, 'fake key content');

      try {
        const opts = MqttClientCertUtil.loadTlsOptions(tempCa, tempCert, tempKey, true);
        expect(opts.rejectUnauthorized).toBe(true);
        expect(opts.ca?.toString()).toBe('fake ca content');
        expect(opts.cert?.toString()).toBe('fake cert content');
        expect(opts.key?.toString()).toBe('fake key content');
      } finally {
        if (fs.existsSync(tempCa)) fs.unlinkSync(tempCa);
        if (fs.existsSync(tempCert)) fs.unlinkSync(tempCert);
        if (fs.existsSync(tempKey)) fs.unlinkSync(tempKey);
      }
    });

    it('gracefully handles non-existent file paths', () => {
      const opts = MqttClientCertUtil.loadTlsOptions(
        'non_existent_file_path_123.pem',
        undefined,
        undefined,
        false,
      );
      expect(opts.ca).toBeUndefined();
      expect(opts.rejectUnauthorized).toBe(false);
    });
  });
});
