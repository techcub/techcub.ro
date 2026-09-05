import { z } from 'zod';
import ro from '../../i18n/ro.json';
import en from '../../i18n/en.json';

export const CONSENT_VERSION = '2026-09-05';
export const newsletterCopy = { ro: ro.newsletter, en: en.newsletter };
export type NewsletterLocale = keyof typeof newsletterCopy;
export const localeSchema = z.enum(['ro', 'en']);
export const subscriptionSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  locale: localeSchema,
  consent: z.literal(CONSENT_VERSION),
});
export const notificationSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
  publishedAt: z.coerce.date(),
});
export const manifestSchema = z
  .object({
    version: z.literal(1),
    items: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}:(ro|en)$/),
          locale: localeSchema,
          title: z.string().min(1).max(200),
          description: z.string().min(1).max(1000),
          path: z.string().regex(/^\/(?:en\/)?(?:blog|projects)\/[a-zA-Z0-9_-]+\/?$/),
          publishedAt: z.iso.datetime(),
        })
      )
      .max(1000),
  })
  .superRefine(({ items }, ctx) => {
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      ctx.addIssue({ code: 'custom', message: 'Duplicate notification IDs' });
    }
  });
export type NotificationItem = z.infer<typeof manifestSchema>['items'][number];

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!
  );
}

export async function readLimited(request: Request | Response, limit = 4096): Promise<string> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new Error('Body too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
