import { businessConfig } from '../../src/config/business.config';
import {
  escapeHtml,
  newsletterCopy,
  readLimited,
  type NewsletterLocale,
  type NotificationItem,
} from '../../src/lib/newsletter/shared';

export type MailSettings = {
  RESEND_API_KEY: string;
  RESEND_DOMAIN_ID: string;
  RESEND_FROM_EMAIL: string;
};
export type Email = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
  reply_to: string;
};

async function resend(settings: MailSettings, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${settings.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Resend HTTP ${response.status}`);
  }
  return JSON.parse(await readLimited(response, 65536));
}

export async function checkSender(settings: MailSettings): Promise<void> {
  const domain = await resend(
    settings,
    `/domains/${encodeURIComponent(settings.RESEND_DOMAIN_ID)}`
  );
  const senderDomain = settings.RESEND_FROM_EMAIL.split('@')[1]?.toLowerCase();
  if (
    !senderDomain ||
    domain.name !== senderDomain ||
    domain.status !== 'verified' ||
    domain.open_tracking !== false ||
    domain.click_tracking !== false
  ) {
    throw new Error('Sender must be verified with open and click tracking disabled');
  }
}

export async function sendEmail(
  settings: MailSettings,
  email: Email,
  idempotencyKey: string
): Promise<void> {
  const result = await resend(settings, '/emails', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(email),
  });
  if (!result.id) throw new Error('Resend did not acknowledge the email');
}

export function composeEmail(
  settings: MailSettings,
  to: string,
  locale: NewsletterLocale,
  url: string,
  item?: NotificationItem,
  unsubscribeUrl?: string
): Email {
  const copy = newsletterCopy[locale];
  const title = item?.title ?? copy.confirmSubject;
  const description = item?.description ?? copy.confirmEmail;
  const action = item ? copy.readMaterial : copy.confirmButton;
  const footer = item ? copy.emailReason : copy.ignoreEmail;
  const address = businessConfig.legal.address;
  const identity = `${businessConfig.legal.name} · ${address.street}, ${address.city}, ${address.country}`;
  const privacyUrl = `${businessConfig.website}${locale === 'en' ? '/en/privacy' : '/confidentialitate'}`;
  return {
    from: `${businessConfig.brandName} <${settings.RESEND_FROM_EMAIL}>`,
    to: [to],
    reply_to: businessConfig.email,
    subject: item ? `${copy.newMaterial}: ${title}` : title,
    text: `${title}\n\n${description}\n\n${action}: ${url}\n\n${footer}${unsubscribeUrl ? `\n${copy.unsubscribeButton}: ${unsubscribeUrl}` : ''}\n${copy.privacyLink}: ${privacyUrl}\n\n${identity}`,
    html: `<div style="background:#120d1c;color:#f5f3ff;padding:32px;font-family:Arial,sans-serif;line-height:1.6"><p>${escapeHtml(businessConfig.brandName)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><p><a style="color:#c4b5fd" href="${escapeHtml(url)}">${escapeHtml(action)}</a></p><p>${escapeHtml(footer)}</p>${unsubscribeUrl ? `<p><a style="color:#c4b5fd" href="${escapeHtml(unsubscribeUrl)}">${escapeHtml(copy.unsubscribeButton)}</a></p>` : ''}<p><a style="color:#c4b5fd" href="${privacyUrl}">${escapeHtml(copy.privacyLink)}</a></p><p style="font-size:12px">${escapeHtml(identity)}</p></div>`,
  };
}
