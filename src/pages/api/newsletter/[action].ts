import type { APIRoute } from 'astro';
import { forwardNewsletter } from '@/lib/newsletter/proxy';
import { readLimited } from '@/lib/newsletter/shared';

export const prerender = false;
export const POST: APIRoute = async ({ request, params, url }) => {
  const action = params.action;
  if (action !== 'confirm' && action !== 'unsubscribe') return new Response(null, { status: 404 });
  try {
    const raw = await readLimited(request);
    const oneClick =
      action === 'unsubscribe' &&
      new URLSearchParams(raw).get('List-Unsubscribe') === 'One-Click' &&
      request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded');
    if (!oneClick && request.headers.get('Origin') !== url.origin)
      return new Response(null, { status: 403 });
    const body = oneClick
      ? { token: url.searchParams.get('token'), locale: 'ro' }
      : JSON.parse(raw);
    if (typeof body.token !== 'string' || body.token.length > 1024)
      return new Response(null, { status: 400 });
    return forwardNewsletter(action, { token: body.token }, body.locale === 'en' ? 'en' : 'ro');
  } catch {
    return Response.json({ success: false }, { status: 400 });
  }
};
