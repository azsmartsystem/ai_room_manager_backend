import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create an audit log entry with full details', async () => {
      const mockResult = {
        id: 'audit-123',
        actorId: 'user-1',
        actorEmail: 'admin@hotel.com',
        actorRole: Role.SUPER_ADMIN,
        action: 'USER_LOGIN',
        resource: 'AUTH',
        resourceId: 'user-1',
        metadata: { ip: '127.0.0.1' },
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
        createdAt: new Date(),
      };

      prisma.auditLog.create.mockResolvedValue(mockResult);

      const result = await service.log({
        actorId: 'user-1',
        actorEmail: 'admin@hotel.com',
        actorRole: Role.SUPER_ADMIN,
        action: 'USER_LOGIN',
        resource: 'AUTH',
        resourceId: 'user-1',
        metadata: { ip: '127.0.0.1' },
        ipAddress: '127.0.0.1',
        userAgent: 'Jest',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it('should create an audit log entry without metadata', async () => {
      prisma.auditLog.create.mockResolvedValue({ id: 'a2' });

      await service.log({
        action: 'TEST',
        resource: 'TEST',
      });

      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw and log if prisma create fails', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('Database unavailable'));

      await expect(
        service.log({
          action: 'FAILED_ACTION',
          resource: 'TEST',
        }),
      ).rejects.toThrow('Database unavailable');
    });
  });

  describe('findLogs', () => {
    it('should query audit logs with all filters', async () => {
      const mockItems = [
        {
          id: 'audit-1',
          action: 'USER_LOGIN',
          resource: 'AUTH',
          createdAt: new Date(),
        },
      ];
      prisma.auditLog.findMany.mockResolvedValue(mockItems);
      prisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findLogs({
        actorId: 'u-1',
        action: 'USER_LOGIN',
        resource: 'AUTH',
        resourceId: 'r-1',
        limit: 10,
        offset: 0,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalled();
      expect(prisma.auditLog.count).toHaveBeenCalled();
      expect(result).toEqual({ items: mockItems, total: 1 });
    });

    it('should query audit logs with defaults and single date', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      const result = await service.findLogs({
        startDate: new Date('2026-01-01'),
      });

      expect(result).toEqual({ items: [], total: 0 });
    });
  });
});
