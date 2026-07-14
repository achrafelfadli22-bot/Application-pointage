import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = Number(config.get<string>('SMTP_PORT') ?? 587);
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');

    this.from = config.get<string>('SMTP_FROM') ?? 'Pointage360 <noreply@pointage360.app>';
    this.enabled = Boolean(host && user && pass);

    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`Mail service configured — host=${host} port=${port}`);
    } else {
      // Mode dev : Ethereal SMTP ou simple log
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      this.logger.warn('SMTP not configured — emails will be logged only (set SMTP_HOST/SMTP_USER/SMTP_PASS to enable)');
    }
  }

  async send(options: MailOptions): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      if (!this.enabled) {
        this.logger.debug(`[mail:dev] To=${options.to} Subject="${options.subject}" Message-Id=${info.messageId}`);
      } else {
        this.logger.log(`[mail] Sent to=${options.to} Subject="${options.subject}" Message-Id=${info.messageId}`);
      }
    } catch (err) {
      this.logger.error(`[mail] Failed to send to ${options.to}: ${String(err)}`);
      // Ne pas propager l'erreur — l'email est best-effort
    }
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  async sendLeaveApproved(to: string, name: string, leaveType: string, startDate: string, endDate: string) {
    return this.send({
      to,
      subject: `✓ Congé approuvé — ${leaveType}`,
      html: this.wrap(`
        <h2>Votre demande de congé a été approuvée</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Votre demande de congé <strong>${leaveType}</strong> du <strong>${startDate}</strong> au <strong>${endDate}</strong>
        a été <span style="color:#22c55e;font-weight:bold;">approuvée</span>.</p>
        <p>Vous pouvez consulter l'état de votre demande sur <a href="${this.appUrl()}/time-off">Pointage360</a>.</p>
      `),
    });
  }

  async sendLeaveRejected(to: string, name: string, leaveType: string, startDate: string, endDate: string, reason?: string) {
    return this.send({
      to,
      subject: `✗ Congé refusé — ${leaveType}`,
      html: this.wrap(`
        <h2>Votre demande de congé a été refusée</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Votre demande de congé <strong>${leaveType}</strong> du <strong>${startDate}</strong> au <strong>${endDate}</strong>
        a été <span style="color:#ef4444;font-weight:bold;">refusée</span>.</p>
        ${reason ? `<p><strong>Motif :</strong> ${reason}</p>` : ''}
        <p>Vous pouvez contacter votre manager ou RH pour plus d'informations.</p>
      `),
    });
  }

  async sendLeaveSubmittedToApprover(to: string, approverName: string, employeeName: string, leaveType: string, startDate: string, endDate: string, durationDays: number) {
    return this.send({
      to,
      subject: `Demande de congé en attente — ${employeeName}`,
      html: this.wrap(`
        <h2>Nouvelle demande de congé à valider</h2>
        <p>Bonjour <strong>${approverName}</strong>,</p>
        <p><strong>${employeeName}</strong> a soumis une demande de congé :</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr><td style="padding:8px;font-weight:bold;background:#f8f8f6;">Type</td><td style="padding:8px;">${leaveType}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f8f8f6;">Du</td><td style="padding:8px;">${startDate}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f8f8f6;">Au</td><td style="padding:8px;">${endDate}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;background:#f8f8f6;">Durée</td><td style="padding:8px;">${durationDays} jour(s)</td></tr>
        </table>
        <p><a href="${this.appUrl()}/time-off/requests" style="background:#1a2340;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Traiter la demande</a></p>
      `),
    });
  }

  async sendTimesheetReminder(to: string, name: string, periodStart: string, periodEnd: string) {
    return this.send({
      to,
      subject: `Rappel : feuille de temps à soumettre — ${periodStart}`,
      html: this.wrap(`
        <h2>Votre feuille de temps est en attente</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Votre feuille de temps pour la période du <strong>${periodStart}</strong> au <strong>${periodEnd}</strong>
        n'a pas encore été soumise.</p>
        <p>Merci de la compléter et de la soumettre dès que possible.</p>
        <p><a href="${this.appUrl()}/timesheets" style="background:#1a2340;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;">Accéder à mes feuilles de temps</a></p>
      `),
    });
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string) {
    return this.send({
      to,
      subject: '🔑 Réinitialisation de votre mot de passe — Pointage360',
      html: this.wrap(`
        <h2>Réinitialisation de votre mot de passe</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Nous avons reçu une demande de réinitialisation du mot de passe pour votre compte Pointage360.</p>
        <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.</p>
        <p style="margin:24px 0;">
          <a href="${resetUrl}" style="background:#1a2340;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe reste inchangé.</p>
        <p style="color:#9ca3af;font-size:12px;margin-top:16px;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
          <span style="color:#3563e9;">${resetUrl}</span>
        </p>
      `),
    });
  }

  async sendCheckInConfirmation(to: string, name: string, siteName: string, checkInTime: string) {
    return this.send({
      to,
      subject: `✓ Pointage enregistré — ${siteName}`,
      html: this.wrap(`
        <h2>Votre pointage a été enregistré</h2>
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Votre entrée sur le site <strong>${siteName}</strong> a été enregistrée à <strong>${checkInTime}</strong>.</p>
        <p>Bonne journée !</p>
      `),
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private appUrl() {
    return this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  }

  private wrap(body: string) {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: system-ui, sans-serif; background: #f8f8f6; margin: 0; padding: 32px 16px; }
    .card { background: #fff; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; }
    .header { background: #1a2340; color: #fff; padding: 20px 28px; font-size: 20px; font-weight: bold; }
    .body { padding: 28px; color: #374151; line-height: 1.7; font-size: 15px; }
    .body h2 { color: #1a2340; margin-top: 0; }
    .footer { padding: 16px 28px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
    a { color: #3563e9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">Pointage360</div>
    <div class="body">${body}</div>
    <div class="footer">Cet email a été envoyé automatiquement par Pointage360. Merci de ne pas y répondre directement.</div>
  </div>
</body>
</html>`;
  }
}
