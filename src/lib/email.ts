import { RESEND_API_KEY } from 'astro:env/server';
import { PUBLIC_NEWSLETTER_ENABLED } from 'astro:env/client';

export const contactConfigured = Boolean(RESEND_API_KEY);
export const newsletterConfigured = PUBLIC_NEWSLETTER_ENABLED;
