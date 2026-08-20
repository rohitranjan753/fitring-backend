import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Device } from './device.entity';

/**
 * `(device_id, client_uuid)` is the idempotency key the mobile app's sync
 * queue relies on — a retried POST for the same reading is a no-op, not a
 * duplicate row.
 */
@Entity('health_readings')
@Unique('uq_health_readings_device_client_uuid', ['deviceId', 'clientUuid'])
@Index('idx_health_readings_device_recorded_at', ['deviceId', 'recordedAt'])
export class HealthReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @ManyToOne(() => Device, (device) => device.readings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column({ name: 'client_uuid' })
  clientUuid: string;

  @Column({ name: 'heart_rate', type: 'int' })
  heartRate: number;

  @Column({ type: 'int' })
  spo2: number;

  @Column({ type: 'int' })
  steps: number;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
