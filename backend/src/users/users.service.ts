import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserAlreadyExistsException } from '../common/exceptions/operations/user-already-exists.exception';
import { UserNotFoundException } from '../common/exceptions/operations/user-not-found.exception';
import { Role, User, UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly saltRounds = 10;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new user
   * @param dto CreateUserDto
   * @returns Promise<User>
   */
  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new UserAlreadyExistsException(dto.email);
    }

    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role as Role,
        propertyId: dto.propertyId,
        status: UserStatus.ACTIVE,
      },
    });

    this.logger.log({
      event: 'USER_CREATED',
      userId: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    });

    return user;
  }

  /**
   * Finds a user by email
   * @param email string
   * @returns Promise<User | null>
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Finds all users for a given property
   * @param propertyId
   * @returns
   */
  async findUsers(propertyId?: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: propertyId ? { propertyId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Finds a user by ID
   * @param id
   * @returns
   */
  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new UserNotFoundException(id);
    }

    return user;
  }

  /**
   * Updates a user's password
   * @param userId
   * @param newPasswordPlain
   */
  async updatePassword(userId: string, newPasswordPlain: string): Promise<void> {
    const user = await this.findById(userId);
    const passwordHash = await bcrypt.hash(newPasswordPlain, this.saltRounds);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    this.logger.log({
      event: 'USER_PASSWORD_UPDATED',
      userId: user.id,
    });
  }

  /**
   * Updates a user's last login timestamp
   * @param userId
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Updates a user's status
   * @param userId
   * @param status
   * @returns
   */
  async updateStatus(userId: string, status: UserStatus): Promise<User> {
    const user = await this.findById(userId);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status },
    });

    this.logger.log({
      event: 'USER_STATUS_UPDATED',
      userId: user.id,
      status,
    });

    return updated;
  }
}
