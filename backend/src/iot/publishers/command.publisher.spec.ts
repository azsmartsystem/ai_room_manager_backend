import { CommandPublisher } from './command.publisher';
import { MqttService } from '../mqtt/mqtt.service';

describe('CommandPublisher', () => {
  let publisher: CommandPublisher;
  let mockMqttService: { publish: jest.Mock };

  beforeEach(() => {
    mockMqttService = { publish: jest.fn().mockResolvedValue(undefined) };
    publisher = new CommandPublisher(mockMqttService as unknown as MqttService);
  });

  it('publishes command payload with expiration date', async () => {
    const expiresAt = new Date('2026-08-21T17:00:00.000Z');
    const commandId = await publisher.publishCommand(
      'prop_1',
      'room_101',
      'set_relay',
      'relay_1',
      { channel: 1, state: 'ON' },
      expiresAt,
    );

    expect(commandId).toMatch(/^cmd_/);
    expect(mockMqttService.publish).toHaveBeenCalledWith(
      'hotel/prop_1/room/room_101/command/set_relay',
      expect.objectContaining({
        commandId,
        action: 'set_relay',
        targetDeviceId: 'relay_1',
        parameters: { channel: 1, state: 'ON' },
        expiresAt: '2026-08-21T17:00:00.000Z',
      }),
      1,
    );
  });

  it('publishes command payload without expiration date', async () => {
    const commandId = await publisher.publishCommand('prop_1', 'room_101', 'reboot', 'gw_1', {});

    expect(commandId).toMatch(/^cmd_/);
    expect(mockMqttService.publish).toHaveBeenCalledWith(
      'hotel/prop_1/room/room_101/command/reboot',
      expect.objectContaining({
        commandId,
        action: 'reboot',
        targetDeviceId: 'gw_1',
        parameters: {},
        expiresAt: undefined,
      }),
      1,
    );
  });
});
