import { Module } from '@nestjs/common';
import { HousekeepingService } from './housekeeping.service';
import { HousekeepingController } from './housekeeping.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
