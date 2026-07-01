import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('driver_positions')
export class DriverPosition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  groupementId!: string;

  @Index()
  @Column({ type: 'uuid' })
  driverId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: number;

  @Column({ type: 'int', nullable: true })
  accuracy!: number;

  @Column({ type: 'float', nullable: true })
  speed!: number;

  @Column({ type: 'float', nullable: true })
  heading!: number;

  @Column({ type: 'varchar', nullable: true })
  status!: string;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt!: Date;
}