import { BuildingNotFoundException } from './building-not-found.exception';
import { FloorNotFoundException } from './floor-not-found.exception';
import { PropertyNotFoundException } from './property-not-found.exception';
import { RoomNotFoundException } from './room-not-found.exception';
import { UserAlreadyExistsException } from './user-already-exists.exception';
import { UserNotFoundException } from './user-not-found.exception';
import { DeviceNotFoundException } from '../iot/device-not-found.exception';

describe('Domain Operations Exceptions', () => {
  it('should instantiate BuildingNotFoundException', () => {
    const ex = new BuildingNotFoundException('b-1');
    expect(ex.code).toBe('BUILDING_NOT_FOUND');
    expect(ex.message).toContain('b-1');
  });

  it('should instantiate FloorNotFoundException', () => {
    const ex = new FloorNotFoundException('f-1');
    expect(ex.code).toBe('FLOOR_NOT_FOUND');
    expect(ex.message).toContain('f-1');
  });

  it('should instantiate PropertyNotFoundException', () => {
    const ex = new PropertyNotFoundException('p-1');
    expect(ex.code).toBe('PROPERTY_NOT_FOUND');
    expect(ex.message).toContain('p-1');
  });

  it('should instantiate RoomNotFoundException', () => {
    const ex = new RoomNotFoundException('r-1');
    expect(ex.code).toBe('ROOM_NOT_FOUND');
    expect(ex.message).toContain('r-1');
  });

  it('should instantiate UserAlreadyExistsException', () => {
    const ex = new UserAlreadyExistsException('test@hotel.com');
    expect(ex.code).toBe('USER_ALREADY_EXISTS');
    expect(ex.message).toContain('test@hotel.com');
  });

  it('should instantiate UserNotFoundException', () => {
    const ex = new UserNotFoundException('u-1');
    expect(ex.code).toBe('USER_NOT_FOUND');
    expect(ex.message).toContain('u-1');
  });

  it('should instantiate DeviceNotFoundException', () => {
    const ex = new DeviceNotFoundException('dev-1');
    expect(ex.code).toBe('DEVICE_NOT_FOUND');
    expect(ex.message).toContain('dev-1');
  });
});
