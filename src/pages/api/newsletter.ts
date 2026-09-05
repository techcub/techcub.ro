import type { APIRoute } from 'astro';
import { PUBLIC_NEWSLETTER_ENABLED } from 'astro:env/client';
import { forwardNewsletter } from '@/lib/newsletter/proxy';
import { newsletterCopy, readLimited, subscriptionSchema } from '@/lib/newsletter/shared';

export const prerender = false;
export const POST: APIRoute = async ({ request, url }) => {
  if (!PUBLIC_NEWSLETTER_ENABLED) return Response.json({ success: false }, { status: 503 });
  if (request.headers.get('Origin') !== url.origin)
    return Response.json({ success: false }, { status: 403 });
  try {
    const raw = await readLimited(request);
    const form = await new Response(raw, {
      headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' },
    }).formData();
    const locale = form.get('locale') === 'en' ? 'en' : 'ro';
    if (form.get('honeypot')) return Response.json({ success: true });
    const result = subscriptionSchema.safeParse(Object.fromEntries(form));
    if (!result.success)
      return Response.json(
        { success: false, error: newsletterCopy[locale].invalidEmail },
        { status: 400 }
      );
    return forwardNewsletter('subscribe', result.data, locale);
  } catch {
    return Response.json({ success: false }, { status: 400 });
  }
};
