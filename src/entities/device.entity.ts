import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { HealthReading } from './health-reading.entity';

/// Table reference in form of entity for devices
@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The vendor-facing identifier, e.g. "FITRING-001" — distinct from our own `id`. */
  @Column({ name: 'external_id', unique: true })
  externalId: string;

  @Column()
  name: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => HealthReading, (reading) => reading.device)
  readings: HealthReading[];
}
