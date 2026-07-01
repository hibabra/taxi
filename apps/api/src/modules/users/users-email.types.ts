import { UserRole } from '../auth/types/role.enum';

export interface SendInvitationEmailJob {
  email: string;
  expiresAt: string;
  firstName: string;
  groupementId: string;
  invitationToken: string;
  lastName: string;
  roles: UserRole[];
}

export interface SendResetPasswordEmailJob {
  email: string;
  expiresAt: string;
  firstName: string;
  groupementId: string;
  resetToken: string;
}

export interface SendDriverInvitationEmailJob {
  email: string;
  expiresAt: string;
  groupementId: string;
  invitationToken: string;
  licenseCity: string;
  licenseNumber: string;
}

export type UsersEmailJobPayload =
  | SendInvitationEmailJob
  | SendResetPasswordEmailJob
  | SendDriverInvitationEmailJob;
