import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceController } from './maintainance.controller';
import { MaintenanceService } from './maintainance.service';
import { TicketStatus, Role, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';

// ─── Mock Service ─────────────────────────────────────────────────────────────

const mockMaintenanceService = {
  createTicket: jest.fn(),
  listTickets: jest.fn(),
  getTicket: jest.fn(),
  assignTicket: jest.fn(),
  startWork: jest.fn(),
  pendingParts: jest.fn(),
  resolveTicket: jest.fn(),
  closeTicket: jest.fn(),
  getTicketsByRoom: jest.fn(),
};

const mockUser: AuthenticatedUser = {
  id: 'actor-uuid',
  email: 'manager@test.com',
  role: Role.PROPERTY_MANAGER,
  propertyId: 'prop-uuid',
  firstName: 'Test',
  lastName: 'Manager',
  status: UserStatus.ACTIVE,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTicket = {
  id: 'ticket-uuid',
  roomId: 'room-uuid',
  status: TicketStatus.OPEN,
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('MaintenanceController', () => {
  let controller: MaintenanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceController],
      providers: [{ provide: MaintenanceService, useValue: mockMaintenanceService }],
    }).compile();

    controller = module.get<MaintenanceController>(MaintenanceController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTicket', () => {
    it('delegates to maintenanceService.createTicket', async () => {
      mockMaintenanceService.createTicket.mockResolvedValue(mockTicket);

      const dto = {
        roomId: 'room-uuid',
        title: 'Broken AC',
        description: 'The air conditioning unit is not working.',
        category: 'HVAC',
      };
      await controller.createTicket('prop-uuid', dto, mockUser);

      expect(mockMaintenanceService.createTicket).toHaveBeenCalledWith(
        dto,
        expect.objectContaining({ id: 'actor-uuid' }),
      );
    });
  });

  describe('listTickets', () => {
    it('delegates to maintenanceService.listTickets with propertyId', async () => {
      mockMaintenanceService.listTickets.mockResolvedValue([mockTicket]);

      await controller.listTickets('prop-uuid', undefined, undefined, 'OPEN', undefined);

      expect(mockMaintenanceService.listTickets).toHaveBeenCalledWith(
        expect.objectContaining({ propertyId: 'prop-uuid', status: 'OPEN' }),
      );
    });
  });

  describe('getTicket', () => {
    it('delegates to maintenanceService.getTicket', async () => {
      mockMaintenanceService.getTicket.mockResolvedValue(mockTicket);

      await controller.getTicket('ticket-uuid');

      expect(mockMaintenanceService.getTicket).toHaveBeenCalledWith('ticket-uuid');
    });
  });

  describe('assignTicket', () => {
    it('delegates to maintenanceService.assignTicket', async () => {
      mockMaintenanceService.assignTicket.mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.ASSIGNED,
      });

      const dto = { technicianId: 'tech-uuid' };
      await controller.assignTicket('ticket-uuid', dto, mockUser);

      expect(mockMaintenanceService.assignTicket).toHaveBeenCalledWith(
        'ticket-uuid',
        dto,
        expect.objectContaining({ id: 'actor-uuid' }),
      );
    });
  });

  describe('startWork', () => {
    it('delegates to maintenanceService.startWork', async () => {
      mockMaintenanceService.startWork.mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.IN_PROGRESS,
      });

      await controller.startWork('ticket-uuid', mockUser);

      expect(mockMaintenanceService.startWork).toHaveBeenCalledWith(
        'ticket-uuid',
        expect.objectContaining({ id: 'actor-uuid' }),
      );
    });
  });

  describe('pendingParts', () => {
    it('delegates to maintenanceService.pendingParts', async () => {
      mockMaintenanceService.pendingParts.mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.PENDING_PARTS,
      });

      const dto = { status: 'PENDING_PARTS', notes: 'Need filter' };
      await controller.pendingParts('ticket-uuid', dto, mockUser);

      expect(mockMaintenanceService.pendingParts).toHaveBeenCalledWith(
        'ticket-uuid',
        'Need filter',
        expect.objectContaining({ id: 'actor-uuid' }),
      );
    });
  });

  describe('resolveTicket', () => {
    it('delegates to maintenanceService.resolveTicket', async () => {
      mockMaintenanceService.resolveTicket.mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.RESOLVED,
      });

      const dto = { status: 'RESOLVED', notes: 'Fixed!' };
      await controller.resolveTicket('ticket-uuid', dto, mockUser);

      expect(mockMaintenanceService.resolveTicket).toHaveBeenCalledWith(
        'ticket-uuid',
        'Fixed!',
        expect.objectContaining({ id: 'actor-uuid' }),
      );
    });
  });

  describe('closeTicket', () => {
    it('delegates to maintenanceService.closeTicket', async () => {
      mockMaintenanceService.closeTicket.mockResolvedValue({
        ...mockTicket,
        status: TicketStatus.CLOSED,
      });

      const dto = { status: 'CLOSED', notes: 'Closing ticket' };
      await controller.closeTicket('ticket-uuid', dto, mockUser);

      expect(mockMaintenanceService.closeTicket).toHaveBeenCalledWith(
        'ticket-uuid',
        'Closing ticket',
        expect.objectContaining({ id: 'actor-uuid' }),
      );
    });
  });

  describe('getTicketsByRoom', () => {
    it('delegates to maintenanceService.getTicketsByRoom', async () => {
      mockMaintenanceService.getTicketsByRoom.mockResolvedValue([mockTicket]);

      await controller.getTicketsByRoom('room-uuid');

      expect(mockMaintenanceService.getTicketsByRoom).toHaveBeenCalledWith('room-uuid');
    });
  });
});
