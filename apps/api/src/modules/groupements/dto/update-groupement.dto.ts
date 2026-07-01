import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { StationType } from '../../stations/stations.constants';

class PolygonPointDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}

/**
 * DTO de mise à jour partielle d'un groupement.
 * Tous les champs sont optionnels (PATCH).
 */
export class UpdateGroupementDto {
  @ApiPropertyOptional({ description: 'Nom commercial', example: 'Taxi Kiwi Premium' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name?: string;

  @ApiPropertyOptional({ description: 'Code public unique', example: 'TAXI-KIWI' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Z0-9](?:[A-Z0-9-]{0,62}[A-Z0-9])?$/, {
    message: 'Le code groupement doit contenir lettres majuscules, chiffres et tirets',
  })
  code?: string;

  @ApiPropertyOptional({ description: 'Adresse postale', example: '15 avenue de la Paix' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  address?: string;

  @ApiPropertyOptional({ description: 'Code postal', example: '92310' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Ville', example: 'Sèvres' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  city?: string;

  @ApiPropertyOptional({ description: 'Email de contact', example: 'info@taxikiwi.fr' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string;

  @ApiPropertyOptional({ description: 'Téléphone de contact', example: '+33145345679' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'Zone de chalandise' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  serviceArea?: string;

  @ApiPropertyOptional({ description: 'Activer ou désactiver le groupement' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // ── Zone géographique ─────────────────────────────────

  @ApiPropertyOptional({ description: 'Type de zone géographique', enum: StationType })
  @IsOptional()
  @IsEnum(StationType)
  zoneType?: StationType | null;

  @ApiPropertyOptional({ description: 'Latitude du centre de la zone', example: 48.8236 })
  @IsOptional()
  @IsNumber()
  zoneLatitude?: number | null;

  @ApiPropertyOptional({ description: 'Longitude du centre de la zone', example: 2.2107 })
  @IsOptional()
  @IsNumber()
  zoneLongitude?: number | null;

  @ApiPropertyOptional({ description: 'Rayon de la zone en mètres (CIRCLE)', example: 2000 })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100000)
  zoneRadiusMeters?: number | null;

  @ApiPropertyOptional({
    description: 'Points du polygone de la zone',
    type: [PolygonPointDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolygonPointDto)
  zonePolygonPoints?: { lat: number; lng: number }[] | null;

  @ApiPropertyOptional({ description: 'Couleur de la zone (hex)', example: '#3b82f6' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'La couleur doit être au format hex (#RRGGBB)' })
  zoneColor?: string;
}
