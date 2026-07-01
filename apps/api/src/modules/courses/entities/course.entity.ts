import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ValueTransformer,
} from 'typeorm';

import { Client } from '../../clients/entities/client.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { CourseStatus } from '../types/course-status.enum';

const numberTransformer: ValueTransformer = {
  from: (value: number | string): number => Number(value),
  to: (value: number): number => value,
};

const nullableNumberTransformer: ValueTransformer = {
  from: (value: null | number | string): null | number => (value === null ? null : Number(value)),
  to: (value: null | number): null | number => value,
};

@Entity('courses')
@Index('idx_courses_groupement_id', ['groupementId'])
@Index('idx_courses_groupement_started_at', ['groupementId', 'startedAt'])
@Index('idx_courses_groupement_driver_started_at', ['groupementId', 'driverId', 'startedAt'])
@Index('idx_courses_groupement_client_started_at', ['groupementId', 'clientId', 'startedAt'])
@Index('idx_courses_groupement_status', ['groupementId', 'status'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'groupement_id', type: 'uuid' })
  groupementId!: string;

  @Column({ name: 'client_id', nullable: true, type: 'uuid' })
  clientId!: null | string;

  @Column({ name: 'driver_id', type: 'uuid' })
  driverId!: string;

  @Column({ name: 'pickup_address', type: 'text' })
  pickupAddress!: string;

  @Column({ name: 'dropoff_address', type: 'text' })
  dropoffAddress!: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'duration_minutes', type: 'integer' })
  durationMinutes!: number;

  @Column({
    name: 'distance_km',
    precision: 8,
    scale: 2,
    transformer: numberTransformer,
    type: 'numeric',
  })
  distanceKm!: number;

  @Column({
    name: 'amount_eur',
    nullable: true,
    precision: 10,
    scale: 2,
    transformer: nullableNumberTransformer,
    type: 'numeric',
  })
  amountEur!: null | number;

  @Column({ default: CourseStatus.COMPLETED, length: 32, type: 'varchar' })
  status!: CourseStatus;

  @Column({ nullable: true, type: 'text' })
  note!: null | string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Driver, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'driver_id' })
  driver!: Driver;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client!: Client | null;
}
