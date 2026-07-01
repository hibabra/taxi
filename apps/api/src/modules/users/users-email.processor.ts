import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';

import {
  SEND_INVITATION_EMAIL_JOB,
  SEND_DRIVER_INVITATION_EMAIL_JOB,
  SEND_RESET_PASSWORD_EMAIL_JOB,
  USERS_EMAIL_QUEUE,
} from './users.constants';
import {
  SendDriverInvitationEmailJob,
  SendInvitationEmailJob,
  SendResetPasswordEmailJob,
  UsersEmailJobPayload,
} from './users-email.types';
import { UsersMailerService } from './users-mailer.service';

@Injectable()
@Processor(USERS_EMAIL_QUEUE)
export class UsersEmailProcessor extends WorkerHost {
  constructor(private readonly usersMailerService: UsersMailerService) {
    super();
  }

  async process(job: Job<UsersEmailJobPayload>): Promise<void> {
    if (job.name === SEND_INVITATION_EMAIL_JOB) {
      await this.usersMailerService.sendInvitationEmail(job.data as SendInvitationEmailJob);
      return;
    }

    if (job.name === SEND_RESET_PASSWORD_EMAIL_JOB) {
      await this.usersMailerService.sendResetPasswordEmail(job.data as SendResetPasswordEmailJob);
      return;
    }

    if (job.name === SEND_DRIVER_INVITATION_EMAIL_JOB) {
      await this.usersMailerService.sendDriverInvitationEmail(
        job.data as SendDriverInvitationEmailJob,
      );
      return;
    }

    throw new Error(`Unsupported users email job: ${job.name}`);
  }
}
