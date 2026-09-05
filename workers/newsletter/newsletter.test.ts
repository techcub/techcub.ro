import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { readFile } from 'node:fs/promises';
import worker, { runScheduled } from './index';
import { signToken, verifyToken } from './crypto';
import { CONSENT_VERSION, type NotificationItem } from '../../src/lib/newsletter/shared';
import { businessConfig } from '../../src/config/business.config';

let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;
let messages: { body: Record<string, unknown>; key: string | null }[];
let items: NotificationItem[];
let failedSend: boolean;
let tracking: boolean;
let missingPage: boolean;
const item: NotificationItem = {
  id: 'intune-lab:ro',
  locale: 'ro',
  title: 'Intune <lab>',
  description: 'Configurare & testare',
  path: '/projects/intune',
  publishedAt: '2026-09-05T00:00:00.000Z',
};
const call = (path: string, body: unknown) =>
  worker.fetch(
    new Request(`https://service.test/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.NEWSLETTER_SERVICE_TOKEN}` },
      body: JSON.stringify(body),
    }),
    env
  );
const subscribe = (email = 'person@example.com', locale = 'ro') =>
  call('subscribe', { email, locale, consent: CONSENT_VERSION });
const tokenFromMail = () => {
  const text = String(messages.at(-1)!.body.text);
  const url = text.match(/https:\/\/techcub\.ro\/newsletter\/confirm#[^\s]+/)![0];
  return new URLSearchParams(new URL(url).hash.slice(1)).get('token')!;
};

beforeAll(async () => {
  platform = await getPlatformProxy<Env>({
    configPath: 'workers/newsletter/wrangler.jsonc',
    persist: false,
  });
  env = {
    ...platform.env,
    NEWSLETTER_ENABLED: 'true',
    NEWSLETTER_SERVICE_TOKEN: 'a'.repeat(40),
    NEWSLETTER_TOKEN_SECRET: 'b'.repeat(40),
    RESEND_API_KEY: 'test',
    RESEND_DOMAIN_ID: 'test-domain',
    RESEND_FROM_EMAIL: 'updates@techcub.ro',
  };
  const migration = await readFile(
    new URL('./migrations/0001_newsletter.sql', import.meta.url),
    'utf8'
  );
  for (const sql of migration
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await env.DB.prepare(sql).run();
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await platform?.dispose();
});
beforeEach(async () => {
  vi.unstubAllGlobals();
  for (const table of ['deliveries', 'subscribers', 'publications', 'state', 'rate_limits'])
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  messages = [];
  items = [];
  failedSend = false;
  tracking = false;
  missingPage = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('api.resend.com/domains/'))
        return Response.json({
          name: 'techcub.ro',
          status: 'verified',
          open_tracking: tracking,
          click_tracking: false,
        });
      if (url.endsWith('/emails')) {
        messages.push({
          body: JSON.parse(String(init?.body)),
          key: new Headers(init?.headers).get('Idempotency-Key'),
        });
        if (failedSend) throw new Error('Lost response');
        return Response.json({ id: 'email-id' });
      }
      if (url.endsWith('/notifications.json')) return Response.json({ version: 1, items });
      if (url.startsWith(businessConfig.website))
        return new Response(
          missingPage ? '<h1>Missing</h1>' : `<meta name="newsletter-id" content="${item.id}">`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      throw new Error(`Unexpected fetch ${url}`);
    })
  );
});

describe('Confirmation and withdrawal', () => {
  it('requires authentication, explicit consent and an enabled service', async () => {
    expect(
      (await worker.fetch(new Request('https://service.test/subscribe', { method: 'POST' }), env))
        .status
    ).toBe(401);
    expect((await call('subscribe', { email: 'person@example.com', locale: 'ro' })).status).toBe(
      400
    );
    expect(
      (
        await worker.fetch(
          new Request('https://service.test/subscribe', {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.NEWSLETTER_SERVICE_TOKEN}` },
            body: '{}',
          }),
          { ...env, NEWSLETTER_ENABLED: 'false' }
        )
      ).status
    ).toBe(503);
    expect(messages).toHaveLength(0);
  });
  it('keeps addresses pending, confirms once and records the actual consent', async () => {
    expect((await subscribe()).status).toBe(200);
    const pending = await env.DB.prepare('SELECT * FROM subscribers').first();
    expect(pending?.status).toBe('pending');
    expect(pending?.confirmed_at).toBeNull();
    expect(pending?.consent_version).toBe(CONSENT_VERSION);
    const token = tokenFromMail();
    expect((await call('confirm', { token })).status).toBe(200);
    expect((await call('confirm', { token })).status).toBe(200);
    expect((await env.DB.prepare('SELECT status FROM subscribers').first())?.status).toBe('active');
    await subscribe();
    expect(messages).toHaveLength(1);
  });
  it('does not send repeated confirmation emails within 24 hours', async () => {
    await Promise.all([subscribe(), subscribe()]);
    expect(messages).toHaveLength(1);
  });
  it('rejects tampered, expired and wrong-purpose links', async () => {
    await subscribe();
    const token = tokenFromMail();
    expect(
      await verifyToken(env.NEWSLETTER_TOKEN_SECRET, token + 'x', 'confirm', Date.now())
    ).toBeNull();
    expect(
      await verifyToken(env.NEWSLETTER_TOKEN_SECRET, token, 'unsubscribe', Date.now())
    ).toBeNull();
    expect(
      await verifyToken(env.NEWSLETTER_TOKEN_SECRET, token, 'confirm', Date.now() + 86400001)
    ).toBeNull();
  });
  it('erases the address and prevents old links from reactivating a new subscription', async () => {
    await subscribe();
    const oldToken = tokenFromMail();
    await call('confirm', { token: oldToken });
    const row = await env.DB.prepare('SELECT id, generation FROM subscribers').first<{
      id: string;
      generation: string;
    }>();
    const token = await signToken(env.NEWSLETTER_TOKEN_SECRET, { ...row!, purpose: 'unsubscribe' });
    expect((await call('unsubscribe', { token })).status).toBe(200);
    expect(await env.DB.prepare('SELECT id FROM subscribers').first()).toBeNull();
    await subscribe();
    expect((await call('confirm', { token: oldToken })).status).toBe(400);
    await call('unsubscribe', { token });
    expect((await env.DB.prepare('SELECT status FROM subscribers').first())?.status).toBe(
      'pending'
    );
  });
  it('does not send when tracking is enabled', async () => {
    tracking = true;
    expect((await subscribe()).status).toBe(503);
    expect(messages).toHaveLength(0);
  });
  it('purges expired requests even while sending is paused', async () => {
    await subscribe();
    await runScheduled({ ...env, NEWSLETTER_ENABLED: 'false' }, Date.now() + 3 * 86400000);
    expect(await env.DB.prepare('SELECT id FROM subscribers').first()).toBeNull();
  });
});

describe('Published notifications', () => {
  async function prepare() {
    await runScheduled(env);
    await subscribe();
    await call('confirm', { token: tokenFromMail() });
    messages = [];
    items = [item];
  }
  it('baselines existing content without mailing it', async () => {
    await subscribe();
    await call('confirm', { token: tokenFromMail() });
    messages = [];
    items = [item];
    await runScheduled(env);
    await runScheduled(env);
    expect(messages).toHaveLength(0);
  });
  it('waits for a live matching page and sends only once across redeploys', async () => {
    await prepare();
    missingPage = true;
    await runScheduled(env);
    expect(messages).toHaveLength(0);
    missingPage = false;
    await runScheduled(env);
    expect(messages).toHaveLength(1);
    expect(String(messages[0].body.html)).toContain('Intune &lt;lab&gt;');
    expect(messages[0].body.headers).toHaveProperty(
      'List-Unsubscribe-Post',
      'List-Unsubscribe=One-Click'
    );
    items = [{ ...item, title: 'Corrected title' }];
    await runScheduled(env);
    expect(messages).toHaveLength(1);
  });
  it('excludes pending subscribers and subscribers in another language', async () => {
    await runScheduled(env);
    await subscribe('pending@example.com');
    await subscribe('english@example.com', 'en');
    await call('confirm', { token: tokenFromMail() });
    messages = [];
    items = [item];
    await runScheduled(env);
    expect(messages).toHaveLength(0);
  });
  it('retries with the same key and payload, then stops before idempotency expires', async () => {
    await prepare();
    failedSend = true;
    await runScheduled(env);
    expect(messages).toHaveLength(1);
    items = [{ ...item, title: 'Edited' }];
    await runScheduled(env);
    expect(messages[1]).toEqual(messages[0]);
    await runScheduled(env, Date.now() + 23 * 3600000 + 1000);
    expect(messages).toHaveLength(2);
    expect((await env.DB.prepare('SELECT status FROM deliveries').first())?.status).toBe(
      'uncertain'
    );
  });
  it('does not send a queued notification after withdrawal', async () => {
    await prepare();
    failedSend = true;
    await runScheduled(env);
    const row = await env.DB.prepare('SELECT id, generation FROM subscribers').first<{
      id: string;
      generation: string;
    }>();
    const token = await signToken(env.NEWSLETTER_TOKEN_SECRET, { ...row!, purpose: 'unsubscribe' });
    await call('unsubscribe', { token });
    expect(await env.DB.prepare('SELECT id FROM deliveries').first()).toBeNull();
    failedSend = false;
    await runScheduled(env);
    expect(messages).toHaveLength(1);
  });
  it('cancels queued notifications when the material is withdrawn', async () => {
    await prepare();
    failedSend = true;
    await runScheduled(env);
    items = [];
    failedSend = false;
    await runScheduled(env);
    expect(messages).toHaveLength(1);
    expect((await env.DB.prepare('SELECT status FROM deliveries').first())?.status).toBe(
      'cancelled'
    );
  });
  it('does not notify before the publication date', async () => {
    await prepare();
    items = [{ ...item, publishedAt: new Date(Date.now() + 86400000).toISOString() }];
    await runScheduled(env);
    expect(messages).toHaveLength(0);
  });
});
