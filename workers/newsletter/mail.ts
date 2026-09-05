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
    html: `<!doctype html>
<html lang="${locale}"><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background-color:#100c18;color:#f5f3ff;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#100c18"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#1c1429" style="max-width:560px;border:1px solid #39274f;border-radius:20px;overflow:hidden">
<tr><td bgcolor="#7c3aed" height="6" style="height:6px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 24px 24px;border-bottom:1px solid #39274f">
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td width="64"><a href="${escapeHtml(businessConfig.website)}"><img src="${escapeHtml(businessConfig.website)}/apple-touch-icon.png" width="48" height="48" alt="" style="display:block;border:0;border-radius:12px"></a></td>
<td style="color:#f5f3ff;font-size:19px;font-weight:bold;line-height:1.4">${escapeHtml(businessConfig.brandName)}</td>
</tr></table></td></tr>
<tr><td style="padding:28px 24px 32px">
<h1 style="margin:0 0 20px;color:#f5f3ff;font-size:28px;line-height:1.25;letter-spacing:-0.5px">${escapeHtml(title)}</h1>
<p style="margin:0 0 28px;color:#d9cfe6;font-size:16px;line-height:1.7">${escapeHtml(description)}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#7c3aed" style="border-radius:10px;text-align:center">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 24px;border:1px solid #a78bfa;border-radius:10px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;line-height:1.4">${escapeHtml(action)} &rarr;</a>
</td></tr></table>
<p style="margin:28px 0 0;color:#b8a9ca;font-size:14px;line-height:1.7">${escapeHtml(footer)}</p>
</td></tr>
<tr><td bgcolor="#160f21" style="padding:22px 24px;border-top:1px solid #39274f;color:#b8a9ca;font-size:12px;line-height:1.7">
<p style="margin:0 0 14px"><a style="color:#c4b5fd;text-decoration:underline" href="${escapeHtml(privacyUrl)}">${escapeHtml(copy.privacyLink)}</a>${unsubscribeUrl ? ` &nbsp;&middot;&nbsp; <a style="color:#c4b5fd;text-decoration:underline" href="${escapeHtml(unsubscribeUrl)}">${escapeHtml(copy.unsubscribeButton)}</a>` : ''}</p>
<p style="margin:0">${escapeHtml(identity)}</p>
</td></tr></table>
</td></tr></table></body></html>`,
  };
}
