import { describe, expect, it, vi } from 'vitest';

const MOCK_POSTS = [
  { id: 'ro/salut', data: { locale: 'ro', uid: 'greeting', title: 'Salut', draft: false } },
  { id: 'en/hello', data: { locale: 'en', uid: 'greeting', title: 'Hello', draft: false } },
  { id: 'ro/despre-noi', data: { locale: 'ro', title: 'Despre noi', draft: false } },
  { id: 'en/despre-noi', data: { locale: 'en', title: 'About us', draft: false } },
  { id: 'ro/singur', data: { locale: 'ro', title: 'Singur', draft: false } },
  { id: 'en/singur', data: { locale: 'en', title: 'Solo', draft: true } },
];

vi.mock('@/lib/content', () => ({ getCollection: vi.fn(async () => MOCK_POSTS) }));
vi.mock('@/config/i18n.config', () => ({
  default: {
    enabled: true,
    defaultLocale: 'ro',
    locales: ['ro', 'en'],
    localeNames: { ro: 'Romana', en: 'English' },
    detectBrowserLocale: false,
  },
}));

import { getPostTranslations } from '@/lib/post-links';

describe('post translations', () => {
  it('resolves translations connected by uid', async () => {
    expect(await getPostTranslations('ro/salut', 'ro', 'greeting')).toEqual([
      { locale: 'ro', url: '/blog/salut' },
      { locale: 'en', url: '/en/blog/hello' },
    ]);
  });

  it('matches identical slugs without a uid', async () => {
    expect(await getPostTranslations('ro/despre-noi', 'ro')).toEqual([
      { locale: 'ro', url: '/blog/despre-noi' },
      { locale: 'en', url: '/en/blog/despre-noi' },
    ]);
  });

  it('does not expose draft translations', async () => {
    expect(await getPostTranslations('ro/singur', 'ro')).toEqual([
      { locale: 'ro', url: '/blog/singur' },
    ]);
  });
});
