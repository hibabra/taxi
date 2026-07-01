import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { DispatchPolicy } from '../entities/groupement-settings.entity';

/**
 * DTO de mise à jour partielle des paramètres métier d'un groupement.
 * Endpoint dédié : PATCH /api/v1/groupements/:id/settings
 */
export class UpdateGroupementSettingsDto {
  @ApiPropertyOptional({ description: 'Durée max de sonnerie (secondes)', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  ringTimeoutSeconds?: number;

  @ApiPropertyOptional({
    description: 'Politique de distribution des courses',
    enum: DispatchPolicy,
    example: DispatchPolicy.STATION_FIRST,
  })
  @IsOptional()
  @IsEnum(DispatchPolicy)
  dispatchPolicy?: DispatchPolicy;

  @ApiPropertyOptional({ description: 'Horaires du service (JSON par jour)' })
  @IsOptional()
  @IsObject()
  serviceHours?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Texte RGPD affiché aux clients' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  gdprNotice?: string;

  @ApiPropertyOptional({ description: 'URL du logo' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  logoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Couleur primaire du backoffice (hex)', example: '#22C55E' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'La couleur doit être au format hex (#RRGGBB)' })
  primaryColor?: string;
}
