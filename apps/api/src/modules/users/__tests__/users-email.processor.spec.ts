import { Job } from 'bullmq';

import { UserRole } from '../../auth/types/role.enum';
import { SEND_INVITATION_EMAIL_JOB, SEND_RESET_PASSWORD_EMAIL_JOB } from '../users.constants';
import { UsersEmailProcessor } from '../users-email.processor';
import { UsersEmailJobPayload } from '../users-email.types';

describe('UsersEmailProcessor', () => {
  const mockMailer = {
    sendInvitationEmail: jest.fn(),
    sendResetPasswordEmail: jest.fn(),
  };

  let processor: UsersEmailProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new UsersEmailProcessor(mockMailer as never);
  });

  it('sends invitation emails', async () => {
    const data = {
      email: 'nadia.benali@taxikiwi.local',
      expiresAt: new Date().toISOString(),
      firstName: 'Nadia',
      groupementId: 'groupement-1',
      invitationToken: 'token',
      lastName: 'Benali',
      roles: [UserRole.ADMIN],
    };

    await processor.process({ data, name: SEND_INVITATION_EMAIL_JOB } as Job<UsersEmailJobPayload>);

    expect(mockMailer.sendInvitationEmail).toHaveBeenCalledWith(data);
    expect(mockMailer.sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it('sends reset password emails', async () => {
    const data = {
      email: 'nadia.benali@taxikiwi.local',
      expiresAt: new Date().toISOString(),
      firstName: 'Nadia',
      groupementId: 'groupement-1',
      resetToken: 'token',
    };

    await processor.process({
      data,
      name: SEND_RESET_PASSWORD_EMAIL_JOB,
    } as Job<UsersEmailJobPayload>);

    expect(mockMailer.sendResetPasswordEmail).toHaveBeenCalledWith(data);
    expect(mockMailer.sendInvitationEmail).not.toHaveBeenCalled();
  });
});
