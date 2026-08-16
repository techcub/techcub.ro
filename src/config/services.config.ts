export type ServiceKey = 'webDevelopment' | 'computerRepair' | 'itSupport' | 'itManagement';

interface LocalizedServiceRoute {
  slug: string;
  title: string;
}

interface ServiceRoute {
  key: ServiceKey;
  icon: string;
  ro: LocalizedServiceRoute;
  en: LocalizedServiceRoute;
}

export const serviceRoutes: ServiceRoute[] = [
  {
    key: 'webDevelopment',
    icon: 'code-2',
    ro: { slug: 'dezvoltare-web', title: 'Dezvoltare web' },
    en: { slug: 'web-development', title: 'Web development' },
  },
  {
    key: 'computerRepair',
    icon: 'laptop',
    ro: { slug: 'service-calculatoare', title: 'Service calculatoare' },
    en: { slug: 'computer-repair', title: 'Computer repair' },
  },
  {
    key: 'itSupport',
    icon: 'headphones',
    ro: { slug: 'suport-it', title: 'Suport IT' },
    en: { slug: 'it-support', title: 'IT support' },
  },
  {
    key: 'itManagement',
    icon: 'settings',
    ro: { slug: 'administrare-it', title: 'Administrare IT' },
    en: { slug: 'it-management', title: 'IT management' },
  },
];

export function getServiceRoute(key: ServiceKey): ServiceRoute {
  const service = serviceRoutes.find((entry) => entry.key === key);
  if (!service) throw new Error(`Unknown service: ${key}`);
  return service;
}

export function getServicePath(service: ServiceRoute, locale: 'ro' | 'en'): string {
  return locale === 'ro' ? `/servicii/${service.ro.slug}` : `/en/services/${service.en.slug}`;
}

export function getServiceAlternates(service: ServiceRoute): Record<string, string> {
  return {
    ro: getServicePath(service, 'ro'),
    en: getServicePath(service, 'en'),
  };
}

export function getServiceNavItems(locale: string) {
  const activeLocale = locale === 'en' ? 'en' : 'ro';

  return serviceRoutes.map((service) => ({
    label: service[activeLocale].title,
    href: getServicePath(service, activeLocale),
    icon: service.icon,
  }));
}
