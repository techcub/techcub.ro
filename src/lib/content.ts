import { getCollection as getAstroCollection, type CollectionEntry } from 'astro:content';
import { hasContent } from './content-files';

type ContentCollection = 'blog' | 'pages' | 'projects';

export async function getCollection<C extends ContentCollection>(
  collection: C,
  filter?: (entry: CollectionEntry<C>) => boolean
): Promise<CollectionEntry<C>[]> {
  if (!hasContent(collection)) return [];
  return getAstroCollection(collection, filter);
}
