import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Role, Prisma } from '@prisma/client';

export interface CreateAuditLogParams {
  actorId?: string;
  actorEmail?: string;
  actorRole?: Role;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface QueryAuditLogsParams {
  actorId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an immutable audit event to the persistent audit log.
   */
  async log(params: CreateAuditLogParams) {
    try {
      const record = await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          actorEmail: params.actorEmail,
          actorRole: params.actorRole,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId,
          metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });

      this.logger.log({
        event: 'AUDIT_LOG_RECORDED',
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        actorId: params.actorId,
      });

      return record;
    } catch (error: unknown) {
      this.logger.error({
        event: 'AUDIT_LOG_WRITE_FAILED',
        error: error instanceof Error ? error.message : String(error),
        action: params.action,
        resource: params.resource,
      });
      throw error;
    }
  }

  /**
   * Queries audit logs with pagination and filters.
   */
  async findLogs(params: QueryAuditLogsParams) {
    const where: Prisma.AuditLogWhereInput = {};

    if (params.actorId) {
      where.actorId = params.actorId;
    }
    if (params.action) {
      where.action = params.action;
    }
    if (params.resource) {
      where.resource = params.resource;
    }
    if (params.resourceId) {
      where.resourceId = params.resourceId;
    }
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit ?? 50,
        skip: params.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
