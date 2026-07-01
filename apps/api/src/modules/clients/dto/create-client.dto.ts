import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CreateClientAddressDto } from './client-address.dto';

export class CreateClientDto {
  @ApiProperty({ example: 'Nadia Benali' })
  @IsString()
  @MaxLength(256)
  fullName!: string;

  @ApiPropertyOptional({ example: 'female' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string | null;

  @ApiPropertyOptional({ example: 'nadia.benali@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiProperty({ example: '06 12 34 56 78' })
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional({ example: 'FR', default: 'FR' })
  @IsOptional()
  @IsString()
  @Matches(/^FR$/i, { message: 'Seul le pays FR est supporté en Vague 1' })
  countryCode?: string;

  @ApiPropertyOptional({ example: 'Préfère un grand véhicule.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ type: [CreateClientAddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClientAddressDto)
  addresses?: CreateClientAddressDto[];
}
