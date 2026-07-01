import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { GroupementSettings } from './groupement-settings.entity';
import { StationType } from '../../stations/stations.constants';

/**
 * Entité Groupement — table maîtresse multi-tenant.
 *
 * Représente un groupement de taxis client de la plateforme.
 * C'est le point d'ancrage de toute la donnée métier :
 * Users, Drivers, Clients, Courses pointent tous vers un Groupement.
 *
 * PAS de RLS sur cette table car le groupement est l'objet
 * des opérations, pas le filtre. Toutes les opérations sont
 * réservées au SUPER_ADMIN.
 */
@Entity('groupements')
export class Groupement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ── Identité ────────────────────────────────────────────

  /** Nom commercial du groupement (ex: "Taxi Kiwi"). Unique. */
  @Column({ type: 'varchar', length: 128, unique: true })
  name!: string;

  /** Code public unique utilisé au login chauffeur/admin (ex: "TAXI-KIWI"). */
  @Column({ type: 'varchar', length: 64, unique: true })
  code!: string;

  // ── Coordonnées ─────────────────────────────────────────

  /** Adresse postale complète (rue + numéro). */
  @Column({ type: 'varchar', length: 512 })
  address!: string;

  /** Code postal. */
  @Column({ type: 'varchar', length: 10, name: 'postal_code' })
  postalCode!: string;

  /** Ville. */
  @Column({ type: 'varchar', length: 128 })
  city!: string;

  /** Email de contact du groupement. */
  @Column({ type: 'varchar', length: 256, name: 'contact_email' })
  contactEmail!: string;

  /** Téléphone de contact. */
  @Column({ type: 'varchar', length: 20, name: 'contact_phone' })
  contactPhone!: string;

  /** Zone de chalandise en texte libre (ex: "Sèvres, Ville-d'Avray, Chaville, Meudon"). */
  @Column({ type: 'text', name: 'service_area', nullable: true })
  serviceArea!: string | null;

  // ── Zone géographique ───────────────────────────────────

  /** Type géométrique de la zone : CIRCLE ou POLYGON. null = non définie. */
  @Column({
    type: 'enum',
    enum: StationType,
    name: 'zone_type',
    nullable: true,
    default: null,
  })
  zoneType!: StationType | null;

  /** Latitude du centre (CIRCLE) ou centroïde de référence. */
  @Column({ type: 'decimal', precision: 10, scale: 7, name: 'zone_latitude', nullable: true })
  zoneLatitude!: number | null;

  /** Longitude du centre (CIRCLE) ou centroïde de référence. */
  @Column({ type: 'decimal', precision: 10, scale: 7, name: 'zone_longitude', nullable: true })
  zoneLongitude!: number | null;

  /** Rayon en mètres — utilisé SEULEMENT si zoneType = CIRCLE. */
  @Column({ type: 'int', name: 'zone_radius_meters', nullable: true })
  zoneRadiusMeters!: number | null;

  /** Points du polygone — utilisé SEULEMENT si zoneType = POLYGON. */
  @Column({ type: 'jsonb', name: 'zone_polygon_points', nullable: true })
  zonePolygonPoints!: { lat: number; lng: number }[] | null;

  /** Couleur d'affichage de la zone sur la carte (hex). */
  @Column({ type: 'varchar', length: 7, name: 'zone_color', default: '#3b82f6' })
  zoneColor!: string;

  // ── État ─────────────────────────────────────────────────

  /**
   * Actif ou désactivé.
   * Un groupement désactivé empêche la connexion de ses utilisateurs.
   * Soft delete : on ne supprime jamais physiquement.
   */
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  /**
   * Prochaine valeur numérique utilisée pour générer les identifiants chauffeurs
   * lisibles dans ce groupement : T1, T2, T3...
   */
  @Column({ type: 'integer', name: 'driver_identifier_next', default: 1 })
  driverIdentifierNext!: number;

  // ── Relations ───────────────────────────────────────────

  @OneToOne(() => GroupementSettings, (settings) => settings.groupement, {
    cascade: true,
    eager: true,
  })
  settings!: GroupementSettings;

  // ── Timestamps ──────────────────────────────────────────

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
