import { NEWSLETTER_SERVICE_URL, NEWSLETTER_SERVICE_TOKEN } from 'astro:env/server';
import { newsletterCopy, readLimited, type NewsletterLocale } from './shared';

export async function forwardNewsletter(
  action: 'subscribe' | 'confirm' | 'unsubscribe',
  body: unknown,
  locale: NewsletterLocale
): Promise<Response> {
  const copy = newsletterCopy[locale];
  const failure = (status = 503) =>
    Response.json(
      { success: false, error: status === 400 ? copy.invalidToken : copy.error },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  if (!NEWSLETTER_SERVICE_URL || !NEWSLETTER_SERVICE_TOKEN) return failure();
  try {
    const base = new URL(NEWSLETTER_SERVICE_URL);
    if (
      base.protocol !== 'https:' &&
      !(import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(base.hostname))
    )
      return failure();
    const response = await fetch(new URL(`/${action}`, base), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NEWSLETTER_SERVICE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return failure(response.status === 400 ? 400 : 503);
    }
    const result = JSON.parse(await readLimited(response));
    if (result.success !== true) return failure();
    return Response.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return failure();
  }
}
