import { z } from 'zod';

const claimsSchema = z.object({
  id: z.string().uuid(),
  generation: z.string().uuid(),
  purpose: z.enum(['confirm', 'unsubscribe']),
  expires: z.number().int().positive().optional(),
});
type Claims = z.infer<typeof claimsSchema>;
const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const decode = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const keyFor = (secret: string) =>
  crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );

export async function signToken(secret: string, claims: Claims): Promise<string> {
  const body = encode(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign(
    'HMAC',
    await keyFor(secret),
    new TextEncoder().encode(body)
  );
  return `${body}.${encode(new Uint8Array(signature))}`;
}

export async function verifyToken(
  secret: string,
  token: string,
  purpose: Claims['purpose'],
  now: number
): Promise<Claims | null> {
  try {
    if (token.length > 1024) return null;
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) return null;
    const valid = await crypto.subtle.verify(
      'HMAC',
      await keyFor(secret),
      decode(signature),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;
    const claims = claimsSchema.parse(JSON.parse(new TextDecoder().decode(decode(body))));
    if (
      claims.purpose !== purpose ||
      (purpose === 'confirm' && !claims.expires) ||
      (claims.expires && claims.expires <= now)
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}

export async function sameSecret(expected: string, actual: string): Promise<boolean> {
  const key = await keyFor(expected);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(expected));
  return crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(actual));
}
