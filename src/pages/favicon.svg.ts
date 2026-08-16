import logoMark from '@/assets/branding/logo-mark.svg?raw';

export const prerender = true;

export function GET(): Response {
  const favicon = logoMark.replace(
    '</svg>',
    '<style>svg{color:#000}@media(prefers-color-scheme:dark){svg{color:#fff}}</style></svg>'
  );

  return new Response(favicon, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
