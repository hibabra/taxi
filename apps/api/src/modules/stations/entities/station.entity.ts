import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { StationType } from '../stations.constants';

@Entity('stations')
export class Station {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Multi-tenant
  @Index()
  @Column({ name: 'groupement_id', type: 'uuid' })
  groupementId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  // ── Type de zone : cercle ou polygone ──────────────────────
  @Column({
    type: 'enum',
    enum: StationType,
    default: StationType.CIRCLE,
  })
  type!: StationType;

  // ── Cercle : centre + rayon ────────────────────────────────
  // Latitude/longitude du centre (utilisé pour les deux types)
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: number | null;

  // Rayon en mètres — utilisé SEULEMENT si type = CIRCLE
  @Column({ name: 'radius_meters', type: 'int', nullable: true, default: null })
  radiusMeters!: number | null;

  // ── Polygone : liste de points GPS ────────────────────────
  // Stocké en JSON : [{ lat: 48.85, lng: 2.35 }, ...]
  // Utilisé SEULEMENT si type = POLYGON
  @Column({ name: 'polygon_points', type: 'jsonb', nullable: true })
  polygonPoints!: { lat: number; lng: number }[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
