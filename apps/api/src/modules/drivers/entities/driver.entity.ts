import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DriverStatus } from '../types/driver-status.enum';

@Entity('drivers')
@Index('idx_drivers_groupement_id', ['groupementId'])
@Index('idx_drivers_status', ['status'])
@Index('idx_drivers_groupement_matricule_unique', ['groupementId', 'matricule'], {
  unique: true,
})
@Index('idx_drivers_groupement_identifier_unique', ['groupementId', 'driverIdentifier'], {
  unique: true,
})
@Index('idx_drivers_user_id_unique', ['userId'], {
  unique: true,
  where: '"user_id" IS NOT NULL',
})
@Index('idx_drivers_one_group_admin', ['groupementId'], {
  unique: true,
  where: '"is_group_admin" = true',
})
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'groupement_id', type: 'uuid' })
  groupementId!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'driver_identifier', type: 'varchar', length: 16 })
  driverIdentifier!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 128 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 128 })
  lastName!: string;

  @Column({ type: 'varchar', length: 16 })
  matricule!: string;

  @Column({ name: 'phone_e164', type: 'varchar', length: 20 })
  phoneE164!: string;

  @Column({ name: 'license_city', type: 'varchar', length: 128, nullable: true })
  licenseCity!: string | null;

  @Column({ name: 'license_number', type: 'varchar', length: 64, nullable: true })
  licenseNumber!: string | null;

  @Column({ name: 'joined_at', type: 'timestamptz' })
  joinedAt!: Date;

  @Column({ name: 'vehicle_make', type: 'varchar', length: 64 })
  vehicleMake!: string;

  @Column({ name: 'vehicle_model', type: 'varchar', length: 64 })
  vehicleModel!: string;

  @Column({ name: 'vehicle_registration', type: 'varchar', length: 32 })
  vehicleRegistration!: string;

  @Column({ name: 'vehicle_year', type: 'integer' })
  vehicleYear!: number;

  @Column({ type: 'varchar', length: 32, default: DriverStatus.ACTIVE })
  status!: DriverStatus;

  @Column({ name: 'status_reason', type: 'varchar', length: 512, nullable: true })
  statusReason!: string | null;

  @Column({ name: 'status_changed_at', type: 'timestamptz' })
  statusChangedAt!: Date;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt!: Date | null;

  @Column({ name: 'offboarded_at', type: 'timestamptz', nullable: true })
  offboardedAt!: Date | null;

  @Column({ name: 'is_group_admin', type: 'boolean', default: false })
  isGroupAdmin!: boolean;

  @Column({ name: 'mobile_activated_at', type: 'timestamptz', nullable: true })
  mobileActivatedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
