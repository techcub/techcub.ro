import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({ getCollection: vi.fn(async () => []) }));
vi.mock('@/config/i18n.config', () => ({
  default: {
    enabled: true,
    defaultLocale: 'ro',
    locales: ['ro', 'en'],
    localeNames: { ro: 'Romana', en: 'English' },
    detectBrowserLocale: false,
  },
}));

import {
  getBlogBaseUrl,
  getBlogPageUrl,
  getPostUrl,
  getSecondaryLocales,
  getTagUrl,
} from '@/lib/blog';

describe('blog URL helpers', () => {
  it('keeps Romanian URLs at the site root', () => {
    expect(getPostUrl('ro/ghid-suport-it')).toBe('/blog/ghid-suport-it');
    expect(getBlogBaseUrl('ro')).toBe('/blog');
  });

  it('prefixes English URLs', () => {
    expect(getPostUrl('en/it-support-guide', 'en')).toBe('/en/blog/it-support-guide');
    expect(getBlogBaseUrl('en')).toBe('/en/blog');
    expect(getBlogPageUrl(2, 'en')).toBe('/en/blog/page/2');
    expect(getTagUrl('IT Support', 'en')).toBe('/en/blog/tag/it-support');
  });

  it('lists English as the secondary locale', () => {
    expect(getSecondaryLocales()).toEqual(['en']);
  });
});
