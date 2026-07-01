import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateDriverDto {
  @ApiPropertyOptional({ example: 'Karim' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Mansouri' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  lastName?: string;

  @ApiPropertyOptional({ example: 'TX-0042' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}-\d{4,6}$/, {
    message: 'Le matricule doit suivre le format XX-9999 à XX-999999',
  })
  matricule?: string;

  @ApiPropertyOptional({ example: '06 12 34 56 78' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @ApiPropertyOptional({ example: 'Sèvres' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  licenseCity?: string | null;

  @ApiPropertyOptional({ example: 'LIC-92310-0042' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  licenseNumber?: string | null;

  @ApiPropertyOptional({ example: 'FR', default: 'FR' })
  @IsOptional()
  @IsString()
  @Matches(/^FR$/i, { message: 'Seul le pays FR est supporté en Vague 1' })
  countryCode?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  joinedAt?: Date;

  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vehicleMake?: string;

  @ApiPropertyOptional({ example: 'Prius' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vehicleModel?: string;

  @ApiPropertyOptional({ example: 'AB-123-CD' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  vehicleRegistration?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1980)
  @Max(2100)
  vehicleYear?: number;
}
