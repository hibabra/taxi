import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import nodemailer, { Transporter } from 'nodemailer';

import {
  SendDriverInvitationEmailJob,
  SendInvitationEmailJob,
  SendResetPasswordEmailJob,
} from './users-email.types';

type MailTemplateName =
  | 'driver-invitation.html.hbs'
  | 'driver-invitation.text.hbs'
  | 'invitation.html.hbs'
  | 'invitation.text.hbs'
  | 'reset-password.html.hbs'
  | 'reset-password.text.hbs';

@Injectable()
export class UsersMailerService {
  private readonly transporter: Transporter;
  private readonly compiledTemplates = new Map<
    MailTemplateName,
    Handlebars.TemplateDelegate<Record<string, unknown>>
  >();

  constructor(private readonly configService: ConfigService) {
    const smtpUser = this.configService.get<string>('mail.smtpUser');
    const smtpPassword = this.configService.get<string>('mail.smtpPassword');

    this.transporter = nodemailer.createTransport({
      auth: smtpUser ? { pass: smtpPassword, user: smtpUser } : undefined,
      host: this.configService.getOrThrow<string>('mail.smtpHost'),
      port: this.configService.getOrThrow<number>('mail.smtpPort'),
      secure: this.configService.getOrThrow<boolean>('mail.smtpSecure'),
    });
  }

  async sendInvitationEmail(job: SendInvitationEmailJob): Promise<void> {
    const acceptUrl = this.buildUrl(
      this.configService.getOrThrow<string>('mail.invitationBaseUrl'),
      job.invitationToken,
    );
    const context = {
      acceptUrl,
      expiresAt: formatDate(job.expiresAt),
      firstName: job.firstName,
      roles: job.roles.join(', '),
    };

    await this.transporter.sendMail({
      from: this.fromAddress(),
      html: await this.render('invitation.html.hbs', context),
      subject: 'Invitation TaxiKiwi',
      text: await this.render('invitation.text.hbs', context),
      to: job.email,
    });
  }

  async sendResetPasswordEmail(job: SendResetPasswordEmailJob): Promise<void> {
    const resetUrl = this.buildUrl(
      this.configService.getOrThrow<string>('mail.resetPasswordBaseUrl'),
      job.resetToken,
    );
    const context = {
      expiresAt: formatDate(job.expiresAt),
      firstName: job.firstName,
      resetUrl,
    };

    await this.transporter.sendMail({
      from: this.fromAddress(),
      html: await this.render('reset-password.html.hbs', context),
      subject: 'Reinitialisation de votre mot de passe TaxiKiwi',
      text: await this.render('reset-password.text.hbs', context),
      to: job.email,
    });
  }

  async sendDriverInvitationEmail(job: SendDriverInvitationEmailJob): Promise<void> {
    const acceptUrl = this.buildUrl(
      this.configService.getOrThrow<string>('mail.invitationBaseUrl'),
      job.invitationToken,
    );
    const context = {
      acceptUrl,
      expiresAt: formatDate(job.expiresAt),
      licenseCity: job.licenseCity,
      licenseNumber: job.licenseNumber,
    };

    await this.transporter.sendMail({
      from: this.fromAddress(),
      html: await this.render('driver-invitation.html.hbs', context),
      subject: 'Invitation chauffeur TaxiKiwi',
      text: await this.render('driver-invitation.text.hbs', context),
      to: job.email,
    });
  }

  private async render(
    templateName: MailTemplateName,
    context: Record<string, unknown>,
  ): Promise<string> {
    let compiled = this.compiledTemplates.get(templateName);

    if (!compiled) {
      const source = await readFile(path.join(__dirname, 'templates', templateName), 'utf8');
      compiled = Handlebars.compile(source);
      this.compiledTemplates.set(templateName, compiled);
    }

    return compiled(context);
  }

  private buildUrl(baseUrl: string, token: string): string {
    const url = new URL(baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  private fromAddress(): string {
    const fromName = this.configService.getOrThrow<string>('mail.fromName');
    const fromAddress = this.configService.getOrThrow<string>('mail.fromAddress');

    return `"${fromName.replaceAll('"', '')}" <${fromAddress}>`;
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}
