import { createContext } from 'astro/middleware';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSENT_VERSION } from '../lib/newsletter/shared';

vi.mock('astro:env/client', () => ({ PUBLIC_NEWSLETTER_ENABLED: true }));
vi.mock('astro:env/server', () => ({
  NEWSLETTER_SERVICE_URL: 'https://service.example',
  NEWSLETTER_SERVICE_TOKEN: 'server-only-token',
}));
import { POST as subscribe } from '../pages/api/newsletter';
import { POST as manage } from '../pages/api/newsletter/[action]';
const context = (request: Request, action?: string) =>
  createContext({ request, params: { action }, defaultLocale: 'ro' });
const body = () => {
  const form = new FormData();
  form.set('email', ' User@Example.com ');
  form.set('locale', 'ro');
  form.set('consent', CONSENT_VERSION);
  return form;
};
beforeEach(() =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true }))
  )
);
afterEach(() => vi.unstubAllGlobals());

describe('Site notification endpoints', () => {
  it('forwards a valid multipart form with server authentication', async () => {
    const response = await subscribe(
      context(
        new Request('https://techcub.ro/api/newsletter', {
          method: 'POST',
          headers: { Origin: 'https://techcub.ro' },
          body: body(),
        })
      )
    );
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://service.example/subscribe'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer server-only-token' }),
        body: JSON.stringify({ email: 'user@example.com', locale: 'ro', consent: CONSENT_VERSION }),
      })
    );
  });
  it('rejects foreign origins and forms without consent before calling the service', async () => {
    expect(
      (
        await subscribe(
          context(
            new Request('https://techcub.ro/api/newsletter', {
              method: 'POST',
              headers: { Origin: 'https://other.example' },
              body: body(),
            })
          )
        )
      ).status
    ).toBe(403);
    const form = body();
    form.delete('consent');
    expect(
      (
        await subscribe(
          context(
            new Request('https://techcub.ro/api/newsletter', {
              method: 'POST',
              headers: { Origin: 'https://techcub.ro' },
              body: form,
            })
          )
        )
      ).status
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects oversized bodies without forwarding them', async () => {
    const response = await subscribe(
      context(
        new Request('https://techcub.ro/api/newsletter', {
          method: 'POST',
          headers: { Origin: 'https://techcub.ro' },
          body: 'x'.repeat(5000),
        })
      )
    );
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('supports one-click unsubscribe without browser Origin but does not allow cross-origin confirmation', async () => {
    const request = new Request(
      'https://techcub.ro/api/newsletter/unsubscribe?token=signed-token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      }
    );
    expect((await manage(context(request, 'unsubscribe'))).status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      new URL('https://service.example/unsubscribe'),
      expect.objectContaining({ body: JSON.stringify({ token: 'signed-token' }) })
    );
    const confirm = new Request('https://techcub.ro/api/newsletter/confirm', {
      method: 'POST',
      body: JSON.stringify({ token: 'signed-token' }),
    });
    expect((await manage(context(confirm, 'confirm'))).status).toBe(403);
  });
  it('returns a localized error without exposing provider output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('private provider details', { status: 500 }))
    );
    const response = await subscribe(
      context(
        new Request('https://techcub.ro/api/newsletter', {
          method: 'POST',
          headers: { Origin: 'https://techcub.ro' },
          body: body(),
        })
      )
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private provider details');
  });
});
