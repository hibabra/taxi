import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('driver_positions')
export class DriverPosition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'groupement_id', type: 'uuid' })
  groupementId!: string;

  @Index()
  @Column({ name: 'driver_id', type: 'uuid' })
  driverId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude!: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  accuracy!: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  speed!: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  heading!: number | null;

  @Column({
    type: 'enum',
    enum: ['LIBRE', 'COURSE', 'ABSENT', 'HORS_SERVICE', 'STATION'],
    nullable: true,
  })
  status!: string | null;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt!: Date;
}
