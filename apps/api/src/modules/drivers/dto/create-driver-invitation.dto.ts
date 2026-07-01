import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CreateDriverInvitationDto {
  @ApiProperty({ example: 'karim.mansouri@taxikiwi.local' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: 'Sèvres' })
  @IsString()
  @MaxLength(128)
  licenseCity!: string;

  @ApiProperty({ example: 'LIC-92310-0042' })
  @IsString()
  @MaxLength(64)
  licenseNumber!: string;
}
