import { DataSource } from 'typeorm';
import { Device } from '../entities/device.entity';
import { HealthReading } from '../entities/health-reading.entity';
import { ForbiddenError } from '../errors/http-error';
import {
  HealthReadingInput,
  ingestReadings,
  summarizeReadings,
} from './health.logic';

interface MockQueryBuilder {
  insert: jest.Mock;
  into: jest.Mock;
  values: jest.Mock;
  orIgnore: jest.Mock;
  execute: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  groupBy: jest.Mock;
  orderBy: jest.Mock;
  getRawMany: jest.Mock;
}

function makeQueryBuilder(): MockQueryBuilder {
  const chainMethods: (keyof MockQueryBuilder)[] = [
    'insert',
    'into',
    'values',
    'orIgnore',
    'select',
    'addSelect',
    'where',
    'groupBy',
    'orderBy',
  ];
  const qb = {} as MockQueryBuilder;
  for (const method of chainMethods) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.execute = jest.fn().mockResolvedValue(undefined);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return qb;
}

/** Standing in for a real DataSource: routes getRepository(Device) to a
 * fixed device owner, and getRepository(HealthReading) to our query-builder
 * mock — the same seam ingestReadings/summarizeReadings actually use. */
function fakeDataSource(
  qb: MockQueryBuilder,
  deviceOwnerId = 'user-1',
): DataSource {
  return {
    getRepository: (entity: unknown) => {
      if (entity === Device) {
        return {
          findOne: jest
            .fn()
            .mockResolvedValue({ id: 'device-1', userId: deviceOwnerId }),
        };
      }
      if (entity === HealthReading) {
        return { createQueryBuilder: () => qb };
      }
      throw new Error('unexpected entity requested in test');
    },
  } as unknown as DataSource;
}

function reading(clientUuid: string): HealthReadingInput {
  return {
    clientUuid,
    heartRate: 70,
    spo2: 97,
    steps: 100,
    recordedAt: '2026-08-17T10:00:00Z',
  };
}

describe('health.logic ingestReadings', () => {
  it('inserts with ON CONFLICT DO NOTHING so a retried batch is a no-op, not a duplicate', async () => {
    const qb = makeQueryBuilder();

    await ingestReadings(fakeDataSource(qb), 'user-1', 'device-1', [
      reading('r1'),
      reading('r2'),
    ]);

    expect(qb.orIgnore).toHaveBeenCalled();
    expect(qb.values).toHaveBeenCalledWith([
      expect.objectContaining({ deviceId: 'device-1', clientUuid: 'r1' }),
      expect.objectContaining({ deviceId: 'device-1', clientUuid: 'r2' }),
    ]);
  });

  it('reports every submitted clientUuid as accepted — duplicates included — so the client always dequeues', async () => {
    const result = await ingestReadings(
      fakeDataSource(makeQueryBuilder()),
      'user-1',
      'device-1',
      [reading('r1'), reading('r2')],
    );

    expect(result).toEqual({ accepted: ['r1', 'r2'] });
  });

  it('refuses to ingest into a device owned by a different user', async () => {
    const dataSource = fakeDataSource(makeQueryBuilder(), 'someone-else');

    await expect(
      ingestReadings(dataSource, 'user-1', 'device-1', [reading('r1')]),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe('health.logic summarizeReadings', () => {
  it('rounds averages to one decimal and keeps extremes as integers', async () => {
    const qb = makeQueryBuilder();
    qb.getRawMany.mockResolvedValue([
      {
        bucket: '2026-08-17T00:00:00.000Z',
        avgHeartRate: '77.666',
        minHeartRate: '60',
        maxHeartRate: '95',
        avgSpo2: '96.5',
        steps: '6420',
      },
    ]);

    const result = await summarizeReadings(
      fakeDataSource(qb),
      'user-1',
      'device-1',
      'daily',
    );

    expect(result).toEqual([
      {
        bucket: '2026-08-17T00:00:00.000Z',
        avgHeartRate: 77.7,
        minHeartRate: 60,
        maxHeartRate: 95,
        avgSpo2: 96.5,
        steps: 6420,
      },
    ]);
  });
});
