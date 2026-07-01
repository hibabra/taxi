import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { UserRole } from '../../auth/types/role.enum';

export class CreateUserInvitationDto {
  @ApiProperty({ example: 'Nadia' })
  @IsString()
  @MaxLength(128)
  firstName!: string;

  @ApiProperty({ example: 'Benali' })
  @IsString()
  @MaxLength(128)
  lastName!: string;

  @ApiProperty({ example: 'nadia.benali@taxikiwi.local' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: '+33612345678' })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Le téléphone doit être au format E.164' })
  phoneE164?: string;

  @ApiProperty({ enum: UserRole, isArray: true, example: [UserRole.ADMIN] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(UserRole, { each: true })
  roles!: UserRole[];
}
