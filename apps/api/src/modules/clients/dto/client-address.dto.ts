import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateClientAddressDto {
  @ApiProperty({ example: 'Domicile' })
  @IsString()
  @MaxLength(128)
  label!: string;

  @ApiProperty({ example: '12 rue de Sèvres' })
  @IsString()
  @MaxLength(512)
  addressLine1!: string;

  @ApiPropertyOptional({ example: 'Bâtiment B' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  addressLine2?: string | null;

  @ApiProperty({ example: '92310' })
  @IsString()
  @MaxLength(16)
  postalCode!: string;

  @ApiProperty({ example: 'Sèvres' })
  @IsString()
  @MaxLength(128)
  city!: string;

  @ApiPropertyOptional({ example: 'FR', default: 'FR' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateClientAddressDto {
  @ApiPropertyOptional({ example: 'Domicile' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;

  @ApiPropertyOptional({ example: '12 rue de Sèvres' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Bâtiment B' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  addressLine2?: string | null;

  @ApiPropertyOptional({ example: '92310' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Sèvres' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  city?: string;

  @ApiPropertyOptional({ example: 'FR' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
