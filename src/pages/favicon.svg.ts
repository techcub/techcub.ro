import logoMark from '@/assets/branding/logo-mark.svg?raw';
import { THEME_COLOR } from '@/config/branding';
import { buildFaviconSvg } from '@/lib/favicon/svg';

export const prerender = true;

export function GET(): Response {
  const favicon = buildFaviconSvg(logoMark, THEME_COLOR);

  return new Response(favicon, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
