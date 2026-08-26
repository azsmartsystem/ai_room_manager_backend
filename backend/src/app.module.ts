import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PropertiesModule } from './properties/properties.module';
import { HousekeepingModule } from './housekeeping/housekeeping.module';

// Future feature modules — uncomment each as implemented:
// import { OccupancyModule } from './occupancy/occupancy.module';
// import { MaintenanceModule } from './maintainance/maintainance.module';
// import { DndModule } from './dnd/dnd.module';
// import { EmergencyModule } from './emergency/emergency.module';
// import { NotificationsModule } from './notifications/notifications.module';
// import { DashboardModule } from './dashboard/dashboard.module';
// import { RealtimeModule } from './realtime/realtime.module';
// import { IotModule } from './iot/iot.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    PropertiesModule,
    HousekeepingModule,
    EventEmitterModule.forRoot({ wildcard: true }),
  ],
})
export class AppModule implements NestModule {
  configure(_consumer: MiddlewareConsumer): void {
    // Per-route middleware (e.g. rate limiting) is applied here.
  }
}
