import { describe, it, expect } from 'vitest';
import { CONSENT_VERSION, subscriptionSchema, manifestSchema } from '../lib/newsletter/shared';

describe('Notification subscriptions', () => {
  it('normalizes addresses and requires the current consent', () => {
    expect(
      subscriptionSchema.parse({
        email: ' User@Example.com ',
        locale: 'ro',
        consent: CONSENT_VERSION,
      }).email
    ).toBe('user@example.com');
    expect(subscriptionSchema.safeParse({ email: 'user@example.com', locale: 'ro' }).success).toBe(
      false
    );
    expect(
      subscriptionSchema.safeParse({ email: 'user@example.com', locale: 'ro', consent: 'old' })
        .success
    ).toBe(false);
  });
  it('rejects unsafe content URLs and duplicate publication identities', () => {
    const item = {
      id: 'intune-lab:ro',
      locale: 'ro',
      title: 'Intune',
      description: 'Lab',
      publishedAt: '2026-09-05T00:00:00.000Z',
      path: '/projects/intune',
    };
    expect(manifestSchema.safeParse({ version: 1, items: [item] }).success).toBe(true);
    expect(manifestSchema.safeParse({ version: 1, items: [item, item] }).success).toBe(false);
    expect(
      manifestSchema.safeParse({
        version: 1,
        items: [{ ...item, path: 'https://other.example/test' }],
      }).success
    ).toBe(false);
  });
});
