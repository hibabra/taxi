import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('driver_invitations')
@Index('idx_driver_invitations_groupement_id', ['groupementId'])
@Index('idx_driver_invitations_email', ['email'])
@Index('idx_driver_invitations_expires_at', ['expiresAt'])
export class DriverInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'groupement_id', type: 'uuid' })
  groupementId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ name: 'license_city', type: 'varchar', length: 128 })
  licenseCity!: string;

  @Column({ name: 'license_number', type: 'varchar', length: 64 })
  licenseNumber!: string;

  @Column({ name: 'invited_by_user_id', type: 'uuid', nullable: true })
  invitedByUserId!: string | null;

  @Column({ name: 'accepted_driver_id', type: 'uuid', nullable: true })
  acceptedDriverId!: string | null;

  @Column({ name: 'is_group_admin', type: 'boolean', default: false })
  isGroupAdmin!: boolean;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
