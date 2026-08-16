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
  getProjectTagUrl,
  getProjectUrl,
  getProjectsBaseUrl,
  getProjectsPageUrl,
  getSecondaryLocales,
} from '@/lib/projects';

describe('project URL helpers', () => {
  it('keeps Romanian URLs at the site root', () => {
    expect(getProjectUrl('ro/site-prezentare')).toBe('/projects/site-prezentare');
    expect(getProjectsBaseUrl('ro')).toBe('/projects');
  });

  it('prefixes English URLs', () => {
    expect(getProjectUrl('en/business-site', 'en')).toBe('/en/projects/business-site');
    expect(getProjectsBaseUrl('en')).toBe('/en/projects');
    expect(getProjectsPageUrl(2, 'en')).toBe('/en/projects/page/2');
    expect(getProjectTagUrl('Client Work', 'en')).toBe('/en/projects/tag/client-work');
  });

  it('lists English as the secondary locale', () => {
    expect(getSecondaryLocales()).toEqual(['en']);
  });
});
