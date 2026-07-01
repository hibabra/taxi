import { ApiProperty } from '@nestjs/swagger';

export class DriverInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  groupementId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  licenseCity!: string;

  @ApiProperty()
  licenseNumber!: string;

  @ApiProperty()
  isGroupAdmin!: boolean;

  @ApiProperty()
  expiresAt!: Date;
}
