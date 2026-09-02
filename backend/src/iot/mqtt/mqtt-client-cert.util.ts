import * as fs from 'fs';
import { Logger } from '@nestjs/common';

export interface MqttTlsOptions {
  ca?: Buffer;
  cert?: Buffer;
  key?: Buffer;
  rejectUnauthorized?: boolean;
}

export class MqttClientCertUtil {
  private static readonly logger = new Logger(MqttClientCertUtil.name);

  static loadTlsOptions(
    caPath?: string,
    certPath?: string,
    keyPath?: string,
    rejectUnauthorized = false,
  ): MqttTlsOptions {
    const options: MqttTlsOptions = { rejectUnauthorized };

    try {
      if (caPath && fs.existsSync(caPath)) {
        options.ca = fs.readFileSync(caPath);
      }
      if (certPath && fs.existsSync(certPath)) {
        options.cert = fs.readFileSync(certPath);
      }
      if (keyPath && fs.existsSync(keyPath)) {
        options.key = fs.readFileSync(keyPath);
      }
    } catch (error) {
      this.logger.error({
        event: 'MQTT_TLS_CERTS_LOAD_FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return options;
  }
}
