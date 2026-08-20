import { DataSource, LessThan } from 'typeorm';
import { assertDeviceOwnership } from '../devices/devices.logic';
import { HealthReading } from '../entities/health-reading.entity';

export interface HealthReadingInput {
  clientUuid: string;
  heartRate: number;
  spo2: number;
  steps: number;
  recordedAt: string;
}

/// Saving a batch of readings
/// First verify the device ownership based on device id and userId
/// Insert data, if an entry with same client id and device id already exist, skip it as it is retry
export async function ingestReadings(
  dataSource: DataSource,
  userId: string,
  deviceId: string,
  readings: HealthReadingInput[],
): Promise<{ accepted: string[] }> {
  await assertDeviceOwnership(dataSource, deviceId, userId);

  await dataSource
    .getRepository(HealthReading)
    .createQueryBuilder()
    .insert()
    .into(HealthReading)
    .values(
      readings.map((r) => ({
        deviceId,
        clientUuid: r.clientUuid,
        heartRate: r.heartRate,
        spo2: r.spo2,
        steps: r.steps,
        recordedAt: r.recordedAt,
      })),
    )
    .orIgnore()
    .execute();

  return { accepted: readings.map((r) => r.clientUuid) };
}

// Browsing raw history, use default max cap, otherwise use fallback which is 50
export async function findReadings(
  dataSource: DataSource,
  userId: string,
  deviceId: string,
  options: { before?: string; limit?: number },
): Promise<{ items: HealthReading[]; nextCursor: string | null }> {
  await assertDeviceOwnership(dataSource, deviceId, userId);

  const limit = options.limit ?? 50;
  const items = await dataSource.getRepository(HealthReading).find({
    where: {
      deviceId,
      ...(options.before
        ? { recordedAt: LessThan(new Date(options.before)) }
        : {}),
    },
    order: { recordedAt: 'DESC' },
    take: limit,
  });

  const nextCursor =
    items.length === limit
      ? items[items.length - 1].recordedAt.toISOString()
      : null;
  return { items, nextCursor };
}

interface SummaryRow {
  bucket: string;
  avgHeartRate: string | null;
  minHeartRate: string | null;
  maxHeartRate: string | null;
  avgSpo2: string | null;
  steps: string | null;
}

// Daily/weekly averages
export async function summarizeReadings(
  dataSource: DataSource,
  userId: string,
  deviceId: string,
  range: 'daily' | 'weekly',
) {
  await assertDeviceOwnership(dataSource, deviceId, userId);

  // range is validated by zod against ['daily','weekly'] before reaching
  // here, so interpolating the bucket keyword is not user-controlled SQL.
  const bucket = range === 'weekly' ? 'week' : 'day';

  const rows = await dataSource
    .getRepository(HealthReading)
    .createQueryBuilder('r')
    .select(`date_trunc('${bucket}', r.recorded_at)`, 'bucket')
    .addSelect('avg(r.heart_rate)', 'avgHeartRate') // avg heart rate
    .addSelect('min(r.heart_rate)', 'minHeartRate') /// min hear rate
    .addSelect('max(r.heart_rate)', 'maxHeartRate') // max heart rate
    .addSelect('avg(r.spo2)', 'avgSpo2') // avg for spo2
    .addSelect('max(r.steps)', 'steps') // max for spo2
    .where('r.device_id = :deviceId', { deviceId })
    .groupBy('bucket')
    .orderBy('bucket', 'ASC')
    .getRawMany<SummaryRow>();

  return rows.map((row) => ({
    bucket: row.bucket,
    avgHeartRate: round1(row.avgHeartRate),
    minHeartRate: toInt(row.minHeartRate),
    maxHeartRate: toInt(row.maxHeartRate),
    avgSpo2: round1(row.avgSpo2),
    steps: toInt(row.steps),
  }));
}

function round1(value: string | null): number | null {
  return value === null ? null : Math.round(parseFloat(value) * 10) / 10;
}

function toInt(value: string | null): number | null {
  return value === null ? null : parseInt(value, 10);
}
