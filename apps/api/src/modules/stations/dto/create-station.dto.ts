import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

import { StationType } from '../stations.constants';

// ── Point GPS pour le polygone ───────────────────────────────
export class PolygonPointDto {
  @ApiProperty({ example: 48.8566 })
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: 2.3522 })
  @IsNumber()
  lng!: number;
}

export class CreateStationDto {
  // ── Nom ───────────────────────────────────────────────────
  @ApiProperty({ example: 'Gare du Nord', description: 'Nom de la station' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Station principale devant l entrée nord' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: '18 Rue de Dunkerque, 75010 Paris' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  // ── Type : CIRCLE ou POLYGON ──────────────────────────────
  @ApiProperty({ enum: StationType, example: StationType.CIRCLE })
  @IsEnum(StationType)
  type!: StationType;

  // ── Champs CIRCLE (requis seulement si type = CIRCLE) ─────
  @ApiPropertyOptional({ example: 48.8566, description: 'Latitude du centre (CIRCLE)' })
  @ValidateIf((o: CreateStationDto) => o.type === StationType.CIRCLE)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 2.3522, description: 'Longitude du centre (CIRCLE)' })
  @ValidateIf((o: CreateStationDto) => o.type === StationType.CIRCLE)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: 50, description: 'Rayon en mètres (CIRCLE, défaut: 50m)' })
  @ValidateIf((o: CreateStationDto) => o.type === StationType.CIRCLE)
  @IsInt()
  @Min(10)
  @Max(500)
  radiusMeters?: number;

  // ── Champs POLYGON (requis seulement si type = POLYGON) ───
  @ApiPropertyOptional({
    type: [PolygonPointDto],
    description: 'Points du polygone (POLYGON, minimum 3 points)',
    example: [
      { lat: 48.856, lng: 2.352 },
      { lat: 48.857, lng: 2.353 },
      { lat: 48.855, lng: 2.354 },
    ],
  })
  @ValidateIf((o: CreateStationDto) => o.type === StationType.POLYGON)
  @IsArray()
  @ArrayMinSize(3)
  @ValidateNested({ each: true })
  @Type(() => PolygonPointDto)
  polygonPoints?: PolygonPointDto[];
}
