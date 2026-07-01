import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Groupement } from './groupement.entity';

/**
 * Politiques de tour de rôle pour la distribution des courses.
 * Détermine l'ordre dans lequel les chauffeurs sont sollicités.
 */
export enum DispatchPolicy {
  /** Les chauffeurs en station sont sollicités en premier. */
  STATION_FIRST = 'STATION_FIRST',
  /** Les chauffeurs libres (en maraude) sont sollicités en premier. */
  FREE_FIRST = 'FREE_FIRST',
  /** Le chauffeur le plus proche géographiquement est sollicité en premier. */
  DISTANCE_FIRST = 'DISTANCE_FIRST',
}

/**
 * Structure des horaires d'ouverture par jour de la semaine.
 * Stockée en JSONB dans PostgreSQL.
 */
export interface DaySchedule {
  /** Jour ouvert au service. */
  isOpen: boolean;
  /** Heure d'ouverture au format HH:mm (ex: "06:00"). */
  openTime: string;
  /** Heure de fermeture au format HH:mm (ex: "22:00"). */
  closeTime: string;
}

export interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

/**
 * Paramètres de configuration métier d'un groupement.
 *
 * Séparée de l'entité Groupement pour deux raisons :
 * 1. Peut évoluer indépendamment (ajouter un paramètre = migration légère)
 * 2. Souvent lue seule (sans la fiche identitaire complète)
 */
@Entity('groupement_settings')
export class GroupementSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'groupement_id', unique: true })
  groupementId!: string;

  @OneToOne(() => Groupement, (groupement) => groupement.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupement_id' })
  groupement!: Groupement;

  /**
   * Durée max de sonnerie avant bascule vers le chauffeur suivant (en secondes).
   * Défaut: 30 secondes.
   */
  @Column({ type: 'int', name: 'ring_timeout_seconds', default: 30 })
  ringTimeoutSeconds!: number;

  /**
   * Politique de distribution des courses.
   * Défaut: STATION_FIRST (les chauffeurs en station sont prioritaires).
   */
  @Column({
    type: 'varchar',
    length: 32,
    name: 'dispatch_policy',
    default: DispatchPolicy.STATION_FIRST,
  })
  dispatchPolicy!: DispatchPolicy;

  /**
   * Horaires du service par jour de la semaine.
   * Stockées en JSONB pour flexibilité.
   */
  @Column({
    type: 'jsonb',
    name: 'service_hours',
    default: () => `'${JSON.stringify(defaultServiceHours())}'`,
  })
  serviceHours!: WeekSchedule;

  /** Texte RGPD affiché aux clients. */
  @Column({ type: 'text', name: 'gdpr_notice', default: '' })
  gdprNotice!: string;

  /** URL du logo du groupement (pour personnalisation backoffice). */
  @Column({ type: 'varchar', length: 512, name: 'logo_url', nullable: true })
  logoUrl!: string | null;

  /** Couleur primaire du backoffice (hex, ex: "#22C55E"). */
  @Column({ type: 'varchar', length: 7, name: 'primary_color', default: '#22C55E' })
  primaryColor!: string;
}

/**
 * Horaires par défaut : ouvert 7j/7 de 06:00 à 22:00.
 * Utilisé comme valeur par défaut JSONB dans la migration.
 */
export function defaultServiceHours(): WeekSchedule {
  const day: DaySchedule = { closeTime: '22:00', isOpen: true, openTime: '06:00' };
  return {
    friday: { ...day },
    monday: { ...day },
    saturday: { ...day },
    sunday: { ...day },
    thursday: { ...day },
    tuesday: { ...day },
    wednesday: { ...day },
  };
}
