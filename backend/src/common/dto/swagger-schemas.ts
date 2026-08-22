import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Auth DTOs ────────────────────────────────────────────────────────────────

export class LoginBody {
  @ApiProperty({ example: 'admin@hotel.com', description: 'Registered email address' })
  email!: string;

  @ApiProperty({ example: 'securePassword123', description: 'Account password', minLength: 1 })
  password!: string;
}

export class RefreshTokenBody {
  @ApiProperty({ description: 'Valid refresh token from login or previous refresh' })
  refreshToken!: string;
}

export class LogoutBody {
  @ApiPropertyOptional({
    description: 'Refresh token to invalidate (omitting invalidates all sessions)',
  })
  refreshToken?: string;
}

export class RequestPasswordResetBody {
  @ApiProperty({ example: 'admin@hotel.com', description: 'Email of the account to reset' })
  email!: string;
}

export class ResetPasswordBody {
  @ApiProperty({ description: 'Password reset token received via email' })
  token!: string;

  @ApiProperty({
    example: 'NewSecurePass123',
    description: 'New password (minimum 8 characters)',
    minLength: 8,
  })
  newPassword!: string;
}

// ── User Response ────────────────────────────────────────────────────────────

export class UserResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({
    enum: [
      'SUPER_ADMIN',
      'PROPERTY_MANAGER',
      'FRONT_DESK',
      'HOUSEKEEPING',
      'MAINTENANCE',
      'SECURITY',
    ],
  })
  role!: string;
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] }) status!: string;
  @ApiProperty({ nullable: true }) propertyId!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true }) lastLoginAt!: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

export class AuthResponse {
  @ApiProperty({ description: 'JWT access token (expires in 15m)' }) accessToken!: string;
  @ApiProperty({ description: 'JWT refresh token (expires in 7d)' }) refreshToken!: string;
  @ApiProperty({ type: UserResponse }) user!: UserResponse;
}

// ── Property DTOs ────────────────────────────────────────────────────────────

export class CreatePropertyBody {
  @ApiProperty({
    example: 'Grand Marina Hotel',
    minLength: 2,
    maxLength: 100,
    description: 'Property display name',
  })
  name!: string;

  @ApiProperty({
    example: 'GMH-001',
    minLength: 2,
    maxLength: 20,
    description: 'Unique property code',
  })
  code!: string;

  @ApiProperty({
    example: '12 Marina Street, Lagos',
    minLength: 3,
    maxLength: 255,
    description: 'Full street address',
  })
  address!: string;

  @ApiProperty({ example: 'Lagos', minLength: 2, maxLength: 100 })
  city!: string;

  @ApiProperty({ example: 'Nigeria', minLength: 2, maxLength: 100 })
  country!: string;
}

export class UpdatePropertyBody {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 }) name?: string;
  @ApiPropertyOptional({ minLength: 2, maxLength: 20 }) code?: string;
  @ApiPropertyOptional({ minLength: 3, maxLength: 255 }) address?: string;
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 }) city?: string;
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 }) country?: string;
}

export class PropertyResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() code!: string;
  @ApiProperty() address!: string;
  @ApiProperty() city!: string;
  @ApiProperty() country!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

// ── Building DTOs ────────────────────────────────────────────────────────────

export class CreateBuildingBody {
  @ApiProperty({ example: 'Tower A', minLength: 1, maxLength: 100, description: 'Building name' })
  name!: string;
}

export class UpdateBuildingBody {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 }) name?: string;
}

export class BuildingResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'uuid' }) propertyId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

// ── Floor DTOs ───────────────────────────────────────────────────────────────

export class CreateFloorBody {
  @ApiProperty({
    example: 3,
    minimum: -5,
    maximum: 200,
    description: 'Floor number (negative = basement)',
  })
  number!: number;

  @ApiPropertyOptional({
    example: 'Third Floor',
    maxLength: 100,
    description: 'Optional floor name',
  })
  name?: string;
}

export class UpdateFloorBody {
  @ApiPropertyOptional({ minimum: -5, maximum: 200 }) number?: number;
  @ApiPropertyOptional({ maxLength: 100 }) name?: string;
}

export class FloorResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() number!: number;
  @ApiProperty({ nullable: true }) name!: string | null;
  @ApiProperty({ format: 'uuid' }) buildingId!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

// ── Room DTOs ────────────────────────────────────────────────────────────────

export class CreateRoomBody {
  @ApiProperty({
    example: '204A',
    minLength: 1,
    maxLength: 20,
    description: 'Room number (unique within property)',
  })
  number!: string;

  @ApiProperty({ format: 'uuid', description: 'Building UUID this room belongs to' })
  buildingId!: string;

  @ApiProperty({ format: 'uuid', description: 'Floor UUID this room is on' })
  floorId!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 2, description: 'Maximum guest count' })
  maxOccupancy?: number;

  @ApiPropertyOptional({
    enum: [
      'VACANT_CLEAN',
      'VACANT_DIRTY',
      'OCCUPIED_CLEAN',
      'OCCUPIED_DIRTY',
      'OUT_OF_ORDER',
      'MAINTENANCE_REQUIRED',
    ],
    description: 'Initial room status',
  })
  status?: string;
}

export class UpdateRoomBody {
  @ApiPropertyOptional({ minLength: 1, maxLength: 20 }) number?: string;
  @ApiPropertyOptional({ format: 'uuid' }) buildingId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) floorId?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 20 }) maxOccupancy?: number;
}

export class UpdateRoomStatusBody {
  @ApiProperty({
    enum: [
      'VACANT_CLEAN',
      'VACANT_DIRTY',
      'OCCUPIED_CLEAN',
      'OCCUPIED_DIRTY',
      'OUT_OF_ORDER',
      'MAINTENANCE_REQUIRED',
    ],
    description: 'New room status',
  })
  status!: string;

  @ApiPropertyOptional({
    maxLength: 255,
    example: 'Guest checked in',
    description: 'Optional reason for audit trail',
  })
  reason?: string;
}

export class RoomResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() number!: string;
  @ApiProperty({ format: 'uuid' }) buildingId!: string;
  @ApiProperty({ format: 'uuid' }) floorId!: string;
  @ApiProperty({ format: 'uuid' }) propertyId!: string;
  @ApiProperty() maxOccupancy!: number;
  @ApiProperty({
    enum: [
      'VACANT_CLEAN',
      'VACANT_DIRTY',
      'OCCUPIED_CLEAN',
      'OCCUPIED_DIRTY',
      'OUT_OF_ORDER',
      'MAINTENANCE_REQUIRED',
    ],
  })
  status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

// ── Device Assignment DTOs ───────────────────────────────────────────────────

export class AssignDeviceBody {
  @ApiProperty({ format: 'uuid', description: 'Device UUID to assign to this room' })
  deviceId!: string;
}
