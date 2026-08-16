import { describe, expect, it } from 'vitest';
import { getServiceNavItems } from '@/config/services.config';

describe('service navigation', () => {
  it('uses Romanian labels and routes for the default locale', () => {
    expect(getServiceNavItems('ro').map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Dezvoltare web', href: '/servicii/dezvoltare-web' },
      { label: 'Service calculatoare', href: '/servicii/service-calculatoare' },
      { label: 'Suport IT', href: '/servicii/suport-it' },
      { label: 'Administrare IT', href: '/servicii/administrare-it' },
    ]);
  });

  it('uses English labels and routes for the English locale', () => {
    expect(getServiceNavItems('en').map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Web development', href: '/en/services/web-development' },
      { label: 'Computer repair', href: '/en/services/computer-repair' },
      { label: 'IT support', href: '/en/services/it-support' },
      { label: 'IT management', href: '/en/services/it-management' },
    ]);
  });
});
