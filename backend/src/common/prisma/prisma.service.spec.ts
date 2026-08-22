import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('should connect on module init', async () => {
    const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    await service.onModuleInit();
    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('should handle Error instance connection failures on init', async () => {
    jest.spyOn(service, '$connect').mockRejectedValue(new Error('Connection failure'));
    await expect(service.onModuleInit()).resolves.not.toThrow();
  });

  it('should handle non-Error connection failures on init', async () => {
    jest.spyOn(service, '$connect').mockRejectedValue('String error failure');
    await expect(service.onModuleInit()).resolves.not.toThrow();
  });

  it('should disconnect on module destroy', async () => {
    const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
    await service.onModuleDestroy();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
