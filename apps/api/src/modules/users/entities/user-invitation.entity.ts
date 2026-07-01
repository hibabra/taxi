import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserRole } from '../../auth/types/role.enum';

export enum UserInvitationType {
  INVITATION = 'INVITATION',
  RESET_PASSWORD = 'RESET_PASSWORD',
}

@Entity('user_invitations')
@Index('idx_user_invitations_groupement_id', ['groupementId'])
@Index('idx_user_invitations_email', ['email'])
@Index('idx_user_invitations_expires_at', ['expiresAt'])
export class UserInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'groupement_id', type: 'uuid' })
  groupementId!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash!: string;

  @Column({ type: 'varchar', length: 32, default: UserInvitationType.INVITATION })
  type!: UserInvitationType;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 128 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 128 })
  lastName!: string;

  @Column({ name: 'phone_e164', type: 'varchar', length: 20, nullable: true })
  phoneE164!: string | null;

  @Column({ type: 'text', array: true, default: () => `ARRAY[]::text[]` })
  roles!: UserRole[];

  @Column({ name: 'invited_by_user_id', type: 'uuid', nullable: true })
  invitedByUserId!: string | null;

  @Column({ name: 'accepted_user_id', type: 'uuid', nullable: true })
  acceptedUserId!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
