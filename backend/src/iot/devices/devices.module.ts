import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../../audit/audit.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { CommandPublisher } from '../publishers/command.publisher';

@Module({
  imports: [PrismaModule, AuditModule, MqttModule],
  controllers: [DevicesController],
  providers: [DevicesService, CommandPublisher],
  exports: [DevicesService, CommandPublisher],
})
export class DevicesModule {}
