import type { APIRoute } from 'astro';
import { getCollection } from '@/lib/content';
import { getPostUrl } from '@/lib/blog';
import { getProjectUrl } from '@/lib/projects';
import { manifestSchema, type NotificationItem } from '@/lib/newsletter/shared';

export const GET: APIRoute = async () => {
  const items: NotificationItem[] = [];
  for (const collection of ['blog', 'projects'] as const) {
    const entries = await getCollection(collection);
    for (const entry of entries) {
      const { data } = entry;
      if (!data.notification || data.draft || ('placeholder' in data && data.placeholder)) continue;
      if (data.locale !== 'ro' && data.locale !== 'en') continue;
      items.push({
        id: `${data.notification.id}:${data.locale}`,
        locale: data.locale,
        title: data.title,
        description: data.description,
        path:
          collection === 'blog'
            ? getPostUrl(entry.id, data.locale)
            : getProjectUrl(entry.id, data.locale),
        publishedAt: data.notification.publishedAt.toISOString(),
      });
    }
  }
  return Response.json(manifestSchema.parse({ version: 1, items }), {
    headers: { 'Cache-Control': 'no-cache' },
  });
};
