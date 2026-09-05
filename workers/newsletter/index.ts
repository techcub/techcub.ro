import { businessConfig } from '../../src/config/business.config';
import {
  CONSENT_VERSION,
  manifestSchema,
  newsletterCopy,
  readLimited,
  subscriptionSchema,
  type NewsletterLocale,
  type NotificationItem,
} from '../../src/lib/newsletter/shared';
import { sameSecret, signToken, verifyToken } from './crypto';
import { checkSender, composeEmail, sendEmail } from './mail';

const DAY = 86400000;
const json = (success: boolean, status = 200) =>
  Response.json({ success }, { status, headers: { 'Cache-Control': 'no-store' } });
type Subscriber = {
  id: string;
  email: string;
  locale: NewsletterLocale;
  generation: string;
  status: string;
  requested_at: number;
  confirmed_at: number | null;
};
type Delivery = {
  id: string;
  publication_id: string;
  subscriber_id: string;
  generation: string;
  first_attempt: number | null;
  payload: string | null;
};

async function quota(env: Env, key: string, limit: number, now: number): Promise<boolean> {
  const result = await env.DB.prepare(
    `INSERT INTO rate_limits(key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count`
  )
    .bind(key, now + 2 * DAY, limit)
    .first();
  return result !== null;
}

async function subscribe(env: Env, body: unknown, now: number): Promise<Response> {
  if (env.NEWSLETTER_ENABLED !== 'true') return json(false, 503);
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) return json(false, 400);
  const { email, locale } = parsed.data;
  await checkSender(env);
  if (!(await quota(env, `subscribe:${Math.floor(now / DAY)}`, 100, now))) return json(false, 429);
  const id = crypto.randomUUID();
  const generation = crypto.randomUUID();
  const subscriber = await env.DB.prepare(
    `INSERT INTO subscribers
    (id, email, locale, generation, status, requested_at, consent_version, consent_text)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET locale = excluded.locale, generation = excluded.generation,
    requested_at = excluded.requested_at, consent_version = excluded.consent_version, consent_text = excluded.consent_text
    WHERE subscribers.status = 'pending' AND subscribers.requested_at <= ? RETURNING *`
  )
    .bind(
      id,
      email,
      locale,
      generation,
      now,
      CONSENT_VERSION,
      newsletterCopy[locale].consent,
      now - DAY
    )
    .first<Subscriber>();
  if (!subscriber) return json(true);
  const token = await signToken(env.NEWSLETTER_TOKEN_SECRET, {
    id: subscriber.id,
    generation,
    purpose: 'confirm',
    expires: now + DAY,
  });
  const url = `${businessConfig.website}/newsletter/confirm#${new URLSearchParams({ token, locale })}`;
  try {
    await sendEmail(env, composeEmail(env, email, locale, url), `confirm/${generation}`);
  } catch {
    console.error(JSON.stringify({ event: 'confirmation_send_failed' }));
    return json(false, 503);
  }
  return json(true);
}

async function applyToken(
  env: Env,
  token: string,
  purpose: 'confirm' | 'unsubscribe',
  now: number
): Promise<Response> {
  const claims = await verifyToken(env.NEWSLETTER_TOKEN_SECRET, token, purpose, now);
  if (!claims) return json(false, 400);
  if (purpose === 'unsubscribe') {
    await env.DB.prepare('DELETE FROM subscribers WHERE id = ? AND generation = ?')
      .bind(claims.id, claims.generation)
      .run();
    return json(true);
  }
  if (env.NEWSLETTER_ENABLED !== 'true') return json(false, 503);
  const result = await env.DB.prepare(
    `UPDATE subscribers SET status = 'active', confirmed_at = COALESCE(confirmed_at, ?)
    WHERE id = ? AND generation = ? AND requested_at > ? RETURNING id`
  )
    .bind(now, claims.id, claims.generation, now - DAY)
    .first();
  return json(result !== null, result ? 200 : 400);
}

async function liveItems(): Promise<NotificationItem[]> {
  const response = await fetch(`${businessConfig.website}/notifications.json`, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('Live manifest unavailable');
  }
  return manifestSchema.parse(JSON.parse(await readLimited(response, 1000000))).items;
}

async function verifyPage(item: NotificationItem): Promise<boolean> {
  const response = await fetch(new URL(item.path, businessConfig.website), {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) {
    await response.body?.cancel();
    return false;
  }
  const html = await readLimited(response, 2000000);
  return html.includes(`name="newsletter-id" content="${item.id}"`);
}

async function discover(
  env: Env,
  items: NotificationItem[],
  now: number,
  deadline: number
): Promise<void> {
  const ready = await env.DB.prepare("SELECT value FROM state WHERE key = 'initialized'").first();
  if (!ready) {
    await env.DB.batch([
      ...items
        .filter((item) => Date.parse(item.publishedAt) <= now)
        .map((item) =>
          env.DB.prepare(
            'INSERT OR IGNORE INTO publications(id, payload, discovered_at, baseline) VALUES (?, ?, ?, 1)'
          ).bind(item.id, JSON.stringify(item), now)
        ),
      env.DB.prepare("INSERT OR IGNORE INTO state(key, value) VALUES ('initialized', ?)").bind(
        String(now)
      ),
    ]);
    return;
  }
  let inspected = 0;
  for (const item of items) {
    if (Date.now() >= deadline) break;
    if (Date.parse(item.publishedAt) > now) continue;
    if (await env.DB.prepare('SELECT id FROM publications WHERE id = ?').bind(item.id).first())
      continue;
    if (inspected++ >= 10) break;
    if (!(await verifyPage(item))) continue;
    await env.DB.batch([
      env.DB.prepare(
        'INSERT OR IGNORE INTO publications(id, payload, discovered_at) VALUES (?, ?, ?)'
      ).bind(item.id, JSON.stringify(item), now),
      env.DB.prepare(
        `INSERT OR IGNORE INTO deliveries(id, publication_id, subscriber_id, generation)
        SELECT ? || '/' || id, ?, id, generation FROM subscribers WHERE status = 'active' AND locale = ? AND confirmed_at <= ?`
      ).bind(item.id, item.id, item.locale, now),
    ]);
  }
}

async function deliver(
  env: Env,
  items: NotificationItem[],
  now: number,
  deadline: number
): Promise<void> {
  const { results } = await env.DB.prepare(
    "SELECT * FROM deliveries WHERE status = 'queued' ORDER BY rowid LIMIT 20"
  ).all<Delivery>();
  for (const delivery of results) {
    if (Date.now() >= deadline) break;
    if (delivery.first_attempt !== null && now - delivery.first_attempt >= 23 * 3600000) {
      await env.DB.prepare(
        "UPDATE deliveries SET status = 'uncertain', payload = NULL WHERE id = ?"
      )
        .bind(delivery.id)
        .run();
      console.error(
        JSON.stringify({ event: 'delivery_needs_review', publication: delivery.publication_id })
      );
      continue;
    }
    const current = items.find((item) => item.id === delivery.publication_id);
    if (!current) {
      await env.DB.prepare(
        "UPDATE deliveries SET status = 'cancelled', payload = NULL WHERE id = ?"
      )
        .bind(delivery.id)
        .run();
      continue;
    }
    if (Date.parse(current.publishedAt) > now) continue;
    if (!(await verifyPage(current))) continue;
    const subscriber = await env.DB.prepare(
      "SELECT * FROM subscribers WHERE id = ? AND generation = ? AND status = 'active'"
    )
      .bind(delivery.subscriber_id, delivery.generation)
      .first<Subscriber>();
    if (!subscriber) {
      await env.DB.prepare(
        "UPDATE deliveries SET status = 'cancelled', payload = NULL WHERE id = ?"
      )
        .bind(delivery.id)
        .run();
      continue;
    }
    if (!(await quota(env, `delivery:${Math.floor(now / DAY)}`, 80, now))) break;
    const publication = await env.DB.prepare('SELECT payload FROM publications WHERE id = ?')
      .bind(delivery.publication_id)
      .first<{ payload: string }>();
    if (!publication) throw new Error('Publication missing');
    const item = manifestSchema.shape.items.element.parse(JSON.parse(publication.payload));
    const token = await signToken(env.NEWSLETTER_TOKEN_SECRET, {
      id: subscriber.id,
      generation: subscriber.generation,
      purpose: 'unsubscribe',
    });
    const unsubscribeUrl = `${businessConfig.website}/newsletter/unsubscribe#${new URLSearchParams({ token, locale: subscriber.locale })}`;
    const mail = delivery.payload
      ? JSON.parse(delivery.payload)
      : composeEmail(
          env,
          subscriber.email,
          subscriber.locale,
          new URL(item.path, businessConfig.website).href,
          item,
          unsubscribeUrl
        );
    mail.headers ??= {
      'List-Unsubscribe': `<${businessConfig.website}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
    await env.DB.prepare(
      'UPDATE deliveries SET first_attempt = COALESCE(first_attempt, ?), payload = ? WHERE id = ?'
    )
      .bind(now, JSON.stringify(mail), delivery.id)
      .run();
    try {
      await sendEmail(env, mail, `publication/${delivery.id}`);
    } catch {
      console.error(
        JSON.stringify({ event: 'delivery_send_failed', publication: delivery.publication_id })
      );
      break;
    }
    await env.DB.prepare(
      "UPDATE deliveries SET status = 'sent', sent_at = ?, payload = NULL WHERE id = ?"
    )
      .bind(Date.now(), delivery.id)
      .run();
  }
}

export async function runScheduled(env: Env, now = Date.now()): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM subscribers WHERE status = 'pending' AND requested_at < ?").bind(
      now - 2 * DAY
    ),
    env.DB.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(now),
    env.DB.prepare(
      "DELETE FROM deliveries WHERE status IN ('sent', 'cancelled', 'uncertain') AND COALESCE(sent_at, first_attempt, 0) < ?"
    ).bind(now - 30 * DAY),
  ]);
  if (env.NEWSLETTER_ENABLED !== 'true') return;
  const owner = crypto.randomUUID();
  const lock = await env.DB.prepare(
    `INSERT INTO state(key, value) VALUES ('lock', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE CAST(substr(state.value, 1, 13) AS INTEGER) < ? RETURNING key`
  )
    .bind(`${now + 900000}:${owner}`, now)
    .first();
  if (!lock) return;
  try {
    await checkSender(env);
    const items = await liveItems();
    const deadline = Date.now() + 120000;
    await discover(env, items, now, deadline);
    await deliver(env, items, now, deadline);
    await env.DB.prepare(
      "INSERT INTO state(key, value) VALUES ('last_success', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
      .bind(String(now))
      .run();
  } finally {
    await env.DB.prepare("DELETE FROM state WHERE key = 'lock' AND value = ?")
      .bind(`${now + 900000}:${owner}`)
      .run();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (
        !env.NEWSLETTER_SERVICE_TOKEN ||
        env.NEWSLETTER_SERVICE_TOKEN.length < 32 ||
        !env.NEWSLETTER_TOKEN_SECRET ||
        env.NEWSLETTER_TOKEN_SECRET.length < 32
      )
        return json(false, 503);
      if (
        !(await sameSecret(
          env.NEWSLETTER_SERVICE_TOKEN,
          request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
        ))
      )
        return json(false, 401);
      if (request.method !== 'POST') return json(false, 405);
      const path = new URL(request.url).pathname;
      const body = JSON.parse(await readLimited(request));
      if (path === '/subscribe') return await subscribe(env, body, Date.now());
      if ((path === '/confirm' || path === '/unsubscribe') && typeof body.token === 'string') {
        return await applyToken(
          env,
          body.token,
          path === '/confirm' ? 'confirm' : 'unsubscribe',
          Date.now()
        );
      }
      return json(false, 400);
    } catch {
      console.error(JSON.stringify({ event: 'newsletter_request_failed' }));
      return json(false, 503);
    }
  },
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    try {
      await runScheduled(env);
    } catch {
      console.error(JSON.stringify({ event: 'newsletter_schedule_failed' }));
      throw new Error('Newsletter schedule failed');
    }
  },
} satisfies ExportedHandler<Env>;
