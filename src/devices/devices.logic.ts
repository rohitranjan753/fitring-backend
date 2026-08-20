import { DataSource } from 'typeorm';
import { Device } from '../entities/device.entity';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/http-error';

/// As it has only two methods post and get
/// That will be create device and find device



export async function createDevice(
  dataSource: DataSource,
  userId: string,
  data: { externalId: string; name: string },
): Promise<Device> {
  const devices = dataSource.getRepository(Device);
  const existing = await devices.findOne({
    where: { externalId: data.externalId },
  });
  if (existing) {
    throw new ConflictError(
      `Device "${data.externalId}" is already registered`,
    );
  }
  return devices.save(devices.create({ ...data, userId }));
}

export function findDevicesForUser(
  dataSource: DataSource,
  userId: string,
): Promise<Device[]> {
  return dataSource
    .getRepository(Device)
    .find({ where: { userId }, order: { createdAt: 'DESC' } });
}

// Every health-adjacent route that takes a deviceId calls this first.
export async function assertDeviceOwnership(
  dataSource: DataSource,
  deviceId: string,
  userId: string,
): Promise<Device> {
  const device = await dataSource
    .getRepository(Device)
    .findOne({ where: { id: deviceId } });
  if (!device) throw new NotFoundError('Device not found');
  if (device.userId !== userId)
    throw new ForbiddenError('Device belongs to another user');
  return device;
}
