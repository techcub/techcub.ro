import { BRAND_NAME, SITE_URL, CONTACT_EMAIL, CONTACT_PHONE, LEGAL_NAME, LEGAL_ADDRESS } from './brand';

export function buildLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: BRAND_NAME,
    legalName: LEGAL_NAME,
    url: SITE_URL,
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE,
    areaServed: [
      {
        '@type': 'City',
        name: 'Cluj-Napoca',
      },
      {
        '@type': 'Country',
        name: 'România',
      },
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: LEGAL_ADDRESS,
      addressCountry: 'RO',
    },
  };
}