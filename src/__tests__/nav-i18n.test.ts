import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/i18n.config', () => ({
  default: {
    enabled: true,
    defaultLocale: 'ro',
    locales: ['ro', 'en'],
    localeNames: { ro: 'Romana', en: 'English' },
    detectBrowserLocale: false,
  },
}));

import { getLogoHref, getNavItems, resolveNavItem, type NavItem } from '@/config/nav.config';

describe('localized navigation', () => {
  it('keeps Romanian links at the site root', () => {
    const items = getNavItems('ro');
    expect(items.find((item) => item.href === '/blog')?.label).toBe('Blog');
    expect(getLogoHref('ro')).toBe('/');
  });

  it('prefixes and translates English links', () => {
    const items = getNavItems('en');
    expect(items.find((item) => item.href === '/en/about')?.label).toBe('About');
    expect(items.find((item) => item.href === '/en/services')?.label).toBe('Services');
    expect(getLogoHref('en')).toBe('/en');
  });

  it('does not prefix external links, email links or anchors', () => {
    expect(
      resolveNavItem(
        { label: 'GitHub', href: 'https://github.com/techcub', order: 1, external: true },
        'en'
      ).href
    ).toBe('https://github.com/techcub');
    expect(resolveNavItem({ label: 'Top', href: '#top', order: 1 }, 'en').href).toBe('#top');
    expect(
      resolveNavItem({ label: 'Mail', href: 'mailto:contact@techcub.ro', order: 1 }, 'en').href
    ).toBe('mailto:contact@techcub.ro');
  });

  it('applies localized overrides', () => {
    const item: NavItem = {
      label: 'Contact',
      href: '/contact',
      order: 1,
      locales: { en: { label: 'Get in touch', href: '/contact' } },
    };
    expect(resolveNavItem(item, 'en')).toEqual({
      label: 'Get in touch',
      href: '/en/contact',
      external: undefined,
    });
  });
});
