export const businessConfig = {
  brandName: 'Tech cu Bogdan',
  website: 'https://techcub.ro',
  ownerName: 'Bogdan Murășan',
  professionalTitle: 'Consultant IT și dezvoltator web',
  tagline: 'Tehnologie explicată simplu, de la om la om.',
  description:
    'Servicii IT, service calculatoare și dezvoltare web pentru persoane, profesioniști și organizații mici din Cluj-Napoca.',
  serviceArea: 'Cluj-Napoca',
  availability: 'Intervenții fizice în Cluj-Napoca și suport la distanță',
  firstConsultation: 'Prima discuție este gratuită și fără obligații.',
  email: 'contact@techcub.ro',
  phone: '+40774497894',
  phoneDisplay: '+40 774 497 894',
  whatsapp: 'https://wa.me/40774497894',
  legal: {
    name: 'MURĂȘAN BOGDAN PFA',
    taxId: '54894279',
    registrationNumber: 'F2026030758003',
    address: {
      street: 'Bulevardul Bucureștii Noi, Nr. 136, Parter, Ap. 5',
      city: 'București',
      state: 'Sectorul 1',
      zip: '',
      country: 'România',
    },
  },
  services: ['Dezvoltare web', 'Service calculatoare', 'Suport IT', 'Administrare IT'],
  socialLinks: [
    'https://github.com/techcub',
    'https://linkedin.com/company/techcubogdan',
    'https://www.facebook.com/techcub.ro/',
    'https://www.instagram.com/techcub.ro/',
  ],
} as const;

export type BusinessConfig = typeof businessConfig;
