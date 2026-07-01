import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateGroupementAdminInvitationDto {
  @ApiProperty({
    description: 'Email du premier admin de groupement',
    example: 'admin@taxikiwi.fr',
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ description: 'Ville de licence du chauffeur admin', example: 'Sèvres' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  licenseCity!: string;

  @ApiProperty({ description: 'Numéro de licence du chauffeur admin', example: 'LIC-92310-0001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  licenseNumber!: string;
}

/**
 * DTO de création d'un groupement.
 *
 * La création est atomique : elle initialise le Groupement,
 * son GroupementSettings avec les valeurs par défaut.
 * Aucun admin n'est créé librement : le premier admin est invite
 * comme chauffeur et recevra automatiquement le role ADMIN a
 * l'acceptation de son invitation.
 */
export class CreateGroupementDto {
  @ApiProperty({ description: 'Nom commercial du groupement', example: 'Taxi Kiwi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name!: string;

  @ApiPropertyOptional({
    description: 'Code public unique pour le login chauffeur/admin',
    example: 'TAXI-KIWI',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Z0-9](?:[A-Z0-9-]{0,62}[A-Z0-9])?$/, {
    message: 'Le code groupement doit contenir lettres majuscules, chiffres et tirets',
  })
  code?: string;

  @ApiProperty({ description: 'Adresse postale complète', example: '12 rue de Sèvres' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  address!: string;

  @ApiProperty({ description: 'Code postal', example: '92310' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  postalCode!: string;

  @ApiProperty({ description: 'Ville', example: 'Sèvres' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  city!: string;

  @ApiProperty({ description: 'Email de contact', example: 'contact@taxikiwi.fr' })
  @IsEmail()
  @MaxLength(254)
  contactEmail!: string;

  @ApiProperty({ description: 'Téléphone de contact', example: '+33145345678' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  contactPhone!: string;

  @ApiPropertyOptional({ description: 'Zone de chalandise', example: 'Sèvres, Chaville, Meudon' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  serviceArea?: string;

  @ApiProperty({
    description: 'Invitation obligatoire du premier chauffeur admin du groupement',
    type: CreateGroupementAdminInvitationDto,
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateGroupementAdminInvitationDto)
  initialAdmin!: CreateGroupementAdminInvitationDto;
}
