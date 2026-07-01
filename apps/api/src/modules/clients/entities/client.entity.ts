import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ClientAddress } from './client-address.entity';

@Entity('clients')
@Index('idx_clients_groupement_id', ['groupementId'])
@Index('idx_clients_groupement_phone_unique', ['groupementId', 'phoneE164'], { unique: true })
@Index('idx_clients_is_blacklisted', ['isBlacklisted'])
@Index('idx_clients_archived_at', ['archivedAt'])
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'groupement_id', type: 'uuid' })
  groupementId!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 256 })
  fullName!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  gender!: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email!: string | null;

  @Column({ name: 'phone_e164', type: 'varchar', length: 20 })
  phoneE164!: string;

  @Column({ name: 'is_blacklisted', type: 'boolean', default: false })
  isBlacklisted!: boolean;

  @Column({ name: 'blacklist_reason', type: 'varchar', length: 512, nullable: true })
  blacklistReason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'anonymization_requested_at', type: 'timestamptz', nullable: true })
  anonymizationRequestedAt!: Date | null;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ClientAddress, (address) => address.client)
  addresses!: ClientAddress[];
}
