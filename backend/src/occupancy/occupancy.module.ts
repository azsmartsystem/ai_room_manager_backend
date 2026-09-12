import { Module } from '@nestjs/common';
import { OccupancyService } from './occupancy.service';
import { OccupancyListener } from './occupancy.listener';
import { OccupancyController } from './occupancy.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OccupancyController],
  providers: [OccupancyService, OccupancyListener],
  exports: [OccupancyService],
})
export class OccupancyModule {}
