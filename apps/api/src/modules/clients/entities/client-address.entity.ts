import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Client } from './client.entity';

@Entity('client_addresses')
@Index('idx_client_addresses_groupement_id', ['groupementId'])
@Index('idx_client_addresses_client_id', ['clientId'])
export class ClientAddress {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'groupement_id', type: 'uuid' })
  groupementId!: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId!: string;

  @Column({ type: 'varchar', length: 128 })
  label!: string;

  @Column({ name: 'address_line1', type: 'varchar', length: 512 })
  addressLine1!: string;

  @Column({ name: 'address_line2', type: 'varchar', length: 512, nullable: true })
  addressLine2!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 16 })
  postalCode!: string;

  @Column({ type: 'varchar', length: 128 })
  city!: string;

  @Column({ name: 'country_code', type: 'char', length: 2, default: 'FR' })
  countryCode!: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Client, (client) => client.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client!: Client;
}
