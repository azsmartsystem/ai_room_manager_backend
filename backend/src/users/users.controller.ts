import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, CreateUserDtoSchema } from './dto/create-user.dto';
import { TypeBoxValidationPipe } from '../common/pipes/validation.pipe';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Role, UserStatus } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth('jwt-access')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Provision a new staff member',
    description:
      'Creates a new user account with assigned role and property scope. Restricted to Super Admin and Property Managers.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName', 'role'],
      properties: {
        email: { type: 'string', format: 'email', example: 'housekeeper@grandroyal.com' },
        password: { type: 'string', minLength: 8, example: 'Password123!' },
        firstName: { type: 'string', example: 'Amina' },
        lastName: { type: 'string', example: 'Bello' },
        role: {
          type: 'string',
          enum: [
            'SUPER_ADMIN',
            'PROPERTY_MANAGER',
            'FRONT_DESK',
            'HOUSEKEEPING',
            'MAINTENANCE',
            'SECURITY',
          ],
          example: 'HOUSEKEEPING',
        },
        propertyId: {
          type: 'string',
          format: 'uuid',
          example: 'c1234567-89ab-cdef-0123-456789abcdef',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User successfully provisioned.' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid payload.' })
  @ApiResponse({ status: 403, description: 'Forbidden — Insufficient role.' })
  @ApiResponse({ status: 409, description: 'User email already exists.' })
  async createUser(
    @Body(new TypeBoxValidationPipe(CreateUserDtoSchema)) dto: Record<string, unknown>,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    const userDto = dto as CreateUserDto;

    if (actor.role === Role.PROPERTY_MANAGER && actor.propertyId) {
      userDto.propertyId = actor.propertyId;
    }

    const user = await this.usersService.create(userDto);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser };
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({
    summary: 'List users',
    description:
      'Retrieves staff accounts. Super Admin can query all or by propertyId; Property Manager receives scoped staff.',
  })
  @ApiQuery({
    name: 'propertyId',
    required: false,
    type: 'string',
    description: 'Filter users by property UUID',
  })
  @ApiResponse({ status: 200, description: 'List of user records.' })
  async listUsers(
    @CurrentUser() actor: AuthenticatedUser,
    @Query('propertyId') propertyIdQuery?: string,
  ) {
    const targetPropertyId =
      actor.role === Role.SUPER_ADMIN ? propertyIdQuery : (actor.propertyId ?? undefined);
    const users = await this.usersService.findUsers(targetPropertyId);
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      users: users.map(({ passwordHash, ...safe }) => safe),
    };
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiParam({ name: 'id', type: 'string', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User profile.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getUser(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser };
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN, Role.PROPERTY_MANAGER)
  @ApiOperation({ summary: 'Update user account status' })
  @ApiParam({ name: 'id', type: 'string', description: 'User UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], example: 'SUSPENDED' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User status updated successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async updateStatus(@Param('id') id: string, @Body() body: { status: UserStatus }) {
    const user = await this.usersService.updateStatus(id, body.status);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeUser } = user;
    return { user: safeUser };
  }
}
