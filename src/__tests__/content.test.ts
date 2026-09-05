import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCollection as getAstroCollection } from 'astro:content';
import { hasContent } from '@/lib/content-files';
import { getCollection } from '@/lib/content';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));
vi.mock('@/lib/content-files', () => ({ hasContent: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe('optional content collections', () => {
  it.each(['blog', 'pages', 'projects'] as const)(
    'returns an empty %s collection without querying Astro when no files exist',
    async (collection) => {
      vi.mocked(hasContent).mockReturnValue(false);
      expect(await getCollection(collection)).toEqual([]);
      expect(getAstroCollection).not.toHaveBeenCalled();
    }
  );

  it('passes populated collections and their filter to Astro', async () => {
    vi.mocked(hasContent).mockReturnValue(true);
    vi.mocked(getAstroCollection).mockResolvedValue([]);
    const filter = () => true;
    await getCollection('blog', filter);
    expect(getAstroCollection).toHaveBeenCalledWith('blog', filter);
  });

  it('propagates content errors', async () => {
    vi.mocked(hasContent).mockReturnValue(true);
    vi.mocked(getAstroCollection).mockRejectedValue(new Error('Invalid content'));
    await expect(getCollection('blog')).rejects.toThrow('Invalid content');
  });
});
