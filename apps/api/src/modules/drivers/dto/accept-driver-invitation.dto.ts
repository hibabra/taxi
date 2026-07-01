import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AcceptDriverInvitationDto {
  @ApiProperty({ example: 'StrongPassword12345!', minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Karim' })
  @IsString()
  @MaxLength(128)
  firstName!: string;

  @ApiProperty({ example: 'Mansouri' })
  @IsString()
  @MaxLength(128)
  lastName!: string;

  @ApiProperty({ example: '06 12 34 56 78' })
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional({ example: 'FR', default: 'FR' })
  @IsOptional()
  @IsString()
  @Matches(/^FR$/i, { message: 'Seul le pays FR est supporté en Vague 1' })
  countryCode?: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @MaxLength(64)
  vehicleMake!: string;

  @ApiProperty({ example: 'Prius' })
  @IsString()
  @MaxLength(64)
  vehicleModel!: string;

  @ApiProperty({ example: 'AB-123-CD' })
  @IsString()
  @MaxLength(32)
  vehicleRegistration!: string;

  @ApiProperty({ example: 2022 })
  @Type(() => Number)
  @IsInt()
  @Min(1980)
  @Max(2100)
  vehicleYear!: number;
}
