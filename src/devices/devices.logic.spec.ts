import { DataSource } from 'typeorm';
import { Device } from '../entities/device.entity';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/http-error';
import {
  assertDeviceOwnership,
  createDevice,
  findDevicesForUser,
} from './devices.logic';

interface MockDeviceRepo {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

function fakeDataSource(devices: MockDeviceRepo): DataSource {
  return {
    getRepository: (entity: unknown) => {
      if (entity === Device) return devices;
      throw new Error('unexpected entity requested in test');
    },
  } as unknown as DataSource;
}

function makeDeviceRepo(): MockDeviceRepo {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((data: unknown) => data),
    save: jest.fn((data: unknown) => Promise.resolve(data)),
  };
}

describe('devices.logic createDevice', () => {
  it('registers a new device under the caller', async () => {
    const devices = makeDeviceRepo();

    const result = await createDevice(fakeDataSource(devices), 'user-1', {
      externalId: 'FITRING-001',
      name: 'My Ring',
    });

    expect(devices.create).toHaveBeenCalledWith({
      externalId: 'FITRING-001',
      name: 'My Ring',
      userId: 'user-1',
    });
    expect(result).toEqual(
      expect.objectContaining({ externalId: 'FITRING-001', userId: 'user-1' }),
    );
  });

  it('refuses to register an externalId that is already claimed, even by another user', async () => {
    const devices = makeDeviceRepo();
    devices.findOne.mockResolvedValue({
      id: 'device-1',
      externalId: 'FITRING-001',
      userId: 'someone-else',
    });

    await expect(
      createDevice(fakeDataSource(devices), 'user-1', {
        externalId: 'FITRING-001',
        name: 'My Ring',
      }),
    ).rejects.toThrow(ConflictError);
    expect(devices.save).not.toHaveBeenCalled();
  });
});

describe('devices.logic findDevicesForUser', () => {
  it('scopes the lookup to the given userId', async () => {
    const devices = makeDeviceRepo();

    await findDevicesForUser(fakeDataSource(devices), 'user-1');

    expect(devices.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
  });
});

describe('devices.logic assertDeviceOwnership', () => {
  it('returns the device when it belongs to the caller', async () => {
    const devices = makeDeviceRepo();
    const device = { id: 'device-1', userId: 'user-1' };
    devices.findOne.mockResolvedValue(device);

    await expect(
      assertDeviceOwnership(fakeDataSource(devices), 'device-1', 'user-1'),
    ).resolves.toBe(device);
  });

  it('throws NotFoundError when the device does not exist', async () => {
    const devices = makeDeviceRepo();
    devices.findOne.mockResolvedValue(null);

    await expect(
      assertDeviceOwnership(fakeDataSource(devices), 'missing', 'user-1'),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when the device belongs to another user', async () => {
    const devices = makeDeviceRepo();
    devices.findOne.mockResolvedValue({
      id: 'device-1',
      userId: 'someone-else',
    });

    await expect(
      assertDeviceOwnership(fakeDataSource(devices), 'device-1', 'user-1'),
    ).rejects.toThrow(ForbiddenError);
  });
});
